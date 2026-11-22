import { Link } from 'react-router';
import { ArrowLeft, Info } from 'lucide-react';
import { Container } from '../../components/ui/container';
import { Card } from '../../components/ui/card';
import type { LegalDocument } from '../../content/legal';

export interface LegalPageProps {
  readonly document: LegalDocument;
}

/**
 * Renders one legal document.
 *
 * Draft documents carry a visible banner: a policy that is still missing owner
 * details must not look finished. Placeholders are rendered verbatim so the gaps
 * are obvious to the owner during review.
 */
export function LegalPage({ document }: LegalPageProps) {
  return (
    <div className="min-h-dvh bg-canvas">
      <Container className="max-w-3xl py-8 sm:py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Home
        </Link>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {document.title}
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
          {document.summary}
        </p>
        <p className="mt-1 text-xs text-ink-subtle">Last updated {document.updated}</p>

        {document.draft ? (
          <Card className="mt-5 flex items-start gap-3 border-warning/40 bg-warning-soft p-4 text-sm text-ink">
            <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="font-medium">Draft — owner details pending</p>
              <p className="mt-1 text-ink-muted">
                Some information on this page is a clearly marked placeholder. It will be completed
                before launch.
              </p>
            </div>
          </Card>
        ) : null}

        <div className="mt-8 space-y-6">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold text-ink">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <nav aria-label="More legal information" className="mt-10 border-t border-border pt-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            More information
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li>
              <Link to="/legal/privacy" className="text-ink-muted hover:text-ink">
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/legal/terms" className="text-ink-muted hover:text-ink">
                Terms
              </Link>
            </li>
            <li>
              <Link to="/legal/refunds" className="text-ink-muted hover:text-ink">
                Refunds
              </Link>
            </li>
            <li>
              <Link to="/legal/cookies" className="text-ink-muted hover:text-ink">
                Cookies
              </Link>
            </li>
            <li>
              <Link to="/contact" className="text-ink-muted hover:text-ink">
                Contact
              </Link>
            </li>
          </ul>
        </nav>
      </Container>
    </div>
  );
}
