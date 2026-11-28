import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DashboardPage } from './dashboard';
import { FakeAuthGateway, makeProfile, makeSession, renderWithAuth } from '../test/auth-harness';

function dashboardRoutes() {
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/login" element={<p>login screen</p>} />
    </Routes>
  );
}

describe('DashboardPage', () => {
  it('greets the account and lists read-only identity values', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    gateway.profile = makeProfile();
    renderWithAuth(dashboardRoutes(), { gateway, initialEntries: ['/dashboard'] });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your account' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('ada@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('user-1')).toBeInTheDocument();
    expect(screen.getAllByText('Email confirmed').length).toBeGreaterThan(0);
  });

  it('asks an unconfirmed account to verify and can resend', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession({ emailConfirmedAt: null }) });
    renderWithAuth(dashboardRoutes(), { gateway, initialEntries: ['/dashboard'] });
    const user = userEvent.setup();

    expect(await screen.findByText('Email not confirmed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Resend confirmation' }));

    expect(gateway.resendCalls).toBe(1);
  });

  it('signs out and returns to the sign-in screen', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    renderWithAuth(dashboardRoutes(), { gateway, initialEntries: ['/dashboard'] });
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: 'Your account' });
    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(await screen.findByText('login screen')).toBeInTheDocument();
    expect(gateway.signOutCalls).toBe(1);
  });

  it('gives the account a real workspace with links to the main areas', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    renderWithAuth(dashboardRoutes(), { gateway, initialEntries: ['/dashboard'] });

    await screen.findByRole('heading', { level: 1, name: 'Your account' });
    expect(screen.getByText('Your workspace')).toBeInTheDocument();
    const workspace = screen.getByRole('region', { name: 'Your workspace' });
    expect(within(workspace).getByRole('link', { name: /All tools/ })).toBeInTheDocument();
    expect(within(workspace).getByRole('link', { name: /Creative Studio/ })).toBeInTheDocument();
    expect(within(workspace).getByRole('link', { name: /Wallet and credits/ })).toBeInTheDocument();
    expect(within(workspace).getByRole('link', { name: /Referrals/ })).toBeInTheDocument();
  });

  it('lets the customer search and open a tool from the dashboard', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    renderWithAuth(dashboardRoutes(), { gateway, initialEntries: ['/dashboard'] });
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: 'Your account' });
    const quick = screen.getByRole('region', { name: 'Quick access' });
    const search = within(quick).getByRole('searchbox', { name: 'Find a tool' });
    await user.type(search, 'invoice');

    const link = within(quick).getByRole('link', { name: /Invoice Maker/ });
    expect(link).toHaveAttribute('href', '/tools/invoice-maker');
    expect(within(quick).queryByRole('link', { name: /Calculator/ })).not.toBeInTheDocument();
  });
});
