/* eslint-disable react-refresh/only-export-components -- this module is the route table, not a hot-reload boundary */
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from '../components/auth/route-guards';
import { AppShell } from '../components/layout/app-shell';
import { UtilityShell } from '../components/layout/utility-shell';
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
const SupabaseSetupPage = lazy(() =>
  import('../pages/setup-supabase').then((module) => ({ default: module.SupabaseSetupPage })),
);
const ToolsPage = lazy(() =>
  import('../pages/tools').then((module) => ({ default: module.ToolsPage })),
);
const CalculatorPage = lazy(() =>
  import('../pages/tools/calculator').then((module) => ({ default: module.CalculatorPage })),
);
const PercentageCalculatorPage = lazy(() =>
  import('../pages/tools/percentage-calculator').then((module) => ({
    default: module.PercentageCalculatorPage,
  })),
);
const UnitConverterPage = lazy(() =>
  import('../pages/tools/unit-converter').then((module) => ({
    default: module.UnitConverterPage,
  })),
);
const DateCalculatorPage = lazy(() =>
  import('../pages/tools/date-calculator').then((module) => ({
    default: module.DateCalculatorPage,
  })),
);
const InvoiceMakerPage = lazy(() =>
  import('../pages/tools/invoice-maker').then((module) => ({
    default: module.InvoiceMakerPage,
  })),
);
const QuotationMakerPage = lazy(() =>
  import('../pages/tools/quotation-maker').then((module) => ({
    default: module.QuotationMakerPage,
  })),
);
const WordCounterPage = lazy(() =>
  import('../pages/tools/word-counter').then((module) => ({ default: module.WordCounterPage })),
);
const TextFormatterPage = lazy(() =>
  import('../pages/tools/text-formatter').then((module) => ({
    default: module.TextFormatterPage,
  })),
);
const RegisterPage = lazy(() =>
  import('../pages/auth/register').then((module) => ({ default: module.RegisterPage })),
);
const LoginPage = lazy(() =>
  import('../pages/auth/login').then((module) => ({ default: module.LoginPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('../pages/auth/forgot-password').then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import('../pages/auth/reset-password').then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const VerifyEmailPage = lazy(() =>
  import('../pages/auth/verify-email').then((module) => ({ default: module.VerifyEmailPage })),
);
const AuthCallbackPage = lazy(() =>
  import('../pages/auth/callback').then((module) => ({ default: module.AuthCallbackPage })),
);
const DashboardPage = lazy(() =>
  import('../pages/dashboard').then((module) => ({ default: module.DashboardPage })),
);
const ProfilePage = lazy(() =>
  import('../pages/profile').then((module) => ({ default: module.ProfilePage })),
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

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

function withShell(Shell: typeof AppShell, element: ReactNode) {
  return <Shell>{withSuspense(element)}</Shell>;
}

/** Signed-out-only screens: register, sign in, password recovery request. */
function guest(element: ReactNode) {
  return <RedirectIfAuthenticated>{withSuspense(element)}</RedirectIfAuthenticated>;
}

/** Account screens. The guard renders a loading state until the session resolves. */
function protectedRoute(element: ReactNode) {
  return <RequireAuth>{withSuspense(element)}</RequireAuth>;
}

export const router = createBrowserRouter([
  { path: '/', element: withShell(AppShell, <HomePage />) },
  { path: '/design-system', element: withShell(UtilityShell, <DesignSystemPage />) },
  { path: '/setup/supabase', element: withShell(UtilityShell, <SupabaseSetupPage />) },

  // Ordinary tools. Free, anonymous and entirely client-side, so they sit
  // outside every auth guard and keep working while Supabase is unconfigured.
  { path: '/tools', element: withShell(UtilityShell, <ToolsPage />) },
  { path: '/tools/calculator', element: withShell(UtilityShell, <CalculatorPage />) },
  {
    path: '/tools/percentage-calculator',
    element: withShell(UtilityShell, <PercentageCalculatorPage />),
  },
  { path: '/tools/unit-converter', element: withShell(UtilityShell, <UnitConverterPage />) },
  { path: '/tools/date-calculator', element: withShell(UtilityShell, <DateCalculatorPage />) },
  { path: '/tools/invoice-maker', element: withShell(UtilityShell, <InvoiceMakerPage />) },
  { path: '/tools/quotation-maker', element: withShell(UtilityShell, <QuotationMakerPage />) },
  { path: '/tools/word-counter', element: withShell(UtilityShell, <WordCounterPage />) },
  { path: '/tools/text-formatter', element: withShell(UtilityShell, <TextFormatterPage />) },

  { path: '/register', element: guest(<RegisterPage />) },
  { path: '/login', element: guest(<LoginPage />) },
  { path: '/forgot-password', element: guest(<ForgotPasswordPage />) },

  // Recovery and verification routes deliberately sit outside the guest guard:
  // opening a reset or confirmation link establishes a short-lived session, and
  // redirecting away from that session would break the flow.
  { path: '/verify-email', element: withSuspense(<VerifyEmailPage />) },
  { path: '/auth/reset-password', element: withSuspense(<ResetPasswordPage />) },
  { path: '/reset-password', element: withSuspense(<ResetPasswordPage />) },
  { path: '/auth/callback', element: withSuspense(<AuthCallbackPage />) },

  { path: '/dashboard', element: protectedRoute(<DashboardPage />) },
  { path: '/profile', element: protectedRoute(<ProfilePage />) },

  { path: '*', element: withShell(UtilityShell, <NotFoundPage />) },
]);
