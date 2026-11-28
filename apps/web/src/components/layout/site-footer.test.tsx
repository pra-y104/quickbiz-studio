import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from './site-footer';

function renderFooter() {
  return render(
    <MemoryRouter>
      <SiteFooter />
    </MemoryRouter>,
  );
}

describe('SiteFooter', () => {
  it(' keeps customer navigation and legal links', () => {
    renderFooter();
    expect(screen.getByRole('link', { name: 'All free tools' })).toHaveAttribute('href', '/tools');
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toBeInTheDocument();
  });

  it('does not expose a GitHub / source-code link to customers', () => {
    renderFooter();
    // No "Source code" link and no link pointing at the repository.
    expect(screen.queryByRole('link', { name: /source code/i })).not.toBeInTheDocument();
    const githubLinks = document.querySelectorAll('a[href*="github.com"]');
    expect(githubLinks.length).toBe(0);
  });
});
