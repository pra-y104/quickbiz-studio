/**
 * Dependency-free Sentry reporter.
 *
 * Sends errors to Sentry's legacy JSON store endpoint using the standard
 * `X-Sentry-Auth` header, so no vendor SDK is bundled. When no DSN is configured
 * the reporter is a no-op: nothing is sent and nothing throws.
 *
 * Redaction: only a curated set of fields is forwarded (message, stack, tags,
 * a small extra context). Secrets, authorization headers and full request bodies
 * are never included.
 */

export interface SentryContext {
  readonly level?: 'error' | 'warning';
  readonly message?: string;
  readonly tags?: Readonly<Record<string, string>>;
  readonly extra?: Readonly<Record<string, unknown>>;
}

export interface SentryReporter {
  /** True when a DSN is configured and events will be delivered. */
  isConfigured(): boolean;
  /** Fire-and-forget capture. Never throws. */
  captureException(error: unknown, context?: SentryContext): void;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface DsnParts {
  readonly publicKey: string;
  readonly host: string;
  readonly projectId: string;
}

/** Parse a Sentry DSN of the form https://<key>@<host>/<projectId>. */
export function parseDsn(dsn: string): DsnParts | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const host = url.host;
    const projectId = url.pathname.replace(/^\//, '').split('/')[0];
    if (!publicKey || !host || !projectId) return null;
    return { publicKey, host, projectId };
  } catch {
    return null;
  }
}

const REDACTED_EXTRA_KEYS = new Set([
  'authorization',
  'cookie',
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'service_role_key',
]);

function redactExtra(extra: SentryContext['extra']): Record<string, unknown> | undefined {
  if (!extra) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    clean[key] = REDACTED_EXTRA_KEYS.has(key.toLowerCase()) ? '[redacted]' : value;
  }
  return clean;
}

function toSentryEvent(error: unknown, context: SentryContext) {
  const message =
    context.message ?? (error instanceof Error ? error.message : String(error ?? 'Unknown error'));
  const stack = error instanceof Error ? error.stack : undefined;
  return {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    level: context.level ?? 'error',
    message,
    ...(stack
      ? {
          exception: {
            values: [
              {
                type: error instanceof Error ? error.name : 'Error',
                value: message,
                stacktrace: {
                  frames: stack.split('\n').map((line) => ({ function: line.trim() })),
                },
              },
            ],
          },
        }
      : {}),
    ...(context.tags ? { tags: context.tags } : {}),
    ...(redactExtra(context.extra) ? { extra: redactExtra(context.extra) } : {}),
  };
}

export function createSentryReporter(options: {
  readonly dsn: string | null;
  readonly environment?: string;
  readonly release?: string;
  readonly fetchImpl?: FetchLike;
}): SentryReporter {
  const parts = options.dsn ? parseDsn(options.dsn) : null;
  const doFetch: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const endpoint = parts ? `https://${parts.host}/api/${parts.projectId}/store/` : null;

  return {
    isConfigured() {
      return endpoint !== null && parts !== null;
    },

    captureException(error, context = {}) {
      if (!endpoint || !parts) return;
      const event = {
        ...toSentryEvent(error, context),
        ...(options.environment ? { environment: options.environment } : {}),
        ...(options.release ? { release: options.release } : {}),
      };
      // Fire-and-forget: monitoring must never break a response or throw.
      void doFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parts.publicKey}`,
        },
        body: JSON.stringify(event),
      }).catch(() => undefined);
    },
  };
}
