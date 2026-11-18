import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { VerifyEmailPage } from './verify-email';
import { FakeAuthGateway, renderWithAuth } from '../../test/auth-harness';

describe('VerifyEmailPage', () => {
  it('prefills the address from the query and resends confirmation', async () => {
    const gateway = new FakeAuthGateway();
    renderWithAuth(<VerifyEmailPage />, {
      gateway,
      initialEntries: ['/verify-email?email=ada%40example.com'],
    });
    const user = userEvent.setup();

    expect(await screen.findByDisplayValue('ada@example.com')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send the link again' }));

    expect(await screen.findByText(/a new link is on its way/i)).toBeInTheDocument();
    expect(gateway.resendCalls).toBe(1);
  });

  it('asks for an address when none is known', async () => {
    const gateway = new FakeAuthGateway();
    renderWithAuth(<VerifyEmailPage />, { gateway, initialEntries: ['/verify-email'] });
    const user = userEvent.setup();

    await screen.findByRole('button', { name: 'Send the link again' });
    await user.click(screen.getByRole('button', { name: 'Send the link again' }));

    expect(
      await screen.findByText('Enter the email address you registered with'),
    ).toBeInTheDocument();
    expect(gateway.resendCalls).toBe(0);
  });
});
