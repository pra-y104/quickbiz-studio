import { describe, expect, it } from 'vitest';
import { createSentryReporter, parseDsn } from '../monitoring/sentry';

interface FakeCall {
  url: string;
  init: RequestInit;
}

function fakeFetch() {
  const calls: FakeCall[] = [];
  const impl = async (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: input, init: init ?? {} });
    return new Response('{}', { status: 200 });
  };
  return { impl, calls };
}

const DSN = 'https://abc123@sentry.test/42';

describe('parseDsn', () => {
  it('parses a standard DSN', () => {
    expect(parseDsn(DSN)).toEqual({ publicKey: 'abc123', host: 'sentry.test', projectId: '42' });
  });

  it('returns null for a malformed DSN', () => {
    expect(parseDsn('not a url')).toBeNull();
    expect(parseDsn('https://sentry.test/42')).toBeNull(); // no key
  });
});

describe('Sentry reporter (no real network)', () => {
  it('is a no-op when no DSN is configured', () => {
    const reporter = createSentryReporter({ dsn: null });
    expect(reporter.isConfigured()).toBe(false);
    expect(() => reporter.captureException(new Error('x'))).not.toThrow();
  });

  it('posts an event to the store endpoint with the auth header', () => {
    const { impl, calls } = fakeFetch();
    const reporter = createSentryReporter({
      dsn: DSN,
      environment: 'production',
      release: '1.2.3',
      fetchImpl: impl,
    });
    expect(reporter.isConfigured()).toBe(true);

    reporter.captureException(new Error('boom'), { tags: { path: '/api/v1/x' } });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://sentry.test/api/42/store/');
    expect(calls[0]!.init.headers).toMatchObject({
      'X-Sentry-Auth': 'Sentry sentry_version=7, sentry_key=abc123',
    });
    const event = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
    expect(event.message).toBe('boom');
    expect(event.environment).toBe('production');
    expect(event.release).toBe('1.2.3');
  });

  it('redacts secret-like extra fields', () => {
    const { impl, calls } = fakeFetch();
    const reporter = createSentryReporter({ dsn: DSN, fetchImpl: impl });
    reporter.captureException(new Error('x'), {
      extra: { authorization: 'Bearer secret', requestId: 'r1' },
    });
    const event = JSON.parse(String(calls[0]!.init.body)) as { extra?: Record<string, unknown> };
    expect(event.extra).toEqual({ authorization: '[redacted]', requestId: 'r1' });
  });

  it('never throws even if the transport rejects', () => {
    const failing = async () => {
      throw new Error('network down');
    };
    const reporter = createSentryReporter({ dsn: DSN, fetchImpl: failing });
    expect(() => reporter.captureException(new Error('x'))).not.toThrow();
  });
});
