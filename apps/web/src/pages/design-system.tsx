import { Inbox, Plus } from 'lucide-react';
import { getToolBySlug } from '@quickbiz/shared';
import type { ReactNode } from 'react';
import { Alert } from '../components/ui/alert';
import { Badge, type BadgeTone } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Container } from '../components/ui/container';
import { Field } from '../components/ui/field';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Spinner } from '../components/ui/spinner';
import { Textarea } from '../components/ui/textarea';
import { Disclosure } from '../components/ui/disclosure';
import { ToolCard } from '../components/marketing/tool-card';

const BRAND_SWATCHES = [
  { name: 'brand-100', className: 'bg-brand-100' },
  { name: 'brand-300', className: 'bg-brand-300' },
  { name: 'brand-500', className: 'bg-brand-500' },
  { name: 'brand-600', className: 'bg-brand-600' },
  { name: 'brand-700', className: 'bg-brand-700' },
  { name: 'brand-900', className: 'bg-brand-900' },
  { name: 'brand-950', className: 'bg-brand-950' },
];

const SEMANTIC_SWATCHES = [
  { name: 'canvas', className: 'bg-canvas' },
  { name: 'surface', className: 'bg-surface' },
  { name: 'surface-muted', className: 'bg-surface-muted' },
  { name: 'border', className: 'bg-border' },
  { name: 'ink', className: 'bg-ink' },
  { name: 'ink-muted', className: 'bg-ink-muted' },
  { name: 'primary', className: 'bg-primary' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'success', className: 'bg-success' },
  { name: 'warning', className: 'bg-warning' },
  { name: 'danger', className: 'bg-danger' },
];

const BADGE_TONES: readonly BadgeTone[] = [
  'neutral',
  'brand',
  'accent',
  'success',
  'warning',
  'danger',
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-5 border-t border-border py-10 first:border-t-0 first:pt-0">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function DesignSystemPage() {
  const sampleTool = getToolBySlug('ai-writer');

  return (
    <Container className="py-12 sm:py-16">
      <header className="max-w-2xl">
        <Badge tone="brand">Internal reference</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Design system
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted sm:text-base">
          The shared language for every QuickBiz Studio screen: colour, type, spacing, controls and
          feedback states. Use the theme switch in the header to review both themes.
        </p>
      </header>

      <div className="mt-10">
        <Section
          title="Colour"
          description="Brand violet carries primary actions. Electric blue is a restrained accent. Neutral surfaces keep long tool sessions calm."
        >
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-subtle">
                Brand scale
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {BRAND_SWATCHES.map((swatch) => (
                  <div key={swatch.name} className="space-y-1.5">
                    <div className={`h-14 rounded-lg border border-border ${swatch.className}`} />
                    <p className="text-[11px] text-ink-subtle">{swatch.name}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-subtle">
                Semantic tokens
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {SEMANTIC_SWATCHES.map((swatch) => (
                  <div key={swatch.name} className="space-y-1.5">
                    <div className={`h-12 rounded-lg border border-border ${swatch.className}`} />
                    <p className="text-[11px] text-ink-subtle">{swatch.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Typography"
          description="One neutral sans-serif family, a tight display scale and generous body line height for readability on small screens."
        >
          <Card>
            <CardContent className="space-y-5 pt-5">
              <p className="text-4xl font-semibold tracking-tight text-ink">Display / 36</p>
              <p className="text-2xl font-semibold tracking-tight text-ink">Heading / 24</p>
              <p className="text-lg font-medium text-ink">Subheading / 18</p>
              <p className="text-sm leading-relaxed text-ink-muted">
                Body / 14 - The quick brown fox jumps over the lazy dog. Numbers stay tabular in
                tables and invoices so figures align vertically.
              </p>
              <p className="text-xs text-ink-subtle">Caption / 12 - supporting and meta text.</p>
            </CardContent>
          </Card>
        </Section>

        <Section
          title="Buttons"
          description="One primary action per view. Variants are structural, not decorative. Loading states block duplicate submits."
        >
          <Card>
            <CardContent className="space-y-6 pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">
                  <Plus className="size-4" aria-hidden="true" />
                  Large
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button loading>Working</Button>
                <Button disabled>Disabled</Button>
                <Button variant="outline" asChild>
                  <a href="#buttons">Rendered as a link</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Section>

        <Section
          title="Form controls"
          description="Labels are always visible, hints explain expectations, and errors are announced to screen readers."
        >
          <Card>
            <CardContent className="grid gap-6 pt-5 sm:grid-cols-2">
              <Field label="Business name" htmlFor="ds-name" hint="Shown on your invoice header.">
                <Input id="ds-name" placeholder="Adeyemi Ventures" />
              </Field>
              <Field
                label="Email address"
                htmlFor="ds-email"
                error="Enter a valid email address."
                required
              >
                <Input id="ds-email" aria-invalid="true" aria-describedby="ds-email-error" />
              </Field>
              <Field
                label="What should the tool write?"
                htmlFor="ds-brief"
                className="sm:col-span-2"
                hint="Be specific about audience, tone and length."
              >
                <Textarea
                  id="ds-brief"
                  placeholder="A polite reminder to a client about an unpaid invoice..."
                />
              </Field>
            </CardContent>
          </Card>
        </Section>

        <Section
          title="Feedback and states"
          description="Every async surface needs loading, empty, error and success states. These are the shared building blocks."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Alerts</CardTitle>
                <CardDescription>Inline messages that explain what happened.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Alert tone="info" title="Credits cost 2 per generation">
                  The cost is shown before you submit.
                </Alert>
                <Alert tone="success" title="Saved">
                  Your result was saved to your account.
                </Alert>
                <Alert tone="warning" title="Free allowance low">
                  You have 3 free credits left.
                </Alert>
                <Alert tone="danger" title="Generation failed">
                  Credits were returned automatically.
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Badges and loaders</CardTitle>
                <CardDescription>Tone encodes meaning, never decoration.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  {BADGE_TONES.map((tone) => (
                    <Badge key={tone} tone={tone}>
                      {tone}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <Spinner className="size-5 text-primary" label="Loading" />
                  <span className="text-sm text-ink-muted">Loading state</span>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Empty state</CardTitle>
                <CardDescription>
                  Empty screens explain the next useful action instead of showing blank space.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-muted/50 px-6 py-10 text-center">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-surface text-ink-muted">
                    <Inbox className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-medium text-ink">No saved results yet</p>
                  <p className="mt-1 max-w-sm text-sm text-ink-muted">
                    Results you save will appear here, ready to reuse or download.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </Section>
        <Section
          title="Marketing primitives"
          description="Homepage blocks compose the base tokens rather than introducing new styles."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {sampleTool ? <ToolCard tool={sampleTool} /> : null}
            <div className="space-y-3">
              <Disclosure
                question="Do free tools need an account?"
                answer="No. Everyday utilities are designed to work without signing up."
              />
              <Disclosure
                question="What is a credit?"
                answer="A unit of paid AI usage. The cost is shown before every run."
              />
            </div>
          </div>
        </Section>
      </div>
    </Container>
  );
}
