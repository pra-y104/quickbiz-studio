import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import '../../i18n';
import { SiteHeader } from './site-header';

function renderHeader() {
  return render(
    <MemoryRouter>
      <SiteHeader />
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.documentElement.dataset.theme = 'light';
});

describe('SiteHeader', () => {
  it('shows the primary navigation and the pre-launch notice', () => {
    renderHeader();
    const header = screen.getByRole('banner');

    expect(within(header).getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByText(/Pre-launch preview/i)).toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Pricing' })).toHaveAttribute(
      'href',
      '#pricing',
    );
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
