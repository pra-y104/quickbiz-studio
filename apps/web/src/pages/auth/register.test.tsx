import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RegisterPage } from './register';
import { AuthFailure } from '../../lib/auth/types';
import { FakeAuthGateway, renderWithAuth } from '../../test/auth-harness';

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/^email address/i), '  Ada@Example.com ');
  await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'correct-horse-1');
  await user.type(screen.getByLabelText(/^confirm password/i), 'correct-horse-1');
  await user.click(screen.getByRole('checkbox'));
}

describe('RegisterPage', () => {
  it('blocks submission with accessible field errors', async () => {
    const { gateway } = renderWithAuth(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/^email address/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'short1');
    await user.type(screen.getByLabelText(/^confirm password/i), 'short1');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Use at least 10 characters')).toBeInTheDocument();
    expect(
      screen.getByText('You need to accept the terms to create an account'),
    ).toBeInTheDocument();
    expect(gateway.lastSignUp).toBeNull();
  });

  it('reports mismatched passwords on the confirmation field', async () => {
    renderWithAuth(<RegisterPage />);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/^email address/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'correct-horse-1');
    await user.type(screen.getByLabelText(/^confirm password/i), 'different-horse-1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
  });

  it('sends a verification result without revealing whether the address existed', async () => {
    const { gateway } = renderWithAuth(<RegisterPage />);
    const user = userEvent.setup();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(gateway.lastSignUp?.email).toBe('ada@example.com');
    expect(gateway.lastSignUp?.emailRedirectTo).toContain('/auth/callback');
  });

  it('offers to resend the confirmation email', async () => {
    const { gateway } = renderWithAuth(<RegisterPage />);
    const user = userEvent.setup();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await screen.findByRole('heading', { name: 'Check your inbox' });

    await user.click(screen.getByRole('button', { name: 'Send the confirmation email again' }));
    await waitFor(() => expect(gateway.resendCalls).toBe(1));
  });

  it('shows the configuration notice and disables the form without Supabase', async () => {
    renderWithAuth(<RegisterPage />, { gateway: new FakeAuthGateway({ configured: false }) });

    expect(
      await screen.findByText('Authentication is not configured in this build'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^email address/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  });

  it('shows a typed failure when the provider rejects the signup', async () => {
    const gateway = new FakeAuthGateway();
    gateway.failWith = new AuthFailure('rate_limited', 'slow down');
    renderWithAuth(<RegisterPage />, { gateway });
    const user = userEvent.setup();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('Too many attempts. Wait a moment before trying again.'),
    ).toBeInTheDocument();
  });
});
