import { Check, Info } from 'lucide-react';
import { HOMEPAGE } from '../../../content/homepage';
import { cn } from '../../../lib/cn';
import { Container } from '../../ui/container';
import { SectionHeading } from '../section-heading';

export function PricingSection() {
  const content = HOMEPAGE.pricing;

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="scroll-mt-24 border-b border-border bg-surface py-16 sm:py-20"
    >
      <Container>
        <SectionHeading
          eyebrow={content.eyebrow}
          title={content.title}
          description={content.description}
          titleId="pricing-title"
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {content.plans.map((plan) => (
            <article
              key={plan.name}
              className={cn(
                'flex h-full flex-col rounded-card border bg-canvas p-6 transition-shadow duration-200',
                plan.emphasis
                  ? 'border-primary/40 shadow-elev-2 ring-1 ring-primary/15'
                  : 'border-border shadow-elev-1',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                  {plan.name}
                </h3>
                {plan.emphasis ? (
                  <span className="rounded-pill bg-primary-soft px-2.5 py-0.5 text-[11px] font-medium text-primary">
                    Pay as you go
                  </span>
                ) : null}
              </div>

              <p className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-ink">{plan.price}</span>
                <span className="text-xs text-ink-subtle">{plan.priceNote}</span>
              </p>

              <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm text-ink-muted">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="mt-6 flex items-start gap-2.5 text-xs leading-relaxed text-ink-subtle sm:max-w-3xl">
          <Info className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span>{content.footnote}</span>
        </p>
      </Container>
    </section>
  );
}
