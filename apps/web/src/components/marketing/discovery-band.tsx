import { ArrowRight, LayoutDashboard, LogIn, Sparkles, UserPlus } from 'lucide-react';
import { Link } from 'react-router';
import { listToolsByKind, type ToolCategory } from '@quickbiz/shared';
import { HOMEPAGE } from '../../content/homepage';
import { Button } from '../ui/button';
import { Container } from '../ui/container';
import { ToolIcon } from '../tools/tool-icon';

const CATEGORY_LABELS: Readonly<Record<ToolCategory, string>> = {
  writing: 'Writing',
  marketing: 'Marketing',
  business: 'Business',
  language: 'Language',
  productivity: 'Productivity',
  calculators: 'Calculators',
  documents: 'Documents',
};

/**
 * First-screen discovery band.
 *
 * Surfaces the platform's main areas — tool categories, the most-used free
 * tools, the free-vs-AI split, and the sign-in / create-account / workspace
 * paths — without requiring a long scroll. It is purely presentational (no auth
 * context) so it renders on the public homepage; signed-in affordances live in
 * the account shell.
 */
export function DiscoveryBand() {
  const { discovery } = HOMEPAGE;

  const freeTools = listToolsByKind('utility').filter((tool) => tool.status === 'live');
  const categories = [...new Set(freeTools.map((tool) => tool.category))];
  const popular = freeTools.slice(0, 4);

  return (
    <section aria-labelledby="discovery-heading" className="border-b border-border bg-canvas">
      <Container className="py-10 sm:py-12">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {discovery.eyebrow}
            </p>
            <h2
              id="discovery-heading"
              className="mt-1.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl"
            >
              {discovery.title}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/login">
                <LogIn className="size-4" aria-hidden="true" />
                {discovery.account.signIn}
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">
                <UserPlus className="size-4" aria-hidden="true" />
                {discovery.account.createAccount}
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <nav aria-label={discovery.categoriesLabel}>
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                {discovery.categoriesLabel}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <li key={category}>
                    <Link
                      to="/tools"
                      className="inline-flex items-center rounded-pill border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-brand-300 hover:text-ink"
                    >
                      {CATEGORY_LABELS[category]}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                {discovery.popularLabel}
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {popular.map((tool) => (
                  <li key={tool.slug}>
                    <Link
                      to={`/tools/${tool.slug}`}
                      className="group flex h-full flex-col gap-2 rounded-card border border-border bg-surface p-3 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-elev-1"
                    >
                      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                        <ToolIcon name={tool.icon} />
                      </span>
                      <span className="text-xs font-medium leading-snug text-ink">{tool.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Link
              to="/tools"
              className="group flex flex-col gap-1.5 rounded-card border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-elev-1"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                {discovery.freePanel.title}
                <ArrowRight className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-xs leading-relaxed text-ink-muted">
                {discovery.freePanel.body}
              </span>
            </Link>
            <a
              href="#ai-tools"
              className="group flex flex-col gap-1.5 rounded-card border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-elev-1"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <Sparkles className="size-4 text-primary" aria-hidden="true" />
                {discovery.aiPanel.title}
                <ArrowRight className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-xs leading-relaxed text-ink-muted">
                {discovery.aiPanel.body}
              </span>
            </a>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-subtle">{discovery.account.workspaceHint}</p>
          <Button asChild size="sm" variant="outline">
            <Link to="/dashboard">
              <LayoutDashboard className="size-4" aria-hidden="true" />
              {discovery.account.workspace}
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
