import { Archive, ReceiptText, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HOMEPAGE } from '../../../content/homepage';
import { Container } from '../../ui/container';
import { SectionHeading } from '../section-heading';

const STEP_ICONS: Readonly<Record<string, LucideIcon>> = {
  search: Search,
  receipt: ReceiptText,
  archive: Archive,
};

export function HowItWorksSection() {
  const content = HOMEPAGE.howItWorks;

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="scroll-mt-24 border-b border-border bg-canvas py-16 sm:py-20"
    >
      <Container>
        <SectionHeading
          eyebrow={content.eyebrow}
          title={content.title}
          description={content.description}
          titleId="how-it-works-title"
        />

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {content.steps.map((step, index) => {
            const Icon = STEP_ICONS[step.icon] ?? Search;
            return (
              <li
                key={step.title}
                className="group relative rounded-card border border-border bg-surface p-6 shadow-elev-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elev-2"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-2xl font-semibold tabular-nums tracking-tight text-border-strong transition-colors group-hover:text-primary/40">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </Container>
    </section>
  );
}
