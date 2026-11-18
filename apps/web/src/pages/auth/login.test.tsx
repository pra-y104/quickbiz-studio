import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { LoginPage } from './login';
import { AuthFailure } from '../../lib/auth/types';
import { FakeAuthGateway, makeSession, renderWithAuth } from '../../test/auth-harness';

function loginRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<p>dashboard home</p>} />
      <Route path="/profile" element={<p>profile home</p>} />
    </Routes>
  );
}

describe('LoginPage', () => {
  it('requires both fields', async () => {
    renderWithAuth(loginRoutes(), { initialEntries: ['/login'] });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
  });

  it('explains invalid credentials without leaking which field was wrong', async () => {
    const gateway = new FakeAuthGateway();
    gateway.failWith = new AuthFailure('invalid_credentials', 'nope');
    renderWithAuth(loginRoutes(), { gateway, initialEntries: ['/login'] });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/^email address/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'wrong-password-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('That email address and password combination did not work.'),
    ).toBeInTheDocument();
  });

  it('offers a resend when the email is not confirmed', async () => {
    const gateway = new FakeAuthGateway();
    gateway.failSignIn = new AuthFailure('email_not_verified', 'unconfirmed');
    renderWithAuth(loginRoutes(), { gateway, initialEntries: ['/login'] });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/^email address/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'correct-horse-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('button', { name: 'Resend confirmation email' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resend confirmation email' }));
    expect(gateway.resendCalls).toBe(1);
  });

  it('signs in, normalises the email and follows a safe next path', async () => {
    const gateway = new FakeAuthGateway();
    gateway.signUpResult = { status: 'signed_in', session: makeSession() };
    renderWithAuth(loginRoutes(), {
      gateway,
      initialEntries: ['/login?next=%2Fprofile'],
    });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/^email address/i), ' Ada@Example.com ');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'correct-horse-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('profile home')).toBeInTheDocument();
    expect(gateway.lastSignIn?.email).toBe('ada@example.com');
  });

  it('ignores an external next target', async () => {
    const gateway = new FakeAuthGateway();
    gateway.signUpResult = { status: 'signed_in', session: makeSession() };
    renderWithAuth(loginRoutes(), {
      gateway,
      initialEntries: ['/login?next=https%3A%2F%2Fevil.example'],
    });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/^email address/i), 'ada@example.com');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'correct-horse-1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('dashboard home')).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    renderWithAuth(loginRoutes(), { initialEntries: ['/login'] });
    const user = userEvent.setup();

    const password = await screen.findByLabelText(/^password/i, { selector: 'input' });
    expect(password).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
