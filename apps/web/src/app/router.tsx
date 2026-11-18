import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppShell } from '../components/layout/app-shell';
import { Spinner } from '../components/ui/spinner';

/**
 * Routes are split per page so the first paint only downloads the shell.
 * Tool routes are added at Stage 5 and Stage 6 from the shared catalogue.
 */
const HomePage = lazy(() =>
  import('../pages/home').then((module) => ({ default: module.HomePage })),
);
const DesignSystemPage = lazy(() =>
  import('../pages/design-system').then((module) => ({ default: module.DesignSystemPage })),
);
const NotFoundPage = lazy(() =>
  import('../pages/not-found').then((module) => ({ default: module.NotFoundPage })),
);

function RouteFallback() {
  return (
    <div
      className="flex min-h-[50dvh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-6 text-primary" label="Loading page" />
    </div>
  );
}

function withShell(element: ReactNode) {
  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>{element}</Suspense>
    </AppShell>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: withShell(<HomePage />) },
  { path: '/design-system', element: withShell(<DesignSystemPage />) },
  { path: '*', element: withShell(<NotFoundPage />) },
]);
