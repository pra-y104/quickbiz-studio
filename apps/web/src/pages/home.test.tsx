import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';
import { TOOL_SLUGS } from '@quickbiz/shared';
import { HOMEPAGE } from '../content/homepage';
import { HomePage } from './home';

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
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

    const aiSection = screen.getByRole('region', { name: HOMEPAGE.aiTools.title });
    const freeSection = screen.getByRole('region', { name: HOMEPAGE.freeTools.title });

    expect(within(aiSection).getAllByRole('article')).toHaveLength(8);
    expect(within(freeSection).getAllByRole('article')).toHaveLength(8);
    expect(
      within(aiSection).getByRole('heading', { level: 3, name: 'AI Writer' }),
    ).toBeInTheDocument();
    expect(
      within(freeSection).getByRole('heading', { level: 3, name: 'Invoice Maker' }),
    ).toBeInTheDocument();
  });

  it('publishes all eight customer commitments', () => {
    renderHome();
    const section = screen.getByRole('region', { name: HOMEPAGE.promise.title });
    expect(within(section).getAllByRole('listitem')).toHaveLength(8);
  });

  it('answers common questions with native disclosures', () => {
    renderHome();
    expect(screen.getAllByRole('group')).toHaveLength(5);
    expect(screen.getByText(HOMEPAGE.faq.items[0]!.question)).toBeInTheDocument();
  });

  it('labels the hero example and the build state honestly', () => {
    renderHome();
    expect(screen.getByText(/Example of the planned AI Writer screen/i)).toBeInTheDocument();
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

      expect(href === '/tools' || TOOL_SLUGS.some((slug) => href === `/tools/${slug}`)).toBe(true);
    }
  });
});
