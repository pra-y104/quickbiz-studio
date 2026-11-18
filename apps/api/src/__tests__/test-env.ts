import type { Bindings } from '../config/env';

/** Deterministic environment bindings for tests (no real secrets). */
export function testEnv(overrides: Bindings = {}): Bindings {
  return {
    ENVIRONMENT: 'development',
    APP_VERSION: '0.1.0',
    ALLOWED_ORIGINS: 'http://localhost:5173',
    RATE_LIMIT_ENABLED: 'false',
    RATE_LIMIT_WINDOW_SECONDS: '60',
    RATE_LIMIT_MAX_REQUESTS: '120',
    ...overrides,
  };
}
