import { Link } from 'react-router';
import { BRAND } from '@quickbiz/shared';
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
            <p className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-ink-muted">
              Free tools available · AI tools planned
            </p>
          </div>

          <LinkColumn title="Product" links={PRODUCT_LINKS} />
          <LinkColumn title="Learn" links={RESOURCE_LINKS} />

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Explore
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
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-ink-subtle">
              Privacy policy, terms of service and support contact are published before launch.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} {BRAND.name}. All rights reserved.
          </p>
          <p>Built with React, TypeScript and Cloudflare Workers.</p>
        </div>
      </Container>
    </footer>
  );
}
