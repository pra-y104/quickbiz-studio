import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import '../../i18n';
import { AccountShell } from './account-shell';
import { ApiRequestError, type ApiClient } from '../../lib/api-client';
import { setAdminClient } from '../../lib/admin/client';
import { clearAdminStatusCache } from '../../lib/admin/use-is-admin';
import { FakeAuthGateway, makeSession, renderWithAuth } from '../../test/auth-harness';

function renderShell() {
  return renderWithAuth(
    <Routes>
      <Route
        path="/dashboard"
        element={
          <AccountShell title="Your account" description="Account shell">
            <p>page body</p>
          </AccountShell>
        }
      />
      <Route path="/admin" element={<p>admin page</p>} />
    </Routes>,
    { gateway: new FakeAuthGateway({ session: makeSession() }), initialEntries: ['/dashboard'] },
  );
}

afterEach(() => {
  clearAdminStatusCache();
});

describe('AccountShell admin navigation', () => {
  it('shows the Admin entry when the server confirms the account is an admin', async () => {
    const adminClient: ApiClient = {
      request: async () => undefined as never,
      get: async () => ({ userId: 'user-1', email: 'ada@example.com' }) as never,
      post: async () => undefined as never,
    };
    setAdminClient(adminClient);
    renderShell();

    const adminLinks = await screen.findAllByRole('link', { name: 'Admin' });
    expect(adminLinks.length).toBeGreaterThan(0);
    expect(adminLinks[0]).toHaveAttribute('href', '/admin');
  });

  it('hides the Admin entry for an ordinary customer (server returns 403)', async () => {
    let calls = 0;
    const customerClient: ApiClient = {
      request: async () => undefined as never,
      get: async () => {
        calls += 1;
        throw new ApiRequestError('FORBIDDEN', 403, 'no access');
      },
      post: async () => undefined as never,
    };
    setAdminClient(customerClient);
    renderShell();

    // Customer navigation is still present.
    expect((await screen.findAllByRole('link', { name: 'Dashboard' })).length).toBeGreaterThan(0);
    // The admin check ran and resolved to non-admin.
    await waitFor(() => expect(calls).toBe(1));
    expect(screen.queryAllByRole('link', { name: 'Admin' }).length).toBe(0);
  });
});
