import { useContent } from "../lib/ContentContext";
import { About } from "./About";
import { Certifications } from "./Certifications";
import { Contact } from "./Contact";
import { CustomSections } from "./content/CustomSections";
import { DraftChip, EditBar } from "./content/EditBar";
import { LinkedInSection, PagesSection, PlatformsSection, SecuritySection, ServicesSection, YouTubeSection } from "./content/ListSections";
import { Experience } from "./Experience";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { Projects } from "./Projects";

export function Landing() {
  const { editing } = useContent();
  return (
    <div className={editing ? "pb-16" : undefined}>
      <Header />
      <main id="main">
        <Hero />
        <About />
        <ServicesSection />
        <Experience />
        <Projects />
        <PlatformsSection />
        <SecuritySection />
        <YouTubeSection />
        <LinkedInSection />
        <PagesSection />
        <CustomSections />
        <Certifications />
        <Contact />
      </main>
      <Footer />
      {editing ? <EditBar /> : <DraftChip />}
    </div>
  );
}
