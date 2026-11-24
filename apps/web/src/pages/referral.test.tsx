import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ReferralDashboardPage } from './referral';
import { FakeAuthGateway, makeSession, renderWithAuth } from '../test/auth-harness';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

describe('ReferralDashboardPage', () => {
  it('renders a referral link derived from the signed-in user ID', async () => {
    const gateway = new FakeAuthGateway({
      session: makeSession({ id: 'user_referral_1', email: 'ada@example.com' }),
    });
    renderWithAuth(<ReferralDashboardPage />, { gateway });
    await waitFor(() => screen.getByText('Your referral link'));

    const link = screen.getByLabelText('Referral link');
    expect(link).toHaveValue('http://localhost:3000/r/user_referral_1');
  });

  it('shows sign-in prompt when no session exists', async () => {
    const gateway = new FakeAuthGateway({ session: null });
    renderWithAuth(<ReferralDashboardPage />, { gateway });
    await waitFor(() =>
      screen.getByText(/Sign in to see your unique referral link and start referring/i),
    );
  });

  it('blocks self-referral when entering own code', async () => {
    const gateway = new FakeAuthGateway({
      session: makeSession({ id: 'user_self_1', email: 'self@example.com' }),
    });
    renderWithAuth(<ReferralDashboardPage />, { gateway });
    await waitFor(() => screen.getByText('Your referral link'));

    const input = screen.getByPlaceholderText(/Paste referral code/i);
    await userEvent.type(input, 'user_self_1');
    await userEvent.click(screen.getByRole('button', { name: /Record referral/i }));

    await waitFor(() =>
      screen.getByText(/You cannot use your own referral code/i),
    );
  });

  it('detects duplicate referral codes from localStorage', async () => {
    const gateway = new FakeAuthGateway({
      session: makeSession({ id: 'user_dup_1', email: 'dup@example.com' }),
    });
    renderWithAuth(<ReferralDashboardPage />, { gateway });
    await waitFor(() => screen.getByText('Your referral link'));

    const input = screen.getByPlaceholderText(/Paste referral code/i);
    await userEvent.type(input, 'ref_code_abc');
    await userEvent.click(screen.getByRole('button', { name: /Record referral/i }));
    await waitFor(() => screen.getByText(/Referral recorded/i));

    // Type the same code again and attempt to record a duplicate
    await userEvent.clear(input);
    await userEvent.type(input, 'ref_code_abc');
    await userEvent.click(screen.getByRole('button', { name: /Record referral/i }));
    await waitFor(() =>
      screen.getByText(/That referral code is already recorded in this browser/i),
    );
  });

  it('records a new referral with pending status', async () => {
    const gateway = new FakeAuthGateway({
      session: makeSession({ id: 'user_new_1', email: 'new@example.com' }),
    });
    renderWithAuth(<ReferralDashboardPage />, { gateway });
    await waitFor(() => screen.getByText('Your referral link'));

    const input = screen.getByPlaceholderText(/Paste referral code/i);
    await userEvent.type(input, 'ref_code_xyz');
    await userEvent.click(screen.getByRole('button', { name: /Record referral/i }));

    await waitFor(() => screen.getByText(/Referral recorded/i));
    // The stats card shows "Pending" as a label; the alert body also contains "pending".
    await waitFor(() => screen.getAllByText(/pending/i));
    expect(screen.getByText(/Total referred/i)).toBeInTheDocument();
  });

  it('copies the referral link to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => ({ writeText }),
    });

    const gateway = new FakeAuthGateway({
      session: makeSession({ id: 'user_copy_1', email: 'copy@example.com' }),
    });
    renderWithAuth(<ReferralDashboardPage />, { gateway });
    await waitFor(() => screen.getByText('Your referral link'));

    const copyButton = screen.getByRole('button', { name: /Copy referral link$/i });
    await userEvent.click(copyButton);

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/r\/user_copy_1/)),
    );
  });

  it('opens WhatsApp sharing URL', async () => {
    const open = vi.fn();
    vi.spyOn(window, 'open').mockImplementation((...args: unknown[]) => {
      open(...args);
      return undefined as unknown as Window;
    });

    const gateway = new FakeAuthGateway({
      session: makeSession({ id: 'user_wa_1', email: 'wa@example.com' }),
    });
    renderWithAuth(<ReferralDashboardPage />, { gateway });
    await waitFor(() => screen.getByText('Your referral link'));

    await userEvent.click(screen.getByRole('button', { name: /WhatsApp/i }));

    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        expect.stringContaining('wa.me/?text='),
        '_blank',
        'noopener,noreferrer',
      ),
    );
  });

  it('disables the Share button when navigator.share is unavailable', async () => {
    const gateway = new FakeAuthGateway({
      session: makeSession({ id: 'user_share_1', email: 'share@example.com' }),
    });
    // Remove navigator.share so the Share button is disabled
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    renderWithAuth(<ReferralDashboardPage />, { gateway });
    await waitFor(() => screen.getByText('Your referral link'));

    expect(
      screen.getByRole('button', { name: /Share$/i }),
    ).toBeDisabled();
  });

  it('shows recent referrals list', async () => {
    // Pre-populate localStorage with a referral where the current user is the referrer.
    localStorage.setItem(
      'quickbiz-referrals',
      JSON.stringify([
        {
          id: 'ref_existing',
          code: 'user_list_1',
          referredAt: new Date().toISOString(),
          status: 'pending',
        },
      ]),
    );

    const gateway = new FakeAuthGateway({
      session: makeSession({ id: 'user_list_1', email: 'list@example.com' }),
    });
    renderWithAuth(<ReferralDashboardPage />, { gateway });
    await waitFor(() => screen.getByText('Your referral link'));

    await waitFor(() => screen.getByText(/recent referrals/i));
    expect(screen.getByText(/Referred list_1…/i)).toBeInTheDocument();
  });
});
