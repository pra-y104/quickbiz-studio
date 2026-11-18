import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RedirectIfAuthenticated, RequireAuth } from './route-guards';
import { FakeAuthGateway, makeSession, renderWithAuth } from '../../test/auth-harness';

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function protectedApp() {
  return (
    <Routes>
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <p>dashboard content</p>
          </RequireAuth>
        }
      />
      <Route
        path="/login"
        element={
          <>
            <p>login screen</p>
            <LocationProbe />
          </>
        }
      />
      <Route path="*" element={<LocationProbe />} />
    </Routes>
  );
}

describe('RequireAuth', () => {
  it('shows a loading state while the session is restored, then the page', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    renderWithAuth(protectedApp(), { gateway, initialEntries: ['/dashboard'] });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(await screen.findByText('dashboard content')).toBeInTheDocument();
  });

  it('redirects signed-out visitors to sign in with a return path', async () => {
    renderWithAuth(protectedApp(), { initialEntries: ['/dashboard?tab=usage'] });

    expect(await screen.findByText('login screen')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/login?next=%2Fdashboard%3Ftab%3Dusage',
    );
  });
});

describe('RedirectIfAuthenticated', () => {
  it('shows the guest page when signed out', async () => {
    renderWithAuth(
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <p>login screen</p>
            </RedirectIfAuthenticated>
          }
        />
      </Routes>,
      { initialEntries: ['/login'] },
    );

    expect(await screen.findByText('login screen')).toBeInTheDocument();
  });

  it('moves signed-in visitors to the requested path', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    renderWithAuth(
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <p>login screen</p>
            </RedirectIfAuthenticated>
          }
        />
        <Route path="/profile" element={<p>profile screen</p>} />
        <Route path="/dashboard" element={<p>dashboard screen</p>} />
      </Routes>,
      { gateway, initialEntries: ['/login?next=%2Fprofile'] },
    );

    expect(await screen.findByText('profile screen')).toBeInTheDocument();
    expect(screen.queryByText('login screen')).not.toBeInTheDocument();
  });

  it('falls back to the dashboard when next is an external URL', async () => {
    const gateway = new FakeAuthGateway({ session: makeSession() });
    renderWithAuth(
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <p>login screen</p>
            </RedirectIfAuthenticated>
          }
        />
        <Route path="/dashboard" element={<p>dashboard screen</p>} />
      </Routes>,
      { gateway, initialEntries: ['/login?next=https%3A%2F%2Fevil.example'] },
    );

    expect(await screen.findByText('dashboard screen')).toBeInTheDocument();
  });
});
