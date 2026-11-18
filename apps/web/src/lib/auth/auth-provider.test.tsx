import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from './auth-provider';
import { useAuth } from './auth-context';
import { AuthFailure } from './types';
import { FakeAuthGateway, makeSession } from '../../test/auth-harness';

function Probe() {
  const { status, session } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{session?.user.email ?? 'none'}</span>
    </div>
  );
}

function renderProvider(gateway: FakeAuthGateway) {
  return render(
    <AuthProvider gateway={gateway}>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthProvider', () => {
  it('starts in loading and settles to ready after restoring a session', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    renderProvider(gateway);

    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    await screen.findByText('ready');
    expect(screen.getByTestId('email')).toHaveTextContent('ada@example.com');
  });

  it('settles to ready with no session when signed out', async () => {
    const gateway = new FakeAuthGateway();
    renderProvider(gateway);

    await screen.findByText('ready');
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });

  it('reports unconfigured instead of faking a session', async () => {
    const gateway = new FakeAuthGateway({ configured: false });
    renderProvider(gateway);

    await screen.findByText('unconfigured');
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });

  it('follows provider auth events in both directions', async () => {
    const gateway = new FakeAuthGateway();
    renderProvider(gateway);
    await screen.findByText('ready');

    act(() => gateway.emit(makeSession({ email: 'new@example.com' })));
    expect(screen.getByTestId('email')).toHaveTextContent('new@example.com');

    act(() => gateway.emit(null));
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });

  it('treats an unreachable auth service as signed out rather than stuck', async () => {
    const gateway = new FakeAuthGateway();
    gateway.failWith = new AuthFailure('network', 'boom');
    // getSession fails once; the provider must still reach a usable state.
    renderProvider(gateway);

    await screen.findByText('ready');
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });
});
