import { Ban, EyeOff, ListChecks, Server, ShieldCheck, type LucideIcon } from 'lucide-react';
import { HOMEPAGE } from '../../../content/homepage';
import { Container } from '../../ui/container';
import { SectionHeading } from '../section-heading';

const TRUST_ICONS: Readonly<Record<string, LucideIcon>> = {
  server: Server,
  ledger: ListChecks,
  /** Neutral “not available” marker; deliberately not a refund symbol. */
  unavailable: Ban,
  shield: ShieldCheck,
  privacy: EyeOff,
};

export function TrustSection() {
  const content = HOMEPAGE.trust;

  return (
    <section
      id="trust"
      aria-labelledby="trust-title"
      className="scroll-mt-24 border-b border-border bg-surface py-16 sm:py-20"
    >
      <Container>
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div>
            <SectionHeading
              eyebrow={content.eyebrow}
              title={content.title}
              description={content.description}
              titleId="trust-title"
            />
            <div className="mt-8 rounded-card border border-border bg-surface-muted/60 p-5">
              <p className="text-sm leading-relaxed text-ink-muted">
                These are engineering commitments rather than marketing claims. Each one is backed
                by automated tests that run on every change.
              </p>
            </div>
          </div>

          <ul className="space-y-3">
            {content.points.map((point) => {
              const Icon = TRUST_ICONS[point.icon] ?? ShieldCheck;
              return (
                <li
                  key={point.title}
                  className="flex gap-4 rounded-card border border-border bg-canvas p-4 sm:p-5"
                >
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{point.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">{point.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}
