import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { WalletPage } from './wallet';
import { RequireAuth } from '../components/auth/route-guards';
import { FakeAuthGateway, makeSession, renderWithAuth } from '../test/auth-harness';

function walletRoutes() {
  return (
    <Routes>
      <Route
        path="/wallet"
        element={
          <RequireAuth>
            <WalletPage />
          </RequireAuth>
        }
      />
      <Route path="/login" element={<p>login screen</p>} />
    </Routes>
  );
}

describe('WalletPage', () => {
  it('redirects a signed-out visitor to sign in', async () => {
    const gateway = new FakeAuthGateway({ session: null });
    renderWithAuth(walletRoutes(), { gateway, initialEntries: ['/wallet'] });

    expect(await screen.findByText('login screen')).toBeInTheDocument();
  });

  it('shows an honest error when Supabase is not configured', async () => {
    // The sandbox has no VITE_SUPABASE_* values, so the wallet client cannot
    // reach a database. The page must say so rather than invent a balance.
    const gateway = new FakeAuthGateway({ session: makeSession() });
    renderWithAuth(walletRoutes(), { gateway, initialEntries: ['/wallet'] });

    expect(
      await screen.findByText(/could not load your wallet|not available/i),
    ).toBeInTheDocument();
    // No fabricated currency figure is rendered.
    expect(screen.queryByText(/^\$\d/)).toBeNull();
  });
});
