import { listToolsByKind, type ToolCategory } from '@quickbiz/shared';
import { Search, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { TOOLS_INDEX_COPY } from '../../content/tools';
import { ToolCard } from '../../components/marketing/tool-card';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Container } from '../../components/ui/container';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { cn } from '../../lib/cn';

const CATEGORY_LABELS: Readonly<Record<ToolCategory, string>> = {
  writing: 'Writing',
  marketing: 'Marketing',
  business: 'Business',
  language: 'Language',
  productivity: 'Productivity',
  calculators: 'Calculators',
  documents: 'Documents',
};

type CategoryFilter = 'all' | ToolCategory;

/** Directory of the tools that are actually switched on in this build. */
export function ToolsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const tools = listToolsByKind('utility').filter((tool) => tool.status === 'live');
  const categories = [...new Set(tools.map((tool) => tool.category))];

  const search = query.trim().toLowerCase();
  const filtered = tools.filter((tool) => {
    if (category !== 'all' && tool.category !== category) return false;
    if (search.length === 0) return true;
    const haystack = `${tool.name} ${tool.summary} ${CATEGORY_LABELS[tool.category]}`.toLowerCase();
    return haystack.includes(search);
  });

  const hasFilters = search.length > 0 || category !== 'all';

  return (
    <Container className="py-8 sm:py-12">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {TOOLS_INDEX_COPY.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {TOOLS_INDEX_COPY.title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">
          {TOOLS_INDEX_COPY.description}
        </p>
      </header>

      <div className="mt-8 space-y-4">
        <div className="sm:max-w-sm">
          <Label htmlFor="tool-search">{TOOLS_INDEX_COPY.searchLabel}</Label>
          <div className="relative mt-1.5">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
              aria-hidden="true"
            />
            <Input
              id="tool-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={TOOLS_INDEX_COPY.searchPlaceholder}
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <div className="flex w-max items-center gap-1.5">
            <FilterChip
              label={TOOLS_INDEX_COPY.allCategories}
              active={category === 'all'}
              onClick={() => setCategory('all')}
            />
            {categories.map((entry) => (
              <FilterChip
                key={entry}
                label={CATEGORY_LABELS[entry]}
                active={category === entry}
                onClick={() => setCategory(entry)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-ink-subtle" role="status" aria-live="polite">
          {filtered.length} of {tools.length} tools
        </p>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              setCategory('all');
            }}
          >
            <X className="size-3.5" aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>

      {filtered.length > 0 ? (
        <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((tool) => (
            <li key={tool.slug} className="h-full">
              <ToolCard tool={tool} />
            </li>
          ))}
        </ul>
      ) : (
        <Card className="mt-3">
          <CardHeader>
            <CardTitle>{TOOLS_INDEX_COPY.emptyTitle}</CardTitle>
            <CardDescription>{TOOLS_INDEX_COPY.emptyBody}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery('');
                setCategory('all');
              }}
            >
              Show every tool
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="mt-8">
        <CardHeader className="gap-2">
          <div className="flex items-center gap-2">
            <Badge tone="brand">
              <Sparkles className="size-3" aria-hidden="true" />
              Next stage
            </Badge>
          </div>
          <CardTitle>{TOOLS_INDEX_COPY.aiNoteTitle}</CardTitle>
          <CardDescription>{TOOLS_INDEX_COPY.aiNoteBody}</CardDescription>
        </CardHeader>
      </Card>

      <Alert tone="info" className="mt-6">
        {TOOLS_INDEX_COPY.privacyNote}
      </Alert>
    </Container>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-9 rounded-pill border px-3.5 text-sm font-medium transition-colors',
        active
          ? 'border-transparent bg-primary text-on-primary'
          : 'border-border bg-surface text-ink-muted hover:border-border-strong hover:text-ink',
      )}
    >
      {label}
    </button>
  );
}
