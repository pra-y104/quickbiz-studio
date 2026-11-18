import { Database, KeyRound, ServerCog, ShieldCheck, TerminalSquare } from 'lucide-react';
import { BRAND } from '@quickbiz/shared';
import { UtilityShell } from '../components/layout/utility-shell';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Container } from '../components/ui/container';

const ENV_ROWS = [
  {
    name: 'VITE_SUPABASE_URL',
    where: 'Browser build',
    value: 'https://<project-ref>.supabase.co',
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    where: 'Browser build',
    value: 'Public anon key from Project settings → API',
  },
  {
    name: 'SUPABASE_URL',
    where: 'API worker',
    value: 'Same project URL; derives the JWKS endpoint',
  },
  {
    name: 'SUPABASE_JWT_SECRET',
    where: 'API worker (legacy)',
    value: 'Only for older projects that still sign HS256 tokens',
  },
];

const STEPS = [
  {
    icon: ServerCog,
    title: 'Create the project',
    body: 'Create a free Supabase project. Note the Project URL and the anon public key. The service-role key is not needed for this stage and must never be placed in the web build.',
  },
  {
    icon: Database,
    title: 'Apply the migrations',
    body: 'Run 0001_extensions.sql, 0002_conventions.sql and 0003_profiles.sql against the project, in order, with the Supabase CLI or the SQL editor. The last one creates public.profiles, its RLS policies, column grants and the signup trigger.',
  },
  {
    icon: KeyRound,
    title: 'Set the environment variables',
    body: 'Copy apps/web/.env.example to .env.local and fill the VITE_SUPABASE_* values. Copy apps/api/.dev.vars.example to .dev.vars and set SUPABASE_URL for token verification.',
  },
  {
    icon: ShieldCheck,
    title: 'Configure URLs and email',
    body: 'In Authentication → URL configuration, set the site URL and add /auth/callback and /auth/reset-password to the allowed redirect list. Keep email confirmation enabled so the verification flow is exercised.',
  },
] as const;

/** In-app setup guide so the configuration notice links somewhere useful. */
export function SupabaseSetupPage() {
  return (
    <UtilityShell>
      <Container className="max-w-3xl py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Setup</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Connect {BRAND.name} to Supabase
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Authentication is real, not simulated. Until a Supabase project is connected, every auth
          form stays disabled and says so. These four steps enable registration, sign-in, password
          recovery and the profile screen.
        </p>

        <ol className="mt-8 space-y-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-card border border-border bg-surface p-5 shadow-elev-1"
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <step.icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  {index + 1}. {step.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TerminalSquare className="size-4 text-primary" aria-hidden="true" />
              Environment variables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-ink-subtle">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Used by</th>
                    <th className="pb-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {ENV_ROWS.map((row) => (
                    <tr key={row.name} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-4 font-mono text-xs text-ink">{row.name}</td>
                      <td className="py-2.5 pr-4 text-xs text-ink-muted">{row.where}</td>
                      <td className="py-2.5 text-xs text-ink-muted">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 rounded-card border border-border bg-surface-muted/60 p-5 text-sm leading-relaxed text-ink-muted">
          <p className="font-medium text-ink">Security notes</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs">
            <li>The anon key is public by design; Row Level Security is what protects rows.</li>
            <li>
              The service-role key bypasses RLS. It must never appear in the web app, a commit or a
              browser bundle.
            </li>
            <li>
              Profiles are readable and writable only by their owner. Email, id and timestamps are
              not writable by clients.
            </li>
            <li>
              Password reset responses are identical whether or not an account exists, so the form
              cannot be used to discover addresses.
            </li>
          </ul>
        </div>
      </Container>
    </UtilityShell>
  );
}
