import { Link } from 'react-router';
import type { CreativeProjectSummary } from '../../lib/creative/storage/project-store';

export interface ProjectCardProps {
  readonly project: CreativeProjectSummary;
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * One saved design.
 *
 * The whole card is a link, so opening a project never depends on a hover-only
 * affordance and works identically with a keyboard.
 */
export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/studio/${project.id}`}
      className="group flex min-h-[44px] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-elev-1 transition-shadow hover:shadow-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-muted">
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="px-4 text-center text-sm font-medium text-ink-subtle">
            {project.presetLabel}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="truncate text-sm font-semibold text-ink">{project.title}</p>
        <p className="text-xs text-ink-subtle">
          {project.presetLabel} · {project.nodeCount} elements
        </p>
        <p className="mt-auto text-xs text-ink-subtle">Edited {formatUpdated(project.updatedAt)}</p>
      </div>
    </Link>
  );
}