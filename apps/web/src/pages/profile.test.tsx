import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ProfilePage } from './profile';
import { FakeAuthGateway, makeProfile, makeSession, renderWithAuth } from '../test/auth-harness';

function setup(profile = makeProfile()) {
  const gateway = new FakeAuthGateway({ session: makeSession() });
  gateway.profile = profile;
  return renderWithAuth(<ProfilePage />, { gateway });
}

describe('ProfilePage', () => {
  it('shows read-only account values next to the editable form', async () => {
    setup();

    expect(await screen.findByDisplayValue('Ada Obi')).toBeInTheDocument();
    expect(screen.getAllByText('ada@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('user-1')).toBeInTheDocument();
    expect(
      screen.getByText(/Your email address and user ID are controlled by authentication/i),
    ).toBeInTheDocument();
  });

  it('sends only the editable columns to the provider', async () => {
    const { gateway } = setup();
    const user = userEvent.setup();

    const name = await screen.findByDisplayValue('Ada Obi');
    await user.clear(name);
    await user.type(name, 'Ada Nwosu');
    await user.type(screen.getByLabelText('Avatar image URL'), 'https://example.com/ada.png');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByText('Profile updated');

    const payload = gateway.lastProfileUpdate;
    expect(payload?.userId).toBe('user-1');
    expect(payload?.input).toEqual({
      displayName: 'Ada Nwosu',
      avatarUrl: 'https://example.com/ada.png',
      preferredLocale: 'en',
    });
    // A crafted request cannot smuggle privileged columns through this screen.
    expect(Object.keys(payload?.input ?? {}).sort()).toEqual([
      'avatarUrl',
      'displayName',
      'preferredLocale',
    ]);
  });

  it('rejects an insecure avatar URL before saving', async () => {
    const { gateway } = setup();
    const user = userEvent.setup();

    await screen.findByDisplayValue('Ada Obi');
    await user.type(screen.getByLabelText('Avatar image URL'), 'http://example.com/a.png');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Use a secure https:// image URL')).toBeInTheDocument();
    expect(gateway.lastProfileUpdate).toBeNull();
  });

  it('rejects a display name that is too short', async () => {
    const { gateway } = setup();
    const user = userEvent.setup();

    const name = await screen.findByDisplayValue('Ada Obi');
    await user.clear(name);
    await user.type(name, 'A');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Use at least 2 characters')).toBeInTheDocument();
    expect(gateway.lastProfileUpdate).toBeNull();
  });

  it('explains a failed read and offers a retry', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    gateway.failProfileFetch = true;
    renderWithAuth(<ProfilePage />, { gateway });

    expect(await screen.findByText(/could not load your profile/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('warns when the email address is not confirmed', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession({ emailConfirmedAt: null }) });
    gateway.profile = makeProfile();
    renderWithAuth(<ProfilePage />, { gateway });

    await screen.findByDisplayValue('Ada Obi');
    await waitFor(() =>
      expect(screen.getByText(/has not confirmed its email address yet/i)).toBeInTheDocument(),
    );
  });
});
