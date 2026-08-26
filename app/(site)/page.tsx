import About from "@/components/about/about";
import JsonLd from "@/components/json-ld";
import Contact from "@/components/contact/contact";
import Experience from "@/components/experience/experience";
import FeaturedWorks from "@/components/works/featured-works";
import Hero from "@/components/hero/hero";
import TechStack from "@/components/tech/tech-stack";
import {
  getAbout,
  getExperiences,
  getFeaturedWorks,
  getTools,
  getWorks,
} from "@/lib/content/source";
import { personSchema, websiteSchema } from "@/lib/seo";

/**
 * The only place on the homepage that touches Sanity.
 *
 * Chapters .02 through .05 are client components — one drives a canvas, one
 * rasterises a sprite sheet, one measures rects every frame, the last observes
 * its own heading — so none of them can read content itself. This page is the
 * server boundary that does, and it fetches all of it in parallel:
 * `getFeaturedWorks` shares `getWorks`' round trip through React's per-request
 * cache, so the five calls below are four requests, not five.
 */
export default async function Home() {
  const [about, works, featuredWorks, tools, experiences] = await Promise.all([
    getAbout(),
    getWorks(),
    getFeaturedWorks(),
    getTools(),
    getExperiences(),
  ]);

  return (
    <main className="w-full">
      {/* Two blocks, cross-referenced rather than repeated: the `WebSite` names
          its publisher by the `Person`'s `@id`, and every project page points
          both its `creator` and its `isPartOf` at the same two ids. That is
          what lets a crawler read the site as one entity with several pages
          about it, instead of as a set of pages each asserting a name.

          On the homepage rather than in the layout on purpose — this is where
          the `Person` actually is. A `ProfilePage` claim on every route,
          including the project archive, is the kind of over-marking that gets
          structured data ignored. */}
      <JsonLd data={[personSchema(about), websiteSchema()]} />

      <Hero />
      <About about={about} />
      <TechStack tools={tools} />
      <FeaturedWorks works={featuredWorks} total={works.length} />
      <Experience experiences={experiences} />
      <Contact />
    </main>
  );
}
