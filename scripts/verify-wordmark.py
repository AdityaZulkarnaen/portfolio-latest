"""
Checks that no two letters of the hero wordmark close up on each other.

    pip install fonttools brotli uharfbuzz
    npm run build          # puts the Archivo subset in .next/static/media
    python scripts/verify-wordmark.py

Run this after ANY of these change, because all of them move the answer: the
text of either wordmark line in `hero-copy.ts`, `WORDMARK_TYPE`'s tracking or
size in `hero.tsx`, the stroke width on `[data-outline]` in `globals.css`, or
the display face in `lib/fonts.ts`.

It exists because the fault it catches is invisible to reasoning and nearly
invisible to the eye. "ZULKARNAEN" came in with K and A looking like they
crossed. They did not — Archivo simply kerns that one pair 50 units tighter
than anything else on the line, and because both edges of that gap are
near-parallel diagonals, a gap half the size of its neighbours' reads as a
collision. The fix was to switch the font's kerning off on that line only, and
the only way to know that was the right lever — rather than opening the
tracking, which was tried first — is the table below.

Why Python for a JS project: the check is only worth anything if the shaping is
the browser's shaping, kern pairs included, and HarfBuzz is what the browser
uses. There is no offline Node equivalent.

Two notes on the mechanics, both of which produced convincing wrong answers on
the way here:

 - HarfBuzz cannot read woff2, and a face it failed to load still *shapes*. It
   returns 500 units for every advance, which looks like a plausible number
   until you notice every glyph has the same one. The file is decompressed
   first, and the shaping is asserted before anything is measured.
 - next/font splits a face across several subset files by unicode range, and
   the first Archivo file in the directory does not contain uppercase Z. The
   right one is picked by coverage, not by name.
"""

import glob
import os
import sys
import tempfile

try:
    import uharfbuzz as hb
    from fontTools.ttLib import TTFont
    from fontTools.ttLib.woff2 import decompress
    from fontTools.pens.recordingPen import RecordingPen
except ImportError:
    sys.exit("pip install fonttools brotli uharfbuzz")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Must match `hero.tsx`. The size is the ceiling of the clamp, which is the
# only size worth checking: every gap below scales with it, so a line that
# clears here clears everywhere.
FONT_PX = 120.0
TRACKING_EM = -0.045
WEIGHT = 900
# Must match `[data-outline]` in `globals.css`. The stroke is centred on the
# contour, so each side of a gap eats half of it — one full pixel per pair, and
# only on the line that is actually stroked.
STROKE_PX = 1.0

# Must match `hero-copy.ts` and the classes in `hero.tsx`: the text, whether
# the font's kerning is left on, and whether the line is drawn as an outline.
LINES = [
    ("ADITYA", True, False),
    ("ZULKARNAEN", False, True),
]

# Under this, a gap is a fault however the pair is drawn.
FLOOR_PX = 6.0
# A gap this far under its own line's median reads as an accident even when it
# is clear of the floor — which is exactly what KA was.
#
# Only applied to an outlined line, and that restriction is the point rather
# than a let-off. Filled type is *supposed* to have an uneven gap table: TY on
# the solid line comes in at half the median and is correct, because Y's arms
# lean back over T's and the two shapes interlock. Strip the fill and the same
# nesting becomes two lines converging in open space, which is the fault this
# script is for.
RELATIVE = 0.6


def load_font(text):
    """The subset file that actually covers `text`, decompressed for HarfBuzz."""
    pattern = os.path.join(ROOT, ".next", "static", "media", "*.woff2")
    for path in sorted(glob.glob(pattern)):
        probe = TTFont(path, lazy=True)
        if not (probe["name"].getDebugName(1) or "").startswith("Archivo"):
            continue
        cmap = probe.getBestCmap()
        if all(ord(ch) in cmap for ch in text):
            out = os.path.join(tempfile.gettempdir(), "verify-wordmark.ttf")
            decompress(path, out)
            return out
    sys.exit(
        "No Archivo subset covering %r under .next/static/media.\n"
        "Run `npm run build` first." % text
    )


def flatten(glyph_set, name):
    """A glyph's contours as a dense point cloud, in font units."""
    from math import comb

    pen = RecordingPen()
    glyph_set[name].draw(pen)
    points, cur = [], (0.0, 0.0)

    def bezier(control, steps=24):
        out = []
        order = len(control) - 1
        for i in range(1, steps + 1):
            t = i / steps
            x = y = 0.0
            for j, (px, py) in enumerate(control):
                b = comb(order, j) * (1 - t) ** (order - j) * t**j
                x += b * px
                y += b * py
            out.append((x, y))
        return out

    for op, args in pen.value:
        if op == "moveTo":
            cur = args[0]
            points.append(cur)
        elif op == "lineTo":
            end = args[0]
            for i in range(1, 17):
                points.append(
                    (
                        cur[0] + (end[0] - cur[0]) * i / 16,
                        cur[1] + (end[1] - cur[1]) * i / 16,
                    )
                )
            cur = end
        elif op == "qCurveTo":
            pts = list(args)
            on, offs = pts[-1], pts[:-1]
            if on is None:  # an all-off-curve contour closes on an implied point
                on = ((offs[0][0] + offs[-1][0]) / 2, (offs[0][1] + offs[-1][1]) / 2)
            for i, off in enumerate(offs):
                nxt = (
                    on
                    if i == len(offs) - 1
                    else (
                        (off[0] + offs[i + 1][0]) / 2,
                        (off[1] + offs[i + 1][1]) / 2,
                    )
                )
                points += bezier([cur, off, nxt])
                cur = nxt
        elif op == "curveTo":
            pts = list(args)
            points += bezier([cur] + pts)
            cur = pts[-1]

    return points


def gaps(text, kerning, outlined):
    """The smallest ink-to-ink gap for every adjacent pair, in CSS px."""
    path = load_font(text)
    tt = TTFont(path)
    upm = tt["head"].unitsPerEm
    glyph_set = tt.getGlyphSet({"wght": WEIGHT})
    order = tt.getGlyphOrder()

    font = hb.Font(hb.Face(hb.Blob.from_file_path(path)))
    font.scale = (upm, upm)
    font.set_variations({"wght": float(WEIGHT)})

    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": kerning})

    advances = [pos.x_advance for pos in buf.glyph_positions]
    if len(set(advances)) == 1 and len(advances) > 2:
        sys.exit("Shaping failed — every advance identical. The face did not load.")

    scale = FONT_PX / upm
    placed, pen_x = [], 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        origin = pen_x + pos.x_offset
        placed.append(
            [
                (origin * scale + px * scale, py * scale)
                for px, py in flatten(glyph_set, order[info.codepoint])
            ]
        )
        # CSS letter-spacing is added after every glyph, the last one included.
        pen_x += pos.x_advance + TRACKING_EM * upm

    out = []
    for i in range(len(placed) - 1):
        left, right = placed[i], placed[i + 1]
        # Per scanline, because the pairs that fail are diagonal against
        # diagonal: their bounding boxes clear each other by a mile while the
        # ink does not.
        lmax, rmin = {}, {}
        for px, py in left:
            row = round(py)
            lmax[row] = max(lmax.get(row, -1e9), px)
        for px, py in right:
            row = round(py)
            rmin[row] = min(rmin.get(row, 1e9), px)
        rows = set(lmax) & set(rmin)
        stroke = STROKE_PX if outlined else 0.0
        gap = min(rmin[r] - lmax[r] for r in rows) - stroke if rows else 999.0
        out.append((text[i : i + 2], gap))

    return out, pen_x * scale


failed = False
for text, kerning, outlined in LINES:
    pairs, width = gaps(text, kerning, outlined)
    values = sorted(g for _, g in pairs)
    median = values[len(values) // 2]
    print(
        f"\n{text}  |  {'outlined' if outlined else 'solid'}, "
        f"kerning {'on' if kerning else 'off'}, tracking {TRACKING_EM:+g}em, "
        f"{width:.0f}px wide at {FONT_PX:g}px"
    )
    for pair, gap in pairs:
        bad = gap < FLOOR_PX or (outlined and gap < median * RELATIVE)
        failed = failed or bad
        print(f"  {pair}  {gap:6.1f}px  {'<-- TIGHT' if bad else ''}")
    print(f"  median {median:.1f}px")

if failed:
    sys.exit("\nAt least one pair is tight. See the note in hero.tsx.")
print("\nEvery pair clear.")
