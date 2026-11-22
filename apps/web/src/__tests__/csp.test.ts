import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Content Security Policy regression tests.
 *
 * These run against the committed Pages header file and the HTML shell. They do not
 * prove behaviour in a deployed browser — only a preview deployment can do that —
 * but they do prove the policy cannot silently lose a required directive.
 */

const root = resolve(__dirname, '../..');

function readHeaders(): Map<string, string> {
  const text = readFileSync(resolve(root, 'public/_headers'), 'utf8');
  const headers = new Map<string, string>();

  for (const line of text.split('\n')) {
    const match = /^\s{2}([A-Za-z0-9-]+):\s*(.+?)\s*$/.exec(line);
    if (match) headers.set(match[1]!.toLowerCase(), match[2]!);
  }

  return headers;
}

function directives(policy: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of policy.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    const name = tokens.shift();
    if (name) map.set(name.toLowerCase(), tokens);
  }
  return map;
}

describe('Content Security Policy (web)', () => {
  const headers = readHeaders();
  const policy = headers.get('content-security-policy');

  it('is present and parses into directives', () => {
    expect(policy).toBeDefined();
    const map = directives(policy!);
    expect(map.size).toBeGreaterThan(8);
    expect(map.get('default-src')).toEqual(["'self'"]);
  });

  it('does not allow inline or evaluated scripts', () => {
    const script = directives(policy!).get('script-src') ?? [];
    expect(script).toContain("'self'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(script).not.toContain("'unsafe-eval'");
  });

  it('locks down framing, objects and base URLs', () => {
    const map = directives(policy!);
    expect(map.get('frame-ancestors')).toEqual(["'none'"]);
    expect(map.get('object-src')).toEqual(["'none'"]);
    expect(map.get('base-uri')).toEqual(["'none'"]);
  });

  it('allows local image sources used by uploads and previews', () => {
    const images = directives(policy!).get('img-src') ?? [];
    expect(images).toContain("'self'");
    expect(images).toContain('data:');
    expect(images).toContain('blob:');
  });

  it('allows Supabase for authentication but nothing else remote', () => {
    const connect = directives(policy!).get('connect-src') ?? [];
    expect(connect).toContain("'self'");
    expect(connect.some((source) => source.includes('supabase.co'))).toBe(true);
    expect(connect.some((source) => source.startsWith('http://'))).toBe(false);
  });

  it('permits the microphone for this origin, because Translator dictation needs it', () => {
    const permissions = headers.get('permissions-policy') ?? '';
    expect(permissions).toContain('microphone=(self)');
    expect(permissions).toContain('camera=()');
  });

  it('keeps the usual hardening headers', () => {
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('referrer-policy')).toBe('no-referrer');
    expect(headers.get('strict-transport-security')).toContain('max-age=31536000');
  });
});

describe('HTML shell (CSP compatibility)', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');

  it('has no inline script blocks', () => {
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
    expect(inline).toHaveLength(0);
  });

  it('has no inline event handler attributes', () => {
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it('loads the theme bootstrap from a same-origin file', () => {
    expect(html).toContain('src="/theme-init.js"');
  });
});
