import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import '../../i18n';
import { SiteHeader } from './site-header';
import { FakeAuthGateway, makeSession, renderWithAuth } from '../../test/auth-harness';

function renderHeader(gateway = new FakeAuthGateway()) {
  return renderWithAuth(<SiteHeader />, { gateway });
}

afterEach(() => {
  document.documentElement.dataset.theme = 'light';
});

describe('SiteHeader', () => {
  it('shows the primary navigation, account actions and the pre-launch notice', async () => {
    renderHeader();
    const header = screen.getByRole('banner');

    expect(within(header).getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByText(/Free everyday tools are live/i)).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Tools' })).toHaveAttribute('href', '/tools');
    expect(within(header).getByRole('link', { name: 'Pricing' })).toHaveAttribute(
      'href',
      '#pricing',
    );
    expect(await within(header).findByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('swaps the account action for a dashboard link when signed in', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    renderHeader(gateway);

    expect(await screen.findByRole('link', { name: /dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('opens and closes the mobile navigation dialog', async () => {
    renderHeader();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('navigation', { name: 'Mobile' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('link', { name: 'AI tools' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes the mobile dialog with Escape', async () => {
    renderHeader();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    await screen.findByRole('dialog');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('switches the colour theme', async () => {
    renderHeader();
    const user = userEvent.setup();
    const toggle = screen.getByRole('button', { name: 'Toggle colour theme' });

    expect(document.documentElement.dataset.theme).toBe('light');
    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
