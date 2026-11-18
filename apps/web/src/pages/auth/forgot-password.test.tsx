import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ForgotPasswordPage } from './forgot-password';
import { renderWithAuth } from '../../test/auth-harness';

describe('ForgotPasswordPage', () => {
  it('validates the email before contacting the provider', async () => {
    const { gateway } = renderWithAuth(<ForgotPasswordPage />);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/^email address/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(gateway.lastResetEmail).toBeNull();
  });

  it('always shows the same neutral confirmation', async () => {
    const { gateway } = renderWithAuth(<ForgotPasswordPage />);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/^email address/i), 'Ada@Example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for that address/i)).toBeInTheDocument();
    expect(gateway.lastResetEmail).toBe('ada@example.com');
  });
});
