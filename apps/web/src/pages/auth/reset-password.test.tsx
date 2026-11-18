import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ResetPasswordPage } from './reset-password';
import { AuthFailure } from '../../lib/auth/types';
import { FakeAuthGateway, makeSession, renderWithAuth } from '../../test/auth-harness';

describe('ResetPasswordPage', () => {
  it('rejects a link that produced no recovery session', async () => {
    renderWithAuth(<ResetPasswordPage />, { initialEntries: ['/auth/reset-password'] });

    expect(
      await screen.findByRole(
        'heading',
        { name: 'This reset link cannot be used' },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('updates the password when a recovery session exists', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    renderWithAuth(<ResetPasswordPage />, {
      gateway,
      initialEntries: ['/auth/reset-password'],
    });
    const user = userEvent.setup();

    await user.type(
      await screen.findByLabelText(/^password/i, { selector: 'input' }),
      'brand-new-pass-9',
    );
    await user.type(screen.getByLabelText(/^confirm password/i), 'brand-new-pass-9');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument();
    expect(gateway.lastPassword).toBe('brand-new-pass-9');
  });

  it('validates confirmation before calling the provider', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    renderWithAuth(<ResetPasswordPage />, { gateway });
    const user = userEvent.setup();

    await user.type(
      await screen.findByLabelText(/^password/i, { selector: 'input' }),
      'brand-new-pass-9',
    );
    await user.type(screen.getByLabelText(/^confirm password/i), 'something-else-9');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(gateway.lastPassword).toBeNull();
  });

  it('explains a reused password instead of failing silently', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    gateway.failPasswordUpdate = new AuthFailure('same_password', 'reused');
    renderWithAuth(<ResetPasswordPage />, { gateway });
    const user = userEvent.setup();

    await user.type(
      await screen.findByLabelText(/^password/i, { selector: 'input' }),
      'brand-new-pass-9',
    );
    await user.type(screen.getByLabelText(/^confirm password/i), 'brand-new-pass-9');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(
      await screen.findByText('Choose a password you have not used on this account before.'),
    ).toBeInTheDocument();
  });
});
