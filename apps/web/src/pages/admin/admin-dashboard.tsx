/* eslint-disable react-hooks/set-state-in-effect -- the admin console loads from the API on mount
   and when the section changes; state only reflects an already-known request result. */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  Cpu,
  Info,
  Lock,
  RefreshCw,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { ApiRequestError } from '../../lib/api-client';
import { useAuth } from '../../lib/auth/auth-context';
import {
  getAdminAiStatus,
  getAdminOverview,
  getAdminSection,
  getAdminSettings,
  getAdminTools,
  type AdminAiStatus,
  type AdminOverview,
  type AdminSectionState,
  type AdminSettings,
  type AdminTools,
} from '../../lib/admin/client';
import { AdminShell } from '../../components/admin/admin-shell';

export type AdminSection =
  | 'overview'
  | 'users'
  | 'wallets'
  | 'payments'
  | 'referrals'
  | 'tools'
  | 'ai'
  | 'settings'
  | 'audit';

type SectionData =
  | { kind: 'overview'; data: AdminOverview }
  | { kind: 'ai'; data: AdminAiStatus }
  | { kind: 'tools'; data: AdminTools }
  | { kind: 'settings'; data: AdminSettings }
  | { kind: 'section'; data: AdminSectionState };

const SECTION_META: Record<AdminSection, { title: string; description: string }> = {
  overview: {
    title: 'Admin overview',
    description: 'A live snapshot of the platform, drawn only from real, already-available data.',
  },
  users: { title: 'User management', description: 'Registered accounts and their status.' },
  wallets: { title: 'Wallet monitoring', description: 'Balances, holds and ledger activity.' },
  payments: { title: 'Payments', description: 'Payment attempts, settlements and refunds.' },
  referrals: { title: 'Referrals', description: 'Referral links, conversions and rewards.' },
  tools: { title: 'Tools', description: 'The tool catalogue and its availability.' },
  ai: { title: 'AI provider status', description: 'Configured providers and per-tool readiness.' },
  settings: { title: 'Platform settings', description: 'Non-secret configuration (read-only).' },
  audit: { title: 'Audit logs', description: 'Administrative and security-relevant events.' },
};

async function loadSection(section: AdminSection, token: string | null): Promise<SectionData> {
  switch (section) {
    case 'overview':
      return { kind: 'overview', data: await getAdminOverview(token) };
    case 'tools':
      return { kind: 'tools', data: await getAdminTools(token) };
    case 'ai':
      return { kind: 'ai', data: await getAdminAiStatus(token) };
    case 'settings':
      return { kind: 'settings', data: await getAdminSettings(token) };
    default:
      return {
        kind: 'section',
        data: await getAdminSection(
          token,
          section as 'users' | 'wallets' | 'payments' | 'referrals' | 'audit-logs',
        ),
      };
  }
}

type LoadState =
  | { status: 'loading' }
  | { status: 'forbidden' }
  | { status: 'error'; message: string }
  | { status: 'ready'; result: SectionData };

export function AdminPage({ section }: { section: AdminSection }) {
  const { status, session, gateway } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const meta = SECTION_META[section];

  const load = useCallback(async () => {
    if (status !== 'ready' || !session) return;
    setState({ status: 'loading' });
    try {
      const token = await gateway.getAccessToken();
      if (!token) {
        setState({ status: 'forbidden' });
        return;
      }
      const result = await loadSection(section, token);
      setState({ status: 'ready', result });
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 403) {
        setState({ status: 'forbidden' });
        return;
      }
      setState({
        status: 'error',
        message: caught instanceof Error ? caught.message : 'Could not load admin data.',
      });
    }
  }, [gateway, section, session, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AdminShell title={meta.title} description={meta.description}>
      {state.status === 'loading' ? <LoadingState /> : null}
      {state.status === 'forbidden' ? <AccessDenied /> : null}
      {state.status === 'error' ? <ErrorState message={state.message} onRetry={load} /> : null}
      {state.status === 'ready' ? <SectionView section={section} result={state.result} /> : null}
    </AdminShell>
  );
}

function LoadingState() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-navy-300"
      role="status"
      aria-live="polite"
    >
      <RefreshCw className="size-5 animate-spin text-brand-400" aria-hidden="true" />
      Loading admin data…
    </div>
  );
}

function AccessDenied() {
  return (
    <AdminCard className="mx-auto max-w-lg text-center">
      <div className="flex flex-col items-center gap-3 py-6">
        <span
          className="flex size-12 items-center justify-center rounded-2xl bg-danger/15 text-danger"
          aria-hidden="true"
        >
          <ShieldAlert className="size-6" />
        </span>
        <h2 className="text-lg font-semibold text-white">Admin access required</h2>
        <p className="max-w-sm text-sm text-navy-300">
          Your account is not on the admin allow-list. If you should have access, ask the workspace
          owner to add your user id or email to the server configuration.
        </p>
        <Link
          to="/dashboard"
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          Back to your dashboard
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </AdminCard>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <AdminCard className="border-danger/30 bg-danger/10">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Could not load this section</p>
          <p className="mt-1 text-sm text-navy-300">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-navy-700 bg-navy-900 px-3 py-2 text-sm font-medium text-navy-200 hover:bg-navy-800 hover:text-white"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      </div>
    </AdminCard>
  );
}

function SectionView({ section, result }: { section: AdminSection; result: SectionData }) {
  if (result.kind === 'overview') return <OverviewView data={result.data} />;
  if (result.kind === 'tools') return <ToolsView data={result.data} />;
  if (result.kind === 'ai') return <AiView data={result.data} />;
  if (result.kind === 'settings') return <SettingsView data={result.data} />;
  // Unavailable sections.
  if (!result.data.available) {
    return <NotAvailable section={section} reason={result.data.reason} />;
  }
  return <NotAvailable section={section} reason="This section has no data source yet." />;
}

function OverviewView({ data }: { data: AdminOverview }) {
  const stats = [
    { label: 'Total tools', value: data.tools.total },
    { label: 'Live tools', value: data.tools.live },
    { label: 'AI tools', value: data.tools.ai },
    { label: 'Utility tools', value: data.tools.utility },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-navy-400">Platform</p>
            <p className="mt-1 truncate text-lg font-semibold text-white">{data.platform.name}</p>
            <p className="text-sm text-navy-300">
              v{data.platform.version} · {data.platform.environment} · API{' '}
              {data.platform.apiVersion}
            </p>
          </div>
          <span
            className={
              data.ai.configured
                ? 'inline-flex items-center gap-1.5 rounded-pill bg-success/15 px-3 py-1 text-xs font-medium text-success'
                : 'inline-flex items-center gap-1.5 rounded-pill bg-warning/15 px-3 py-1 text-xs font-medium text-warning'
            }
          >
            <Cpu className="size-3.5" aria-hidden="true" />
            AI {data.ai.configured ? 'configured' : 'not configured'}
          </span>
        </div>
      </AdminCard>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-navy-400">
          Sections
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data.sections).map(([key, value]) => (
            <SectionTile key={key} sectionKey={key} available={value.available} />
          ))}
        </div>
      </div>
    </div>
  );
}

const SECTION_TITLES: Record<string, string> = {
  overview: 'Overview',
  tools: 'Tools',
  aiProviders: 'AI Providers',
  settings: 'Settings',
  users: 'Users',
  wallets: 'Wallets',
  payments: 'Payments',
  referrals: 'Referrals',
  auditLogs: 'Audit Logs',
};

const SECTION_LINKS: Record<string, string> = {
  overview: '/admin',
  tools: '/admin/tools',
  aiProviders: '/admin/ai',
  settings: '/admin/settings',
  users: '/admin/users',
  wallets: '/admin/wallets',
  payments: '/admin/payments',
  referrals: '/admin/referrals',
  auditLogs: '/admin/audit',
};

function SectionTile({ sectionKey, available }: { sectionKey: string; available: boolean }) {
  const label = SECTION_TITLES[sectionKey] ?? sectionKey;
  const to = SECTION_LINKS[sectionKey] ?? '/admin';
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 rounded-card border border-navy-800 bg-navy-900 p-4 transition-colors hover:border-brand-500/50 hover:bg-navy-800"
    >
      <span className="flex items-center gap-2.5">
        {available ? (
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
        ) : (
          <CircleSlash className="size-4 text-navy-500" aria-hidden="true" />
        )}
        <span className="text-sm font-medium text-navy-100">{label}</span>
      </span>
      <span
        className={
          available
            ? 'text-[11px] font-medium uppercase tracking-wide text-success'
            : 'text-[11px] font-medium uppercase tracking-wide text-navy-500'
        }
      >
        {available ? 'Live' : 'Soon'}
      </span>
    </Link>
  );
}

function ToolsView({ data }: { data: AdminTools }) {
  return (
    <AdminCard>
      <div className="mb-4 flex items-center gap-2">
        <Wrench className="size-4 text-brand-400" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-white">{data.total} tools in the catalogue</h2>
      </div>
      <ul className="divide-y divide-navy-800">
        {data.tools.map((tool) => (
          <li key={tool.slug} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy-100">{tool.name}</p>
              <p className="truncate text-xs text-navy-400">
                {tool.category} · {tool.kind}
                {tool.requiresAuth ? ' · auth required' : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-navy-400">
                {tool.creditCost === null ? 'Unpriced' : `${tool.creditCost} credits`}
              </span>
              <Badge tone={tool.status === 'live' ? 'success' : 'neutral'}>{tool.status}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </AdminCard>
  );
}

function AiView({ data }: { data: AdminAiStatus }) {
  return (
    <div className="space-y-6">
      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-navy-400">AI status</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {data.configured ? 'Configured' : 'Not configured'}
            </p>
            <p className="text-sm text-navy-300">{data.reason}</p>
          </div>
          <Badge tone={data.configured ? 'success' : 'warning'}>
            {data.providers.length} provider{data.providers.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="mb-3 text-sm font-semibold text-white">Providers</h2>
        {data.providers.length === 0 ? (
          <p className="text-sm text-navy-300">
            No AI provider is configured. Set <code className="text-brand-300">AI_ENABLED</code> and
            a provider key to enable AI tools.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.providers.map((provider) => (
              <li
                key={provider.id}
                className="flex items-center justify-between rounded-lg border border-navy-800 bg-navy-950 px-3 py-2 text-sm"
              >
                <span className="text-navy-100">{provider.label}</span>
                <span className="text-xs text-navy-400">{provider.model}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard>
        <h2 className="mb-3 text-sm font-semibold text-white">AI tools</h2>
        <ul className="divide-y divide-navy-800">
          {data.tools.map((tool) => (
            <li key={tool.slug} className="flex items-center justify-between gap-4 py-2.5">
              <span className="truncate text-sm text-navy-100">{tool.name}</span>
              <span className="shrink-0 text-xs text-navy-400">
                {tool.creditCost === null ? 'Unpriced' : `${tool.creditCost} credits`}
              </span>
            </li>
          ))}
        </ul>
      </AdminCard>
    </div>
  );
}

function SettingsView({ data }: { data: AdminSettings }) {
  const rows: Array<[string, string]> = [
    ['Environment', data.values.environment],
    ['App version', data.values.appVersion],
    ['AI requires verified email', data.values.aiRequireVerifiedEmail ? 'Yes' : 'No'],
    ['Rate limiting', data.values.rateLimitEnabled ? 'Enabled' : 'Disabled'],
    ['Rate limit window', `${data.values.rateLimitWindowSeconds}s`],
    ['Rate limit max requests', String(data.values.rateLimitMaxRequests)],
    ['CORS allowed origins', String(data.values.corsAllowedOrigins)],
  ];
  return (
    <div className="space-y-6">
      <AdminCard>
        <div className="mb-4 flex items-center gap-2">
          <Lock className="size-4 text-brand-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-white">Read-only configuration</h2>
        </div>
        <dl className="divide-y divide-navy-800">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <dt className="text-navy-300">{label}</dt>
              <dd className="text-right font-medium text-navy-100">{value}</dd>
            </div>
          ))}
        </dl>
      </AdminCard>
      <AdminCard className="border-accent/20 bg-accent/5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <p className="text-sm text-navy-200">
            Editing platform settings is not yet available. {data.note}
          </p>
        </div>
      </AdminCard>
    </div>
  );
}

function NotAvailable({ section, reason }: { section: AdminSection; reason?: string }) {
  const message =
    reason ??
    `The ${SECTION_META[section].title.toLowerCase()} section is not yet available in this build.`;
  return (
    <AdminCard className="mx-auto max-w-lg text-center">
      <div className="flex flex-col items-center gap-3 py-8">
        <span
          className="flex size-12 items-center justify-center rounded-2xl bg-navy-800 text-navy-300"
          aria-hidden="true"
        >
          <CircleSlash className="size-6" />
        </span>
        <h2 className="text-lg font-semibold text-white">Not yet available</h2>
        <p className="max-w-sm text-sm text-navy-300">{message}</p>
        <p className="text-xs text-navy-500">
          No data is shown because none exists yet — nothing here is fabricated.
        </p>
      </div>
    </AdminCard>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-navy-800 bg-navy-900 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-navy-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-navy-800 bg-navy-900 p-5 ${className ?? ''}`}>
      {children}
    </div>
  );
}

type BadgeTone = 'success' | 'warning' | 'neutral';
function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  const tones: Record<BadgeTone, string> = {
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    neutral: 'bg-navy-800 text-navy-300',
  };
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export default AdminPage;
