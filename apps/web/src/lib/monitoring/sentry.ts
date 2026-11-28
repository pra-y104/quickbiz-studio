/**
 * Dependency-free browser error monitoring.
 *
 * When `VITE_SENTRY_DSN` is set, uncaught errors and unhandled rejections are
 * forwarded to Sentry's store endpoint. When it is not set, nothing is installed
 * and nothing is sent — the app behaves exactly as before.
 *
 * Only the public DSN (safe to expose) is used. No secrets, tokens or user data
 * are attached; the error message and stack are forwarded with a small context.
 */

import { env } from '../env';

interface DsnParts {
  readonly publicKey: string;
  readonly host: string;
  readonly projectId: string;
}

function parseDsn(dsn: string): DsnParts | null {
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

let parts: DsnParts | null = null;
let initialised = false;

function toEvent(error: unknown, message?: string) {
  const msg =
    message ?? (error instanceof Error ? error.message : String(error ?? 'Unknown error'));
  const stack = error instanceof Error ? error.stack : undefined;
  return {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    level: 'error',
    message: msg,
    ...(stack
      ? {
          exception: {
            values: [
              {
                type: error instanceof Error ? error.name : 'Error',
                value: msg,
                stacktrace: {
                  frames: stack.split('\n').map((line) => ({ function: line.trim() })),
                },
              },
            ],
          },
        }
      : {}),
    tags: { source: 'browser' },
  };
}

function send(event: ReturnType<typeof toEvent>): void {
  if (!parts) return;
  const endpoint = `https://${parts.host}/api/${parts.projectId}/store/`;
  const body = JSON.stringify(event);
  const headers = {
    'Content-Type': 'application/json',
    'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parts.publicKey}`,
  };
  // sendBeacon survives page unload; fall back to keepalive fetch.
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const queued = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    if (queued) return;
  }
  void fetch(endpoint, { method: 'POST', headers, body, keepalive: true }).catch(() => undefined);
}

/** Install global error handlers once. Safe to call repeatedly. */
export function initMonitoring(): void {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;

  const dsn = env.sentryDsn;
  parts = dsn ? parseDsn(dsn) : null;
  if (!parts) return;

  window.addEventListener('error', (event) => {
    send(toEvent(event.error, event.message));
  });
  window.addEventListener('unhandledrejection', (event) => {
    send(toEvent(event.reason));
  });
}

/** Manually capture an error. No-op when monitoring is not configured. */
export function captureException(error: unknown, message?: string): void {
  if (!parts) return;
  send(toEvent(error, message));
}

/** True when a DSN is configured and handlers are active. */
export function isMonitoringConfigured(): boolean {
  return parts !== null;
}
