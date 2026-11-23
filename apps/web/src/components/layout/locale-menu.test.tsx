import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LocaleMenu } from './locale-menu';
import { LocaleProvider } from '../../lib/locale/locale-provider';

function renderMenu() {
  return render(
    <LocaleProvider>
      <LocaleMenu />
    </LocaleProvider>,
  );
}

describe('LocaleMenu', () => {
  it('shows the active language and currency', () => {
    renderMenu();
    expect(screen.getAllByText('English').length).toBeGreaterThan(0);
    expect(screen.getAllByText('USD').length).toBeGreaterThan(0);
  });

  it('lists planned languages as disabled with a Soon label', () => {
    renderMenu();
    const yoruba = screen.getByRole('button', { name: /Yoruba/ });
    expect(yoruba).toBeDisabled();
    expect(screen.getAllByText('Soon').length).toBeGreaterThan(0);
  });

  it('switches the display currency', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole('button', { name: 'NGN' }));
    expect(screen.getAllByText('NGN').length).toBeGreaterThan(0);
  });
});
