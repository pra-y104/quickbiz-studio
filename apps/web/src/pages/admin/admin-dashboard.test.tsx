import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AdminPage } from './admin-dashboard';
import { ApiRequestError, type ApiClient } from '../../lib/api-client';
import { setAdminClient, type AdminIdentity, type AdminOverview } from '../../lib/admin/client';
import { FakeAuthGateway, makeSession, renderWithAuth } from '../../test/auth-harness';

const IDENTITY: AdminIdentity = {
  userId: 'admin-user-123',
  email: 'owner@quickbiz.test',
  sessionId: 'session-1',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
};

const OVERVIEW: AdminOverview = {
  platform: {
    name: 'QuickBiz Studio',
    tagline: 'Tools',
    apiVersion: 'v1',
    version: '0.1.0',
    environment: 'development',
  },
  tools: { total: 16, live: 8, ai: 8, utility: 8 },
  ai: { configured: false, reason: 'no-adapters-registered', configuredProviders: 0 },
  sections: {
    overview: { available: true },
    tools: { available: true },
    aiProviders: { available: true },
    settings: { available: true },
    users: { available: false },
    wallets: { available: false },
    payments: { available: false },
    referrals: { available: false },
    auditLogs: { available: false },
  },
};

/** Fake admin client resolving from a path map; unknown paths 404. */
function fakeClient(routes: Record<string, unknown>): ApiClient {
  return {
    request: async (path: string) => ({ data: routes[path] }) as never,
    get: async (path: string) => {
      if (path in routes) return routes[path] as never;
      throw new ApiRequestError('NOT_FOUND', 404, 'not found');
    },
    post: async () => undefined as never,
  };
}

/** Client whose every GET fails with the given status (401/403). */
function failingClient(status: 401 | 403): ApiClient {
  return {
    request: async () => undefined as never,
    get: async () => {
      throw new ApiRequestError(status === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED', status, 'nope');
    },
    post: async () => undefined as never,
  };
}

function renderAdmin(section: Parameters<typeof AdminPage>[0]['section']) {
  return renderWithAuth(
    <Routes>
      <Route path="/admin/*" element={<AdminPage section={section} />} />
      <Route path="/login" element={<p>login screen</p>} />
      <Route path="/dashboard" element={<p>customer dashboard</p>} />
    </Routes>,
    { gateway: new FakeAuthGateway({ session: makeSession() }), initialEntries: ['/admin'] },
  );
}

describe('AdminPage', () => {
  it('renders real overview stats and the API-verified identity', async () => {
    setAdminClient(fakeClient({ '/api/v1/admin/me': IDENTITY, '/api/v1/admin': OVERVIEW }));
    renderAdmin('overview');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Admin overview' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('16')).toBeInTheDocument();
    expect((await screen.findAllByText('Live')).length).toBeGreaterThan(0);
    // Identity comes from the API, not the client session.
    expect(screen.getByText(/Signed in as owner@quickbiz\.test/)).toBeInTheDocument();
    expect(screen.getByText(/admin-user-123/)).toBeInTheDocument();
  });

  it('shows an honest "Not yet available" state for user management', async () => {
    setAdminClient(
      fakeClient({
        '/api/v1/admin/me': IDENTITY,
        '/api/v1/admin/users': {
          section: 'users',
          available: false,
          reason:
            'User management needs a database connection that is not configured in this build.',
        },
      }),
    );
    renderAdmin('users');

    expect(await screen.findByRole('heading', { name: 'Not yet available' })).toBeInTheDocument();
    expect(screen.getByText(/needs a database connection/i)).toBeInTheDocument();
  });

  it('shows an access-required state when the server returns 403', async () => {
    setAdminClient(failingClient(403));
    renderAdmin('overview');

    expect(
      await screen.findByRole('heading', { name: 'Admin access required' }),
    ).toBeInTheDocument();
  });

  it('asks the admin to sign in again when the session is not valid (401)', async () => {
    setAdminClient(failingClient(401));
    renderAdmin('overview');

    expect(
      await screen.findByRole('heading', { name: 'Please sign in again' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in again/i })).toHaveAttribute('href', '/login');
  });
});
