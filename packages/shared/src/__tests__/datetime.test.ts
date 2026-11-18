import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatRelativeTime } from '../format/datetime';

describe('date and time formatting', () => {
  it('renders UTC timestamps in the requested time zone', () => {
    const iso = '2026-03-01T12:00:00.000Z';
    expect(formatDateTime(iso, { locale: 'en-GB', timeZone: 'UTC' })).toContain('12:00');
    expect(formatDateTime(iso, { locale: 'en-GB', timeZone: 'Africa/Lagos' })).toContain('13:00');
  });

  it('formats dates without a time component', () => {
    expect(formatDate('2026-03-01T12:00:00.000Z', { locale: 'en-GB' })).toContain('2026');
  });

  it('produces relative time strings', () => {
    const reference = new Date('2026-01-01T03:00:00.000Z');
    expect(formatRelativeTime('2026-01-01T00:00:00.000Z', reference, 'en')).toBe('3 hours ago');
  });

  it('rejects invalid timestamps', () => {
    expect(() => formatDateTime('not-a-date')).toThrow(TypeError);
  });
});
