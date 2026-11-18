import { getToolBySlug, listToolsByKind } from '@quickbiz/shared';
import { ChevronRight, Download, ShieldCheck, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { TOOL_COPY, TOOLS_INDEX_COPY } from '../../content/tools';
import { Badge } from '../ui/badge';
import { Container } from '../ui/container';
import { cn } from '../../lib/cn';
import { ToolIcon } from './tool-icon';

export interface ToolPageProps {
  readonly slug: string;
  /**
   * One child renders full width; two children become the input and result
   * columns. Keeping the grid here means every tool shares one layout.
   */
  readonly children: ReactNode;
  readonly layout?: 'split' | 'single';
}

function RelatedTools({ slug }: { slug: string }) {
  const others = listToolsByKind('utility')
    .filter((tool) => tool.slug !== slug && tool.status === 'live')
    .slice(0, 3);

  if (others.length === 0) return null;

  return (
    <nav aria-labelledby="related-tools" className="mt-10 border-t border-border pt-6">
      <h2
        id="related-tools"
        className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle"
      >
        Other tools
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {others.map((tool) => (
          <li key={tool.slug}>
            <Link
              to={`/tools/${tool.slug}`}
              className="group flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 transition-colors hover:border-border-strong hover:bg-surface-muted"
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <ToolIcon name={tool.icon} className="size-4" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-ink">{tool.name}</span>
              <ChevronRight
                className="size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Shared chrome for every Stage 5 tool: breadcrumb, title block, two-column
 * layout and cross-links. Keeping this in one place is what stops eight pages
 * from slowly drifting into eight different designs.
 */
export function ToolPage({ slug, children, layout = 'split' }: ToolPageProps) {
  const tool = getToolBySlug(slug);
  if (!tool) return null;

  const copy = TOOL_COPY[slug];

  return (
    <Container className="py-7 sm:py-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <Link to="/tools" className="rounded transition-colors hover:text-ink">
          All tools
        </Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span aria-current="page" className="text-ink-muted">
          {copy?.title ?? tool.name}
        </span>
      </nav>

      <header className="qb-enter mt-4 flex items-start gap-3.5 sm:gap-4">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary sm:size-12">
          <ToolIcon name={tool.icon} className="size-5 sm:size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {copy?.title ?? tool.name}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted sm:text-[15px]">
            {copy?.description ?? tool.summary}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="success">
              <Wallet className="size-3" aria-hidden="true" />
              Free
            </Badge>
            <Badge tone="neutral">
              <ShieldCheck className="size-3" aria-hidden="true" />
              No account needed
            </Badge>
            <Badge tone="neutral">
              <Download className="size-3" aria-hidden="true" />
              Runs on your device
            </Badge>
          </div>
        </div>
      </header>

      <div
        className={cn(
          'mt-6 grid min-w-0 gap-4 sm:mt-8 lg:items-start lg:gap-5',
          layout === 'single' ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]',
          '[&>*]:min-w-0',
        )}
      >
        {children}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-ink-subtle">{TOOLS_INDEX_COPY.privacyNote}</p>

      <RelatedTools slug={slug} />
    </Container>
  );
}
