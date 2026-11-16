import AsciiLayer from "@/components/ascii/ascii-layer";
import SiteTexture from "@/components/site-texture";
import { META_TYPE_BASE } from "@/lib/site-config";
import type { GitHubActivityData } from "@/lib/github";
import { activityCopy } from "./activity-copy";
import ActivityGrid from "./activity-grid";

type ActivityProps = {
  data: GitHubActivityData;
};

export default function Activity({ data }: ActivityProps) {
  return (
    <section
      id="activity"
      data-chapter=".04"
      data-chapter-name="Activity"
      // Positioned above Chapter .03 (z-30), below Chapter .05 Works (z-[35])
      className="relative z-[34] w-full overflow-hidden bg-void"
    >
      <SiteTexture className="text-acid opacity-[0.12]" />
      {/* 04:30 — the last stars going out, and a violet line of light behind
          the hills at the foot of the chapter. */}
      <AsciiLayer scene="predawn" className="z-0" />

      <div className="relative mx-auto w-full max-w-[110rem] pb-24 pl-5 pr-5 pt-20 sm:pr-[var(--rail-gutter)] md:pb-36 md:pl-8 md:pt-28">
        <header className="mb-12 flex flex-wrap items-end justify-between gap-x-8 gap-y-6 md:mb-16">
          <div className="space-y-4">
            <div className="overflow-hidden">
              <p className={`text-acid ${META_TYPE_BASE}`}>
                {activityCopy.eyebrow}
              </p>
            </div>
            <div className="overflow-hidden">
              <h2 className="font-display text-[clamp(2.5rem,9vw,7rem)] font-black uppercase leading-[0.85] tracking-[-0.045em] text-ink">
                {activityCopy.heading}
              </h2>
            </div>
            <p className="max-w-[50ch] font-mono text-sm leading-relaxed text-muted sm:text-base">
              {activityCopy.subheading}
            </p>
          </div>

          <div className="overflow-hidden">
            <a
              href={activityCopy.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex items-center gap-3 text-ink transition-colors hover:text-acid ${META_TYPE_BASE}`}
            >
              {activityCopy.viewProfile}
              <span className="tabular-nums text-muted">
                (@{data.username})
              </span>
              <span
                aria-hidden
                className="block h-px w-6 bg-current transition-all duration-500 group-hover:w-10"
              />
            </a>
          </div>
        </header>

        <ActivityGrid data={data} />
      </div>
    </section>
  );
}
