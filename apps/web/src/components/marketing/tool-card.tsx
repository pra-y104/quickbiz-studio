import type { ToolDefinition } from '@quickbiz/shared';
import { ArrowUpRight } from 'lucide-react';
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
 * Catalogue card used on the homepage showcases. It describes a tool without
 * pretending it is clickable: individual tool routes arrive in Stage 5/6.
 */
export function ToolCard({ tool }: ToolCardProps) {
  const isAi = tool.kind === 'ai';

  return (
    <Card
      as="article"
      className="group h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-elev-2"
    >
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-on-primary">
            <ToolIcon name={tool.icon} />
          </span>
          <Badge tone={isAi ? 'brand' : 'success'}>{isAi ? 'AI' : 'Free'}</Badge>
        </div>
        <CardTitle className="text-[15px]">{tool.name}</CardTitle>
        <CardDescription className="min-h-[2.5rem]">{tool.summary}</CardDescription>
      </CardHeader>
      <CardContent className="pt-1">
        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-ink-subtle">{CATEGORY_LABELS[tool.category]}</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
            {isAi ? 'Credits shown first' : 'No account'}
            <ArrowUpRight
              className="size-3.5 text-ink-subtle transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
