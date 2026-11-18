import type { ToolDefinition } from '@quickbiz/shared';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ToolIcon } from '../tools/tool-icon';

const CATEGORY_LABELS: Readonly<Record<ToolDefinition['category'], string>> = {
  writing: 'Writing',
  marketing: 'Marketing',
  business: 'Business',
  language: 'Language',
  productivity: 'Productivity',
  calculators: 'Calculators',
  documents: 'Documents',
};

export interface ToolCardProps {
  tool: ToolDefinition;
}

/**
 * Catalogue card used on the homepage showcase and the tools directory.
 *
 * A live tool links to its page; a planned one stays a description rather than
 * offering a button that goes nowhere.
 */
export function ToolCard({ tool }: ToolCardProps) {
  const isAi = tool.kind === 'ai';
  const isLive = tool.status === 'live';

  const body = (
    <Card
      as="article"
      className={
        isLive
          ? 'h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-brand-300 group-hover:shadow-elev-2'
          : 'h-full'
      }
    >
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
            <ToolIcon name={tool.icon} />
          </span>
          <Badge tone={isAi ? 'brand' : isLive ? 'success' : 'neutral'}>
            {isAi ? 'AI' : isLive ? 'Free · Live' : 'Free'}
          </Badge>
        </div>
        <CardTitle className="text-[15px]">{tool.name}</CardTitle>
        <CardDescription className="min-h-[2.5rem]">{tool.summary}</CardDescription>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-ink-subtle">{CATEGORY_LABELS[tool.category]}</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
            {isAi ? 'Credits shown first' : isLive ? 'Open tool' : 'No account'}
            {isLive ? (
              <ArrowUpRight
                className="size-3.5 text-ink-subtle transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            ) : null}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (!isLive) return body;

  return (
    <Link
      to={`/tools/${tool.slug}`}
      className="group block h-full rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      {body}
    </Link>
  );
}
