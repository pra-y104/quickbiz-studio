import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AdminPage } from './admin-dashboard';
import { ApiRequestError } from '../../lib/api-client';
import { setAdminClient, type AdminOverview } from '../../lib/admin/client';
import type { ApiClient } from '../../lib/api-client';
import { FakeAuthGateway, makeSession, renderWithAuth } from '../../test/auth-harness';

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

/** Build a fake admin client whose `get` resolves from a path map or throws. */
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

function renderAdmin(section: Parameters<typeof AdminPage>[0]['section']) {
  return renderWithAuth(
    <Routes>
      <Route path="/admin/*" element={<AdminPage section={section} />} />
      <Route path="/dashboard" element={<p>customer dashboard</p>} />
    </Routes>,
    { gateway: new FakeAuthGateway({ session: makeSession() }), initialEntries: ['/admin'] },
  );
}

describe('AdminPage', () => {
  it('renders real overview stats and section availability', async () => {
    setAdminClient(fakeClient({ '/api/v1/admin': OVERVIEW }));
    renderAdmin('overview');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Admin overview' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('16')).toBeInTheDocument();
    expect((await screen.findAllByText('Live')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Soon')).length).toBeGreaterThan(0);
  });

  it('shows an honest "Not yet available" state for user management', async () => {
    setAdminClient(
      fakeClient({
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
    setAdminClient(
      fakeClient({
        // No route -> but we need a 403, so override get for the overview path.
      }),
    );
    const forbidden: ApiClient = {
      request: async () => undefined as never,
      get: async () => {
        throw new ApiRequestError('FORBIDDEN', 403, 'no access');
      },
      post: async () => undefined as never,
    };
    setAdminClient(forbidden);
    renderAdmin('overview');

    expect(
      await screen.findByRole('heading', { name: 'Admin access required' }),
    ).toBeInTheDocument();
  });
});
