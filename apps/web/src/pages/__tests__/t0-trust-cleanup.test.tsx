import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { HomePage } from '../home';
import { SiteFooter } from '../../components/layout/site-footer';

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
      <SiteFooter />
    </MemoryRouter>,
  );
}

/**
 * T0 trust cleanup.
 *
 * These assertions guard the customer-facing surface against reintroducing
 * development language, dead links or claims about a wallet, checkout or refunds
 * that do not exist in this build.
 */
describe('T0 trust and customer-facing cleanup', () => {
  it('has no Design system link in the footer', () => {
    renderPage();
    expect(screen.queryByRole('link', { name: /design system/i })).toBeNull();
    expect(screen.queryByText('Design system')).toBeNull();
  });

  it('has no Preview badge on the AI Writer hero card', () => {
    renderPage();
    expect(screen.queryByText(/^preview$/i)).toBeNull();
  });

  it('has no obsolete preview or build-stage disclaimer', () => {
    renderPage();
    expect(screen.queryByText(/not a live generation/i)).toBeNull();
    expect(screen.queryByText(/interface preview/i)).toBeNull();
    expect(screen.queryByText(/cannot take or process any payment/i)).toBeNull();
    expect(screen.queryByText(/stage 5/i)).toBeNull();
    expect(screen.queryByText(/pre-launch preview/i)).toBeNull();
  });

  it('has no GitHub or source-code links for customers', () => {
    const { container } = renderPage();
    const hrefs = Array.from(container.querySelectorAll('a')).map(
      (anchor) => anchor.getAttribute('href') ?? '',
    );
    expect(hrefs.some((href) => href.includes('github.com'))).toBe(false);
    expect(screen.queryByText(/source code/i)).toBeNull();
    expect(screen.queryByText(/read the source/i)).toBeNull();
  });

  it('makes no claim that a wallet, checkout or refunds are live', () => {
    renderPage();
    expect(screen.queryByText(/stay in your wallet/i)).toBeNull();
    expect(screen.queryByText(/refunded automatically/i)).toBeNull();
    expect(screen.queryByText(/purchased credits/i)).toBeNull();
    expect(screen.queryByText(/price shown at checkout/i)).toBeNull();
    expect(screen.queryByText(/credit balance/i)).toBeNull();
  });

  it('labels AI tools as planned rather than available', () => {
    renderPage();
    const aiSection = screen.getByRole('region', { name: /writing that clears your desk/i });
    expect(aiSection.textContent).toMatch(/planned|not available/i);
    expect(aiSection.textContent).not.toMatch(/generate now|start generating/i);
  });

  it('states the real availability position plainly', () => {
    renderPage();
    expect(
      screen.getByText(/AI tools and payments are not available in this build/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Example of the planned AI Writer screen/i)).toBeInTheDocument();
  });

  it('puts the free tools before the AI tools', () => {
    renderPage();
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent ?? '');

    const freeIndex = headings.findIndex((text) => /everyday utilities, always free/i.test(text));
    const aiIndex = headings.findIndex((text) => /writing that clears your desk/i.test(text));

    expect(freeIndex).toBeGreaterThanOrEqual(0);
    expect(aiIndex).toBeGreaterThan(freeIndex);
  });

  it('does not present the hero example as a live AI call', () => {
    renderPage();
    const figure = screen.getByRole('img', { name: /quickbiz studio/i });
    expect(figure).toBeInTheDocument();
    expect(screen.queryByText(/generate draft/i)).toBeNull();
  });
});
