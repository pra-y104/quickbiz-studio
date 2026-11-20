import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import i18n from '../../../i18n';
import { StudioProjectsPage } from '../projects';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StudioProjectsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('StudioProjectsPage', () => {
  it('renders the studio heading and entry points', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /new design/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /templates/i }).length).toBeGreaterThan(0);
  });

  it('states that designs are stored on this device', async () => {
    renderPage();

    expect(await screen.findByText(/saved in this browser on this device/i)).toBeTruthy();
  });

  it('does not crash when local storage is unavailable', async () => {
    renderPage();

    // IndexedDB is absent in jsdom, so the query rejects and the error state must
    // render rather than throwing during render.
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
  });
});
