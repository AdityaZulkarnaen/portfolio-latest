/**
 * The same card, under the filename X/Twitter's crawler is told to look for.
 *
 * A re-export rather than a copy: one drawing, one build cost, and no second
 * file to forget when the identity changes. X does fall back to `og:image`
 * when there is no `twitter:image`, but only some of the other readers of the
 * `summary_large_image` card do — and the ones that do not simply show no
 * image at all.
 */
export {
  default,
  alt,
  size,
  contentType,
} from "./opengraph-image";
