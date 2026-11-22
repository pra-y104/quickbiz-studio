import { ArrowUpRight, Code2 } from 'lucide-react';
import { Link } from 'react-router';
import { BRAND } from '@quickbiz/shared';
import { Badge } from '../ui/badge';
import { Container } from '../ui/container';
import { Logo } from '../brand/logo';

const PRODUCT_LINKS = [
  { label: 'AI tools', href: '#ai-tools' },
  { label: 'Free tools', href: '#free-tools' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Customer promise', href: '#promise' },
] as const;

const RESOURCE_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Trust and security', href: '#trust' },
  { label: 'Questions', href: '#questions' },
] as const;

const SOURCE_URL = 'https://github.com/pra-y104/quickbiz-studio';

function LinkColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { label: string; href: string }[];
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const year = new Date().getUTCFullYear();

  return (
    <footer className="border-t border-border bg-surface">
      <Container className="py-12 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-ink-muted">{BRAND.tagline}</p>
            <Badge tone="neutral">Pre-launch preview</Badge>
          </div>

          <LinkColumn title="Product" links={PRODUCT_LINKS} />
          <LinkColumn title="Learn" links={RESOURCE_LINKS} />

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Project
            </h2>
            <ul className="mt-3 space-y-2.5">
              <li>
                <Link
                  to="/tools"
                  className="text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  All free tools
                </Link>
              </li>
              <li>
                <Link
                  to="/design-system"
                  className="text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  Design system
                </Link>
              </li>
              <li>
                <a
                  href={SOURCE_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  <Code2 className="size-3.5" aria-hidden="true" />
                  Source code
                  <ArrowUpRight className="size-3" aria-hidden="true" />
                </a>
              </li>
            </ul>
            <ul className="mt-5 space-y-1.5 text-xs">
              <li>
                <Link to="/legal/privacy" className="text-ink-subtle hover:text-ink">
                  Privacy policy
                </Link>
              </li>
              <li>
                <Link to="/legal/terms" className="text-ink-subtle hover:text-ink">
                  Terms of service
                </Link>
              </li>
              <li>
                <Link to="/legal/refunds" className="text-ink-subtle hover:text-ink">
                  Refund policy
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-ink-subtle hover:text-ink">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {BRAND.name}. All rights reserved.
          </p>
          <p>Stage 5 · Built with React, TypeScript and Cloudflare Workers.</p>
        </div>
      </Container>
    </footer>
  );
}
