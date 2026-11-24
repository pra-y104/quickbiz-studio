import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ArrowLeft, Copy, Download, Sparkles } from 'lucide-react';
import type { AiToolSlug } from '@quickbiz/shared';
import {
  AI_PROMPT_VERSIONS,
  getAiToolLimits,
} from '@quickbiz/shared';
import { HOMEPAGE } from '../../content/homepage';
import { Container } from '../../components/ui/container';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Alert } from '../../components/ui/alert';
import { Textarea } from '../../components/ui/textarea';
import { env } from '../../lib/env';
import { useAuth } from '../../lib/auth/auth-context';

interface RunError {
  readonly code: string;
  readonly message: string;
  readonly requestId?: string;
  readonly details?: readonly { readonly path: string; readonly message: string }[];
}

interface AiToolPageProps {
  readonly slug: AiToolSlug;
}

function errorTitleFor(code: string): string {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 'Please fix the highlighted fields';
    case 'FORBIDDEN':
      return 'Confirm your email address to use AI tools';
    case 'SERVICE_UNAVAILABLE':
      return 'AI generation is not available right now';
    case 'RATE_LIMITED':
      return 'You have used today\'s AI allowance. Try again tomorrow.';
    case 'PROVIDER_ERROR':
      return 'The AI provider could not complete this request';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * AI tool page — wired to `/api/v1/ai/run`.
 *
 * The page is honest about availability: when no provider is configured it shows
 * a disabled generator and explains why. When a provider is configured and the
 * user is signed in, the form calls the run endpoint, validates the response,
 * and shows the structured result with copy and download.
 */
export function AiToolPage({ slug }: AiToolPageProps) {
  const { t } = useTranslation();
  const { session, status, gateway } = useAuth();
  const limits = getAiToolLimits(slug);
  const promptVersion = AI_PROMPT_VERSIONS[slug];

  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ output: unknown; providerId: string; model: string } | null>(null);
  const [error, setError] = useState<{ code: string; message: string; requestId?: string; details?: RunError['details'] } | null>(null);
  const [statusNotice, setStatusNotice] = useState<'checking' | 'available' | 'unavailable' | 'signin-required'>('checking');

  const abortRef = useRef<AbortController | null>(null);

  const isConfigured = statusNotice === 'available';
  const canRun = isConfigured && status === 'ready' && !!session && !!gateway;

  const copyResult = useCallback((): void => {
    const payload = result ? JSON.stringify(result.output, null, 2) : '';
    if (!payload) return;
    void navigator.clipboard.writeText(payload);
    // A real toast would go here; the button label briefly confirms the copy.
  }, [result]);

  const downloadResult = useCallback((): void => {
    if (!result) return;
    const json = JSON.stringify({ tool: slug, output: result.output, provider: result.providerId, model: result.model }, null, 2);
    const bytes = new TextEncoder().encode(json);
    const blob = new Blob([bytes], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug}-result.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [result, slug]);

  const run = useCallback(async (): Promise<void> => {
    if (!canRun) return;
    const token = session ? await gateway.getAccessToken() : null;
    if (!token) {
      setError({ code: 'UNAUTHORIZED', message: 'Sign in to use AI tools.' });
      return;
    }

    abortRef.current = new AbortController();
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${env.apiBaseUrl.replace(/\/$/, '')}/api/v1/ai/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tool: slug, input: { text: input.trim() } }),
        signal: abortRef.current.signal,
      });

      const raw = await response.text();
      let payload: unknown;
      try {
        payload = raw.length > 0 ? JSON.parse(raw) : undefined;
      } catch {
        throw new Error('INVALID_RESPONSE');
      }

      if (!response.ok) {
        const apiError = payload as { error?: { code?: string; message?: string; requestId?: string; details?: unknown } };
        const err = apiError.error ?? {};
        throw new Error(JSON.stringify({
          code: err.code ?? 'UNKNOWN',
          message: err.message ?? 'The request could not be completed.',
          requestId: err.requestId,
          details: err.details,
        }));
      }

      const data = payload as { data?: { output?: unknown; metadata?: { providerId?: string; model?: string } } };
      if (!data.data) {
        throw new Error(JSON.stringify({ code: 'INVALID_RESPONSE', message: 'Unexpected server response.' }));
      }

      setResult({
        output: data.data.output,
        providerId: data.data.metadata?.providerId ?? 'unknown',
        model: data.data.metadata?.model ?? 'unknown',
      });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setError({ code: 'CANCELLED', message: 'The request was cancelled.' });
        return;
      }
      const message = caught instanceof Error ? caught.message : String(caught);
      let parsed: RunError;
      try {
        parsed = JSON.parse(message);
      } catch {
        parsed = { code: 'NETWORK_ERROR', message: 'Could not reach QuickBiz Studio. Check your connection and try again.' };
      }
      setError({
        code: parsed.code,
        message: parsed.message,
        requestId: parsed.requestId,
        details: parsed.details,
      });
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [canRun, session, gateway, slug, input]);

  // Check availability on mount and when session changes.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    (async () => {
      if (cancelledRef.current) return;
      try {
        const response = await fetch(`${env.apiBaseUrl.replace(/\/$/, '')}/api/v1/ai/status`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          if (!cancelledRef.current) setStatusNotice('unavailable');
          return;
        }
        const body = (await response.json()) as { configured?: boolean; reason?: string };
        if (!cancelledRef.current) {
          if (body.configured === true) {
            setStatusNotice(status === 'ready' && session ? 'available' : 'signin-required');
          } else {
            setStatusNotice('unavailable');
          }
        }
      } catch {
        if (!cancelledRef.current) setStatusNotice('unavailable');
      }
    })();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatErrorMessage(message: string, details?: RunError['details']): string {
    const detailText = details?.length
      ? '\n' + details.map((d) => `• ${d.path || '(root)'}: ${d.message}`).join('\n')
      : '';
    return `${message}${detailText}`;
  }

  const isAuthConfigured = env.supabaseUrl !== null && env.supabaseAnonKey !== null;

  return (
    <div className="min-h-dvh bg-canvas">
      <Container className="max-w-3xl py-8 sm:py-12">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t('tools.back')}
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

        {/* Availability banner */}
        {statusNotice === 'checking' ? (
          <Alert tone="info" className="mt-5">
            <p className="text-sm text-ink-muted">Checking AI availability…</p>
          </Alert>
        ) : statusNotice === 'unavailable' ? (
          <Alert tone="warning" title={t('ai.unavailableTitle')} className="mt-5">
            {t('ai.unavailableBody')}
          </Alert>
        ) : statusNotice === 'signin-required' ? (
          <Alert tone="info" title={t('ai.errorSignInRequiredTitle')} className="mt-5">
            {t('ai.errorSignInRequiredBody')}
          </Alert>
        ) : null}

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
                  value={input}
                  onChange={(event) => setInput(event.target.value.slice(0, limits.maxInputChars))}
                  placeholder={t('ai.promptPlaceholder')}
                  aria-describedby="ai-input-hint"
                  disabled={!canRun}
                  className="w-full"
                />
                <span id="ai-input-hint" className="block text-xs text-ink-subtle">
                  {t('ai.inputHint', { max: limits.maxInputChars })}
                </span>
              </label>

              {!canRun ? (
                <div className="flex items-center gap-2">
                  <Button type="button" disabled className="w-full sm:w-auto">
                    <Sparkles className="size-4" aria-hidden="true" />
                    {t('ai.run')}
                  </Button>
                  {statusNotice === 'signin-required' && !isAuthConfigured ? (
                    <span className="text-xs text-ink-subtle">{t('ai.authNotConfigured')}</span>
                  ) : null}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  loading={running}
                  disabled={!input.trim() || running}
                  onClick={run}
                  className="w-full sm:w-auto"
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {running ? t('ai.generating') : t('ai.run')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {error ? (
          <Alert tone="danger" title={errorTitleFor(error.code)} className="mt-5">
            <p className="text-sm text-ink-muted">{formatErrorMessage(error.message, error.details)}</p>
            {error.requestId ? (
              <p className="mt-1 text-xs text-ink-subtle">
                {`${t('ai.requestIdLabel')} ${error.requestId}`}
              </p>
            ) : null}
          </Alert>
        ) : null}

        {result ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">{t('ai.resultTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <pre className="overflow-auto rounded-lg border border-border bg-surface-muted p-3.5 text-sm font-mono text-ink whitespace-pre-wrap break-words max-h-96">
                {typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}
              </pre>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                <span className="text-xs text-ink-subtle">
                  {t('ai.meta', { provider: result.providerId, model: result.model })}
                </span>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyResult}
                    disabled={!result.output}
                  >
                    <Copy className="size-3.5" aria-hidden="true" />
                    {t('ai.copy')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={downloadResult}
                    disabled={!result.output}
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    {t('ai.download')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

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
