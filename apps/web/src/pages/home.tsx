import { listToolsByKind } from '@quickbiz/shared';
import { HOMEPAGE } from '../content/homepage';
import { Hero } from '../components/marketing/hero';
import { ToolShowcase } from '../components/marketing/tool-showcase';
import { FaqSection } from '../components/marketing/sections/faq-section';
import { FinalCtaSection } from '../components/marketing/sections/final-cta-section';
import { HowItWorksSection } from '../components/marketing/sections/how-it-works-section';
import { PricingSection } from '../components/marketing/sections/pricing-section';
import { PromiseSection } from '../components/marketing/sections/promise-section';
import { TrustSection } from '../components/marketing/sections/trust-section';

/**
 * Marketing homepage.
 *
 * Content lives in `content/homepage.ts`; tool lists come from the shared
 * catalogue so the page cannot drift from what the platform actually offers.
 * Individual tool routes arrive in Stage 5/6.
 */
export function HomePage() {
  const aiTools = listToolsByKind('ai');
  const freeTools = listToolsByKind('utility');

  return (
    <>
      <Hero />
      <ToolShowcase id="free-tools" content={HOMEPAGE.freeTools} tools={freeTools} />
      <ToolShowcase id="ai-tools" content={HOMEPAGE.aiTools} tools={aiTools} surface />
      <HowItWorksSection />
      <PricingSection />
      <PromiseSection />
      <TrustSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}
