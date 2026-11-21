import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import type { ToolDefinition } from '@quickbiz/shared';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ToolCard } from './tool-card';
import { Container } from '../ui/container';
import { SectionHeading } from './section-heading';
import type { ToolSectionContent } from '../../content/homepage';

const CATEGORY_LABELS: Readonly<Record<ToolDefinition['category'], string>> = {
  writing: 'Writing',
  marketing: 'Marketing',
  business: 'Business',
  language: 'Language',
  productivity: 'Productivity',
  calculators: 'Calculators',
  documents: 'Documents',
};

export interface ToolFinderProps {
  readonly freeContent: ToolSectionContent;
  readonly aiContent: ToolSectionContent;
  readonly freeTools: readonly ToolDefinition[];
  readonly aiTools: readonly ToolDefinition[];
}

function matches(tool: ToolDefinition, query: string): boolean {
  if (query.length === 0) return true;
  const haystack = `${tool.name} ${tool.summary} ${CATEGORY_LABELS[tool.category]}`.toLowerCase();
  return haystack.includes(query);
}

/**
 * Searchable tool directory for the homepage.
 *
 * One search box and one category filter drive both collections. Free tools are
 * always rendered above AI tools, and AI tools stay labelled as planned so the
 * layout never implies that generation is available.
 */
export function ToolFinder(props: ToolFinderProps) {
  const { t } = useTranslation();
  const { freeContent, aiContent, freeTools, aiTools } = props;

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ToolDefinition['category'] | 'all'>('all');

  const search = query.trim().toLowerCase();

  const categories = useMemo(() => {
    const present = new Set(freeTools.map((tool) => tool.category));
    return [...present];
  }, [freeTools]);

  const visibleFree = freeTools.filter(
    (tool) => (category === 'all' || tool.category === category) && matches(tool, search),
  );
  const visibleAi = aiTools.filter(
    (tool) => (category === 'all' || tool.category === category) && matches(tool, search),
  );

  const hasFilters = search.length > 0 || category !== 'all';

  return (
    <div id="tools">
      <Container className="py-10 sm:py-14">
        <SectionHeading
          eyebrow={t('home.finderEyebrow')}
          title={t('home.finderTitle')}
          description={t('home.finderDescription')}
          titleId="finder-title"
        />

        <div className="mt-6 space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('home.finderPlaceholder')}
              aria-label={t('home.finderPlaceholder')}
              className="h-12 pl-9 pr-10 text-base sm:text-sm"
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('home.clear')}
                className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={t('home.finderCategories')}
          >
            <FilterChip
              label={t('home.finderAll')}
              active={category === 'all'}
              onClick={() => setCategory('all')}
            />
            {categories.map((value) => (
              <FilterChip
                key={value}
                label={CATEGORY_LABELS[value]}
                active={category === value}
                onClick={() => setCategory(value)}
              />
            ))}
          </div>
        </div>
      </Container>

      <section
        id="free-tools"
        aria-labelledby="free-tools-heading"
        className="scroll-mt-24 border-t border-border bg-canvas py-10 sm:py-14"
      >
        <Container>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {freeContent.eyebrow}
              </p>
              <h2
                id="free-tools-heading"
                className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl"
              >
                {freeContent.title}
              </h2>
            </div>
            <p className="hidden text-sm text-ink-subtle sm:block">
              {visibleFree.length} / {freeTools.length}
            </p>
          </div>

          {visibleFree.length === 0 ? (
            <EmptyResults
              hasFilters={hasFilters}
              onClear={() => {
                setQuery('');
                setCategory('all');
              }}
            />
          ) : (
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {visibleFree.map((tool) => (
                <li key={tool.slug} className="h-full">
                  <ToolCard tool={tool} />
                </li>
              ))}
            </ul>
          )}
        </Container>
      </section>

      <section
        id="ai-tools"
        aria-labelledby="ai-tools-heading"
        className="scroll-mt-24 border-t border-border bg-surface py-10 sm:py-14"
      >
        <Container>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                {aiContent.eyebrow}
              </p>
              <h2
                id="ai-tools-heading"
                className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl"
              >
                {aiContent.title}
              </h2>
            </div>
            <p className="hidden text-sm text-ink-subtle sm:block">
              {visibleAi.length} / {aiTools.length}
            </p>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-muted">{aiContent.note}</p>

          {visibleAi.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">{t('home.finderNoMatch')}</p>
          ) : (
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {visibleAi.map((tool) => (
                <li key={tool.slug} className="h-full">
                  <ToolCard tool={tool} />
                </li>
              ))}
            </ul>
          )}
        </Container>
      </section>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[40px] rounded-pill border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 ${
        active
          ? 'border-primary bg-primary-soft text-primary'
          : 'border-border bg-surface text-ink-muted hover:bg-surface-muted'
      }`}
    >
      {label}
    </button>
  );
}

function EmptyResults({
  hasFilters,
  onClear,
}: {
  readonly hasFilters: boolean;
  readonly onClear: () => void;
}) {
  const { t } = useTranslation();
  if (!hasFilters) {
    return <Card className="mt-6 p-6 text-sm text-ink-muted">{t('home.finderEmpty')}</Card>;
  }
  return (
    <Card className="mt-6 p-6">
      <p className="text-sm font-medium text-ink">{t('home.finderNoMatch')}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onClear}>
        {t('home.finderClear')}
      </Button>
    </Card>
  );
}
