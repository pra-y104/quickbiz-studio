import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HOMEPAGE } from '../content/homepage';
import { HomePage } from './home';

function renderHome() {
  return render(<HomePage />);
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

  it('marks the interface preview and the build state honestly', () => {
    renderHome();
    expect(screen.getByText(/Not a live generation/i)).toBeInTheDocument();
    expect(
      screen.getByText(/AI generation, accounts and payments are not live/i),
    ).toBeInTheDocument();
    expect(screen.getByText(HOMEPAGE.aiTools.note)).toBeInTheDocument();
  });

  it('keeps internal links on anchors that exist, so there are no dead routes', () => {
    const { container } = renderHome();
    const hrefs = Array.from(container.querySelectorAll('a'))
      .map((anchor) => anchor.getAttribute('href') ?? '')
      .filter((href) => !href.startsWith('https://'));

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toMatch(/^#/);
      expect(container.querySelector(href)).not.toBeNull();
    }
  });
});
