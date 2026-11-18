import type { MiddlewareHandler } from 'hono';

/**
 * Baseline hardening for every API response. The API only returns JSON, so the
 * policy can be extremely strict.
 */
export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();

  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // API responses are user-specific or time-sensitive; never cache them at the edge.
  if (!c.res.headers.has('cache-control')) {
    c.header('Cache-Control', 'no-store');
  }
};
