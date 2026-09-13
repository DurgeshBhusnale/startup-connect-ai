import { Audiences } from "@/components/landing/audiences";
import { CtaBand } from "@/components/landing/cta-band";
import { DemoMatch } from "@/components/landing/demo-match";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <HowItWorks />
        <DemoMatch />
        <Audiences />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
