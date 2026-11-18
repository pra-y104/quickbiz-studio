import { Database, KeyRound, ServerCog } from 'lucide-react';
import { Link } from 'react-router';
import { AUTH_COPY } from '../../content/auth';
import { cn } from '../../lib/cn';

const STEP_ICONS = [ServerCog, Database, KeyRound] as const;

export interface ConfigNoticeProps {
  className?: string;
}

/**
 * Shown instead of a working form when the build has no Supabase project.
 *
 * It names the exact variables and links to the setup guide, so a developer can
 * fix the environment rather than wonder why nothing happens on submit.
 */
export function ConfigNotice({ className }: ConfigNoticeProps) {
  return (
    <div
      role="status"
      className={cn('rounded-card border border-warning/30 bg-warning-soft/60 p-5', className)}
    >
      <h2 className="text-sm font-semibold text-ink">{AUTH_COPY.common.notConfiguredTitle}</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
        {AUTH_COPY.common.notConfiguredBody}
      </p>

      <ol className="mt-4 space-y-2.5">
        {AUTH_COPY.common.notConfiguredSteps.map((step, index) => {
          const Icon = STEP_ICONS[index] ?? ServerCog;
          return (
            <li key={step} className="flex items-start gap-2.5 text-xs text-ink-muted">
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-surface text-ink-subtle">
                <Icon className="size-3" aria-hidden="true" />
              </span>
              <span>{step}</span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink">
          VITE_SUPABASE_URL
        </code>
        <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-ink">
          VITE_SUPABASE_ANON_KEY
        </code>
      </p>

      <Link
        to="/docs/supabase"
        className="mt-3 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        {AUTH_COPY.common.notConfiguredDocs}
      </Link>
    </div>
  );
}
