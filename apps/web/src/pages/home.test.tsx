import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import '../i18n';
import { HomePage } from './home';

function renderPage() {
  const router = createMemoryRouter([{ path: '/', element: <HomePage /> }]);
  return render(<RouterProvider router={router} />);
}

describe('HomePage (foundation build)', () => {
  it('states what the build contains without claiming live features', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: /A premium home for everyday tools/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No AI generation and no payments are enabled/i)).toBeInTheDocument();
    expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
  });

  it('links to the design system review page', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /Review the design system/i })).toHaveAttribute(
      'href',
      '/design-system',
    );
  });
});
