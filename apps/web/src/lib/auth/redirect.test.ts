import { describe, expect, it } from 'vitest';
import { safeNextPath } from './redirect';

describe('safeNextPath', () => {
  it('accepts in-app paths', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath('/profile?tab=account')).toBe('/profile?tab=account');
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(safeNextPath('https://evil.example')).toBe('/dashboard');
    expect(safeNextPath('//evil.example/path').toString()).toBe('/dashboard');
    expect(safeNextPath('/\\evil.example').toString()).toBe('/dashboard');
    expect(safeNextPath('javascript:alert(1)')).toBe('/dashboard');
    expect(safeNextPath('/javascript:alert(1)')).toBe('/dashboard');
  });

  it('rejects relative strings, control characters and empty values', () => {
    expect(safeNextPath('dashboard')).toBe('/dashboard');
    expect(safeNextPath('/dash\nboard')).toBe('/dashboard');
    expect(safeNextPath('')).toBe('/dashboard');
    expect(safeNextPath(null)).toBe('/dashboard');
    expect(safeNextPath(undefined, '/login')).toBe('/login');
  });

  it('does not bounce a signed-in visitor back to a guest screen', () => {
    expect(safeNextPath('/login')).toBe('/dashboard');
    expect(safeNextPath('/register?next=%2Fprofile')).toBe('/dashboard');
    expect(safeNextPath('/forgot-password')).toBe('/dashboard');
    // A path that merely starts with the same word is still allowed.
    expect(safeNextPath('/login-history')).toBe('/login-history');
  });
});
