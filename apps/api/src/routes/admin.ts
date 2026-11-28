import { Hono } from 'hono';
import { AI_TOOL_SLUGS, APP_NAME, APP_TAGLINE, TOOL_CATALOGUE } from '@quickbiz/shared';
import { buildAdapterRegistry } from '../ai/adapters';
import { describeAiAvailability } from '../ai/registry';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { ok } from '../lib/response';
import type { AppContext } from '../types/context';

/**
 * Admin API.
 *
 * Every route requires a verified access token (`requireAuth`) **and** an admin
 * allow-list match (`requireAdmin`). Authorization is enforced here on the
 * server; the frontend route guard is a convenience, never the boundary.
 *
 * Data honesty: this build has no database client wired and the payment ledger
 * is unconfigured, so user, wallet, payment, referral and audit data genuinely
 * do not exist yet. Those sections return `{ available: false, reason }` rather
 * than invented records. Only real, already-computed data (platform meta, the
 * tool catalogue, AI provider status and non-secret settings) is reported as
 * available.
 */
export const adminRoutes = new Hono<AppContext>();

adminRoutes.use('*', requireAuth);
adminRoutes.use('*', requireAdmin);

/** Standard "not yet available" payload for sections without a data source. */
function unavailable(section: string, reason: string) {
  return { section, available: false as const, reason };
}

/** Admin identity, derived from the verified token only. */
adminRoutes.get('/me', (c) => {
  const auth = c.get('auth');
  if (!auth) return ok(c, unavailable('me', 'Not signed in.'));
  return ok(c, {
    userId: auth.userId,
    email: auth.email,
    sessionId: auth.sessionId,
    expiresAt: new Date(auth.expiresAt * 1000).toISOString(),
  });
});

/**
 * Platform overview. Aggregates only real, already-available facts: build meta,
 * the tool catalogue counts and AI availability. No fabricated metrics.
 */
adminRoutes.get('/', (c) => {
  const config = c.get('config');
  const { registry } = buildAdapterRegistry(c.env, config);
  const availability = describeAiAvailability(config, registry);
  const aiTools = TOOL_CATALOGUE.filter((tool) => tool.kind === 'ai');
  const utilityTools = TOOL_CATALOGUE.filter((tool) => tool.kind === 'utility');

  return ok(c, {
    platform: {
      name: APP_NAME,
      tagline: APP_TAGLINE,
      apiVersion: 'v1',
      version: config.appVersion,
      environment: config.environment,
    },
    tools: {
      total: TOOL_CATALOGUE.length,
      live: TOOL_CATALOGUE.filter((tool) => tool.status === 'live').length,
      ai: aiTools.length,
      utility: utilityTools.length,
    },
    ai: {
      configured: availability.configured,
      reason: availability.reason,
      configuredProviders: registry.configured().length,
    },
    // Sections backed by a real data source in this build.
    sections: {
      overview: { available: true },
      tools: { available: true },
      aiProviders: { available: true },
      settings: { available: true },
      // Sections that need a database/service-role that is not wired yet.
      users: unavailable(
        'users',
        'User management needs a database connection that is not configured in this build.',
      ),
      wallets: unavailable(
        'wallets',
        'Wallet monitoring needs the wallet migration and a database connection.',
      ),
      payments: unavailable(
        'payments',
        'Payment records need the payment ledger and database, which are not configured.',
      ),
      referrals: unavailable('referrals', 'Referral tracking is not implemented yet.'),
      auditLogs: unavailable('audit-logs', 'Audit logging is not implemented yet.'),
    },
  });
});

/** Real AI provider status (same source of truth as the public /ai/status). */
adminRoutes.get('/ai-status', (c) => {
  const config = c.get('config');
  const { registry } = buildAdapterRegistry(c.env, config);
  const availability = describeAiAvailability(config, registry);
  const tools = AI_TOOL_SLUGS.map((slug) => {
    const entry = TOOL_CATALOGUE.find((tool) => tool.slug === slug);
    return {
      slug,
      name: entry?.name ?? slug,
      status: entry?.status ?? 'planned',
      creditCost: entry?.creditCost ?? null,
    };
  });

  return ok(c, {
    available: true as const,
    configured: availability.configured,
    reason: availability.reason,
    requestedProvider: availability.requestedProvider,
    model: availability.model,
    providers: registry.configured().map((provider) => ({
      id: provider.id,
      label: provider.label,
      model: provider.defaultModel,
    })),
    tools,
  });
});

/** Real tool catalogue. */
adminRoutes.get('/tools', (c) => {
  return ok(c, {
    available: true as const,
    total: TOOL_CATALOGUE.length,
    tools: TOOL_CATALOGUE.map((tool) => ({
      slug: tool.slug,
      name: tool.name,
      summary: tool.summary,
      category: tool.category,
      kind: tool.kind,
      status: tool.status,
      requiresAuth: tool.requiresAuth,
      creditCost: tool.creditCost,
    })),
  });
});

/**
 * Non-secret platform settings (read-only). No keys, secrets or connection
 * strings are ever returned. Editing settings is not available in this build.
 */
adminRoutes.get('/settings', (c) => {
  const config = c.get('config');
  return ok(c, {
    available: true as const,
    editable: false as const,
    note: 'Read-only view. Changing platform settings requires a deployment change.',
    values: {
      environment: config.environment,
      appVersion: config.appVersion,
      aiRequireVerifiedEmail: config.ai.requireVerifiedEmail,
      rateLimitEnabled: config.rateLimit.enabled,
      rateLimitWindowSeconds: config.rateLimit.windowSeconds,
      rateLimitMaxRequests: config.rateLimit.maxRequests,
      corsAllowedOrigins: config.allowedOrigins.length,
    },
  });
});

// --- Sections without a data source yet: honest "not yet available" states. ---

adminRoutes.get('/users', (c) =>
  ok(
    c,
    unavailable(
      'users',
      'User management needs a database connection that is not configured in this build.',
    ),
  ),
);

adminRoutes.get('/wallets', (c) =>
  ok(
    c,
    unavailable(
      'wallets',
      'Wallet monitoring needs the wallet migration and a database connection.',
    ),
  ),
);

adminRoutes.get('/payments', (c) =>
  ok(
    c,
    unavailable(
      'payments',
      'Payment records need the payment ledger and database, which are not configured.',
    ),
  ),
);

adminRoutes.get('/referrals', (c) =>
  ok(c, unavailable('referrals', 'Referral tracking is not implemented yet.')),
);

adminRoutes.get('/audit-logs', (c) =>
  ok(c, unavailable('audit-logs', 'Audit logging is not implemented yet.')),
);
