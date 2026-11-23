import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../lib/logger';

/**
 * The logger must never emit secrets, tokens or full credentials, even when a
 * caller passes them in the structured fields. This guards the redaction list
 * against regressions as new log sites are added.
 */
describe('logger redaction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function capture(): string[] {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => lines.push(line));
    vi.spyOn(console, 'warn').mockImplementation((line: string) => lines.push(line));
    vi.spyOn(console, 'error').mockImplementation((line: string) => lines.push(line));
    return lines;
  }

  it('redacts secret-bearing fields', () => {
    const lines = capture();
    logger.info('test.event', {
      authorization: 'Bearer secret-token',
      api_key: 'sk-live-123',
      password: 'hunter2',
      secret: 'topsecret',
      service_role_key: 'service-role-value',
      token: 'jwt-value',
      // Safe fields pass through unchanged.
      userId: 'user_1',
      requestId: 'req_1',
    });

    const line = lines[0] ?? '';
    expect(line).toContain('[redacted]');
    expect(line).not.toContain('secret-token');
    expect(line).not.toContain('sk-live-123');
    expect(line).not.toContain('hunter2');
    expect(line).not.toContain('topsecret');
    expect(line).not.toContain('service-role-value');
    expect(line).not.toContain('jwt-value');
    expect(line).toContain('user_1');
    expect(line).toContain('req_1');
  });

  it('emits one JSON line per call with level and event', () => {
    const lines = capture();
    logger.warn('ai.run.failed', { requestId: 'req_2', reason: 'timeout' });
    const parsed = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(parsed.level).toBe('warn');
    expect(parsed.event).toBe('ai.run.failed');
    expect(parsed.reason).toBe('timeout');
    expect(typeof parsed.timestamp).toBe('string');
  });
});
