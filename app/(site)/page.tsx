import About from "@/components/about/about";
import Experience from "@/components/experience/experience";
import FeaturedWorks from "@/components/works/featured-works";
import Hero from "@/components/hero/hero";
import TechStack from "@/components/tech/tech-stack";
import {
  getExperiences,
  getFeaturedWorks,
  getWorks,
} from "@/lib/content/source";

/**
 * The only place on the homepage that touches Sanity.
 *
 * Chapters .04 and .05 are client components — one measures rects every frame,
 * the other observes its own heading — so neither can read content itself. This
 * page is the server boundary that does, and it fetches all of it in parallel:
 * `getFeaturedWorks` shares `getWorks`' round trip through React's per-request
 * cache, so the three calls below are two requests, not three.
 */
export default async function Home() {
  const [works, featuredWorks, experiences] = await Promise.all([
    getWorks(),
    getFeaturedWorks(),
    getExperiences(),
  ]);

  return (
    <main className="w-full">
      <Hero />
      <About />
      <TechStack />
      <FeaturedWorks works={featuredWorks} total={works.length} />
      <Experience experiences={experiences} />
    </main>
  );
}
