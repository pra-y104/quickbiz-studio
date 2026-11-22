import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { LEGAL_DOCUMENTS, PLACEHOLDERS, LEGAL_INDEX } from '../../../content/legal';
import { LegalPage } from '../../../components/creative/legal-page';

function renderDocument(slug: string) {
  const doc = LEGAL_DOCUMENTS[slug];
  if (!doc) throw new Error(`missing document ${slug}`);
  return render(
    <MemoryRouter>
      <LegalPage document={doc} />
    </MemoryRouter>,
  );
}

describe('legal documents', () => {
  it('ships the four expected documents', () => {
    expect(LEGAL_INDEX.map((doc) => doc.slug).sort()).toEqual([
      'cookies',
      'privacy',
      'refunds',
      'terms',
    ]);
  });

  it('marks documents that still need owner information as draft', () => {
    expect(LEGAL_DOCUMENTS.privacy?.draft).toBe(true);
    expect(LEGAL_DOCUMENTS.terms?.draft).toBe(true);
    expect(LEGAL_DOCUMENTS.refunds?.draft).toBe(true);
    expect(LEGAL_DOCUMENTS.cookies?.draft).toBe(false);
  });

  it('never contains an invented support address', () => {
    const text = JSON.stringify(LEGAL_INDEX);
    expect(text).not.toMatch(/@gmail|@outlook|@quickbiz\./i);
    expect(text).toContain(PLACEHOLDERS.supportEmail);
  });

  it('shows a draft banner and placeholders verbatim', () => {
    renderDocument('privacy');

    expect(screen.getByText(/draft — owner details pending/i)).toBeInTheDocument();
    expect(screen.getAllByText(/PRIVACY CONTACT/).length).toBeGreaterThan(0);
  });

  it('renders every section heading', () => {
    const doc = LEGAL_DOCUMENTS.terms;
    if (!doc) throw new Error('missing terms');
    renderDocument('terms');

    for (const section of doc.sections) {
      expect(screen.getByRole('heading', { name: section.heading })).toBeInTheDocument();
    }
  });

  it('states that payments are not enabled in the refund policy', () => {
    renderDocument('refunds');
    expect(screen.getByText(/payments are not enabled in this build/i)).toBeInTheDocument();
  });
});
