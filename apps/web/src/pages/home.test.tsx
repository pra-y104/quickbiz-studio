import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { TOOL_SLUGS } from '@quickbiz/shared';
import { HOMEPAGE } from '../content/homepage';
import { HomePage } from './home';

function renderHome() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('Homepage', () => {
  it('leads with a single promise-driven headline', () => {
    renderHome();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toContain(HOMEPAGE.hero.titleLead);
    expect(heading.textContent).toContain(HOMEPAGE.hero.titleAccent);
  });

  it('renders every major section with an accessible heading', () => {
    renderHome();
    for (const section of [
      HOMEPAGE.aiTools.title,
      HOMEPAGE.freeTools.title,
      HOMEPAGE.howItWorks.title,
      HOMEPAGE.pricing.title,
      HOMEPAGE.promise.title,
      HOMEPAGE.trust.title,
      HOMEPAGE.faq.title,
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: section })).toBeInTheDocument();
    }
  });

  it('lists the whole catalogue: eight AI tools and eight free tools', () => {
    renderHome();

    const freeSection = screen.getByRole('region', { name: HOMEPAGE.freeTools.title });
    const aiSection = screen.getByRole('region', { name: HOMEPAGE.aiTools.title });

    expect(within(freeSection).getAllByRole('article')).toHaveLength(8);
    expect(within(aiSection).getAllByRole('article')).toHaveLength(8);
    expect(
      within(freeSection).getByRole('heading', { level: 3, name: 'Invoice Maker' }),
    ).toBeInTheDocument();
    expect(
      within(aiSection).getByRole('heading', { level: 3, name: 'AI Writer' }),
    ).toBeInTheDocument();
  });

  it('offers a search box and category filters', () => {
    renderHome();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });

  it('publishes all eight customer commitments', () => {
    renderHome();
    const section = screen.getByRole('region', { name: HOMEPAGE.promise.title });
    expect(within(section).getAllByRole('listitem')).toHaveLength(8);
  });

  it('answers common questions with native disclosures', () => {
    renderHome();
    for (const item of HOMEPAGE.faq.items) {
      expect(screen.getByText(item.question)).toBeInTheDocument();
    }
  });

  it('filters the tool finder by search', () => {
    renderHome();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'invoice' } });

    const freeSection = screen.getByRole('region', { name: HOMEPAGE.freeTools.title });
    expect(within(freeSection).getAllByRole('article')).toHaveLength(1);
    expect(
      within(freeSection).getByRole('heading', { level: 3, name: 'Invoice Maker' }),
    ).toBeInTheDocument();
  });

  it('shows a real invoice example and states the build position honestly', () => {
    renderHome();
    expect(screen.getByText(/live example/i)).toBeInTheDocument();
    expect(
      screen.getByText(/AI tools and payments are not available in this build/i),
    ).toBeInTheDocument();
    expect(screen.getByText(HOMEPAGE.aiTools.note)).toBeInTheDocument();
  });

  it('links every live free tool to a real route', () => {
    const { container } = renderHome();
    const hrefs = Array.from(container.querySelectorAll('a'))
      .map((anchor) => anchor.getAttribute('href') ?? '')
      .filter((href) => !href.startsWith('https://'));

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      if (href.startsWith('#')) {
        expect(container.querySelector(href)).not.toBeNull();
        continue;
      }

      const allowed =
        href === '/tools' ||
        href === '/register' ||
        href === '/dashboard' ||
        TOOL_SLUGS.some((slug) => href === `/tools/${slug}`);
      expect(allowed).toBe(true);
    }
  });
});
