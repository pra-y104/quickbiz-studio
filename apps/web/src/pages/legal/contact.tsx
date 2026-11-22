import { Link } from 'react-router';
import { ArrowLeft, Mail } from 'lucide-react';
import { Container } from '../../components/ui/container';
import { Card } from '../../components/ui/card';
import { PLACEHOLDERS } from '../../content/legal';

/**
 * Contact page.
 *
 * The support address is not known yet, so the page says so plainly rather than
 * inventing an inbox. Once supplied, only this constant needs to change.
 */
export function ContactPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <Container className="max-w-2xl py-8 sm:py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Home
        </Link>

        <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          <Mail className="size-6 text-primary" aria-hidden="true" />
          Contact
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
          Questions about the product, your account or a legal page? The details below will be
          published before launch.
        </p>

        <Card className="mt-6 p-5">
          <h2 className="text-sm font-semibold text-ink">Support</h2>
          <p className="mt-2 break-words text-sm text-ink-muted">{PLACEHOLDERS.supportEmail}</p>
          <p className="mt-1 text-xs text-ink-subtle">No support inbox has been published yet.</p>
        </Card>

        <Card className="mt-4 p-5">
          <h2 className="text-sm font-semibold text-ink">Legal pages</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Read how we handle your data and what the terms of service are.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li>
              <Link to="/legal/privacy" className="text-primary hover:underline">
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/legal/terms" className="text-primary hover:underline">
                Terms
              </Link>
            </li>
            <li>
              <Link to="/legal/refunds" className="text-primary hover:underline">
                Refunds
              </Link>
            </li>
          </ul>
        </Card>
      </Container>
    </div>
  );
}
