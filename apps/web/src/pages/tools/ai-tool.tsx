import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { AiToolSlug } from '@quickbiz/shared';
import { AI_PROMPT_VERSIONS, getAiToolLimits } from '@quickbiz/shared';
import { HOMEPAGE } from '../../content/homepage';
import { Container } from '../../components/ui/container';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert } from '../../components/ui/alert';
import { Textarea } from '../../components/ui/textarea';

export interface AiToolPageProps {
  readonly slug: AiToolSlug;
}

/**
 * AI tool page — honest about availability.
 *
 * The M4 interface is built and reachable, but the submit path is deliberately
 * disabled: no provider is registered in this build, so no run is ever made.
 * Keeping the page live (rather than a 404) lets customers see what is planned
 * and lets M5 tests exercise the forms without a network call.
 */
export function AiToolPage({ slug }: AiToolPageProps) {
  const { t } = useTranslation();
  const limits = getAiToolLimits(slug);
  const promptVersion = AI_PROMPT_VERSIONS[slug];
  const [text, setText] = useState('');

  return (
    <div className="min-h-dvh bg-canvas">
      <Container className="max-w-3xl py-8 sm:py-12">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All tools
        </Link>

        <header className="mt-3 space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {HOMEPAGE.aiTools.eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
            {HOMEPAGE.aiTools.description}
          </p>
        </header>

        <Alert tone="warning" title={t('ai.unavailableTitle')} className="mt-5">
          {t('ai.unavailableBody')}
        </Alert>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">{t('ai.formTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">{t('ai.prompt')}</span>
                <Textarea
                  rows={6}
                  value={text}
                  onChange={(event) => setText(event.target.value.slice(0, limits.maxInputChars))}
                  placeholder={t('ai.promptPlaceholder')}
                  aria-describedby="ai-input-hint"
                  className="w-full"
                />
                <span id="ai-input-hint" className="block text-xs text-ink-subtle">
                  {t('ai.inputHint', { max: limits.maxInputChars })}
                </span>
              </label>

              <Button type="button" disabled className="w-full sm:w-auto">
                <Sparkles className="size-4" aria-hidden="true" />
                {t('ai.run')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-ink-subtle">
          {t('ai.meta', {
            promptVersion,
            maxInput: limits.maxInputChars,
            maxOutput: limits.maxOutputTokens,
          })}
        </p>
      </Container>
    </div>
  );
}

export default AiToolPage;
