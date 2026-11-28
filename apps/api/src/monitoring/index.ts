/**
 * Monitoring registry.
 *
 * Resolves a Sentry reporter from environment, or a no-op reporter when no DSN
 * is configured. Kept separate from the transport so the error boundary can
 * report without importing vendor code.
 */

import type { Bindings } from '../config/env';
import { createSentryReporter, type SentryReporter } from './sentry';

const NOOP_REPORTER: SentryReporter = {
  isConfigured: () => false,
  captureException: () => undefined,
};

export function resolveSentryReporter(bindings: Bindings): SentryReporter {
  const dsn = bindings.SENTRY_DSN?.trim();
  if (!dsn) return NOOP_REPORTER;
  return createSentryReporter({
    dsn,
    environment: bindings.SENTRY_ENVIRONMENT?.trim() || bindings.ENVIRONMENT,
    release: bindings.SENTRY_RELEASE?.trim() || bindings.APP_VERSION,
  });
}

export type { SentryReporter, SentryContext } from './sentry';
