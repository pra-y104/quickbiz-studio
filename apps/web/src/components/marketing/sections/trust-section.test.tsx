import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TrustSection } from './trust-section';

function renderTrust() {
  return render(
    <MemoryRouter>
      <TrustSection />
    </MemoryRouter>,
  );
}

describe('TrustSection', () => {
  it('keeps the trust commitments without a developer source link', () => {
    renderTrust();
    expect(
      screen.getByText(/engineering commitments rather than marketing claims/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /read the source/i })).not.toBeInTheDocument();
    expect(document.querySelectorAll('a[href*="github.com"]').length).toBe(0);
  });
});
