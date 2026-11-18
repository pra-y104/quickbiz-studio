import { ArrowRight, Database, Layers, Palette, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { APP_TAGLINE } from '@quickbiz/shared';
import { env } from '../lib/env';
import { Alert } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Container } from '../components/ui/container';

interface FoundationItem {
  readonly title: string;
  readonly body: string;
  readonly icon: ReactNode;
  readonly state: 'done' | 'next';
}

const FOUNDATIONS: readonly FoundationItem[] = [
  {
    title: 'Design system',
    body: 'Semantic colour tokens, type scale, spacing and accessible primitives for every future screen.',
    icon: <Palette className="size-4" />,
    state: 'done',
  },
  {
    title: 'Secure API foundation',
    body: 'Typed routes, validation, request logging, rate limiting, CORS and a single error boundary.',
    icon: <ShieldCheck className="size-4" />,
    state: 'done',
  },
  {
    title: 'Shared contracts',
    body: 'One Zod schema set and tool catalogue used by both the browser and the server.',
    icon: <Layers className="size-4" />,
    state: 'done',
  },
  {
    title: 'Data layer',
    body: 'Migration workflow and row-level security conventions are documented and ready for Stage 4.',
    icon: <Database className="size-4" />,
    state: 'next',
  },
];

const NEXT_STEPS: readonly string[] = [
  'Stage 3 - Brand identity, homepage and navigation',
  'Stage 4 - Accounts, verification and dashboard',
  'Stage 5 - Ordinary tools that work without credits',
  'Stage 6 - AI tools behind a real provider adapter',
];

export function HomePage() {
  const { t } = useTranslation();

  return (
    <>
      <section className="qb-ambient border-b border-border">
        <Container className="py-16 sm:py-20 lg:py-28">
          <div className="max-w-3xl">
            <Badge tone="brand">{t('home.eyebrow')}</Badge>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.06] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              {t('home.title')}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
              {t('home.subtitle')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg">
                <Link to="/design-system">
                  {t('home.primaryCta')}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <span className="text-sm text-ink-subtle">
                Build v{env.appVersion} &middot; {APP_TAGLINE}
              </span>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-border py-14 sm:py-16">
        <Container>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                {t('home.statusTitle')}
              </h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                Everything below is implemented and tested in this build.
              </p>
            </div>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FOUNDATIONS.map((item) => (
              <Card key={item.title} className="h-full">
                <CardHeader>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      {item.icon}
                    </span>
                    <Badge tone={item.state === 'done' ? 'success' : 'neutral'}>
                      {item.state === 'done' ? t('status.done') : t('status.planned')}
                    </Badge>
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-14 sm:py-16">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                {t('home.nextTitle')}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
                Each stage is reviewed and tested on a real phone before the next one starts.
              </p>
              <Alert tone="info" className="mt-6">
                {t('home.honesty')}
              </Alert>
            </div>

            <ol className="space-y-3">
              {NEXT_STEPS.map((step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-4 rounded-card border border-border bg-surface p-4"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-ink-muted">
                    {index + 3}
                  </span>
                  <span className="text-sm text-ink">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>
    </>
  );
}
