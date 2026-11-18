import { Info } from 'lucide-react';
import type { ToolDefinition } from '@quickbiz/shared';
import type { ToolSectionContent } from '../../content/homepage';
import { cn } from '../../lib/cn';
import { Container } from '../ui/container';
import { SectionHeading } from './section-heading';
import { ToolCard } from './tool-card';

export interface ToolShowcaseProps {
  id: string;
  content: ToolSectionContent;
  tools: readonly ToolDefinition[];
  /** Alternate the band colour so consecutive showcases stay distinguishable. */
  surface?: boolean;
}

export function ToolShowcase({ id, content, tools, surface = false }: ToolShowcaseProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        'scroll-mt-24 border-b border-border py-16 sm:py-20',
        surface ? 'bg-surface' : 'bg-canvas',
      )}
    >
      <Container>
        <SectionHeading
          eyebrow={content.eyebrow}
          title={content.title}
          description={content.description}
          titleId={`${id}-title`}
        />

        <p className="mt-6 flex items-start gap-2.5 rounded-lg border border-border bg-surface-muted/70 px-3.5 py-3 text-xs leading-relaxed text-ink-muted sm:max-w-3xl">
          <Info className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span>{content.note}</span>
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool) => (
            <li key={tool.slug} className="h-full">
              <ToolCard tool={tool} />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
