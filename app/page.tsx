import About from "@/components/about/about";
import Hero from "@/components/hero/hero";
import TechStack from "@/components/tech/tech-stack";

export default function Home() {
  return (
    <main className="w-full">
      <Hero />
      <About />
      <TechStack />
    </main>
  );
}
