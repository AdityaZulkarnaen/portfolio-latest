import About from "@/components/about/about";
import Experience from "@/components/experience/experience";
import FeaturedWorks from "@/components/works/featured-works";
import Hero from "@/components/hero/hero";
import TechStack from "@/components/tech/tech-stack";
import {
  getExperiences,
  getFeaturedWorks,
  getTools,
  getWorks,
} from "@/lib/content/source";

/**
 * The only place on the homepage that touches Sanity.
 *
 * Chapters .03, .04 and .05 are client components — one rasterises a sprite
 * sheet, one measures rects every frame, the last observes its own heading — so
 * none of them can read content itself. This page is the server boundary that
 * does, and it fetches all of it in parallel: `getFeaturedWorks` shares
 * `getWorks`' round trip through React's per-request cache, so the four calls
 * below are three requests, not four.
 */
export default async function Home() {
  const [works, featuredWorks, tools, experiences] = await Promise.all([
    getWorks(),
    getFeaturedWorks(),
    getTools(),
    getExperiences(),
  ]);

  return (
    <main className="w-full">
      <Hero />
      <About />
      <TechStack tools={tools} />
      <FeaturedWorks works={featuredWorks} total={works.length} />
      <Experience experiences={experiences} />
    </main>
  );
}
