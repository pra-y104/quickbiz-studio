import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthCallbackPage } from './callback';
import { FakeAuthGateway, makeSession, renderWithAuth } from '../../test/auth-harness';

describe('AuthCallbackPage', () => {
  it('continues to the dashboard once the confirmation session exists', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    renderWithAuth(
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/dashboard" element={<p>dashboard home</p>} />
      </Routes>,
      { gateway, initialEntries: ['/auth/callback'] },
    );

    expect(await screen.findByText('dashboard home')).toBeInTheDocument();
  });

  it('waits for the session instead of showing an error immediately', () => {
    renderWithAuth(
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
      </Routes>,
      { initialEntries: ['/auth/callback'] },
    );

    expect(screen.getByText('Completing sign in')).toBeInTheDocument();
  });
});
