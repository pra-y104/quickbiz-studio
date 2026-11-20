import { useTranslation } from 'react-i18next';
import { Download, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import type { CreativeProjectSummary } from '../../lib/creative/storage/project-store';

export interface ProjectCardProps {
  readonly project: CreativeProjectSummary;
  readonly onRename: (project: CreativeProjectSummary) => void;
  readonly onDuplicate: (project: CreativeProjectSummary) => void;
  readonly onDelete: (project: CreativeProjectSummary) => void;
  readonly onExport: (project: CreativeProjectSummary) => void;
  readonly busy?: boolean;
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
 * The preview is the link, so opening a project works with a mouse, a keyboard or
 * a screen reader. Destructive actions sit outside the link and always confirm.
 */
export function ProjectCard(props: ProjectCardProps) {
  const { t } = useTranslation();
  const { project, onRename, onDuplicate, onDelete, onExport, busy } = props;

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-elev-1 transition-shadow hover:shadow-elev-2">
      <Link
        to={`/studio/${project.id}`}
        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70"
        aria-label={`${t('studio.open')}: ${project.title}`}
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
        <div className="space-y-1 p-4 pb-2">
          <p className="truncate text-sm font-semibold text-ink">{project.title}</p>
          <p className="text-xs text-ink-subtle">
            {project.presetLabel} · {project.nodeCount} {t('studio.elements').toLowerCase()}
          </p>
          <p className="text-xs text-ink-subtle">
            {t('studio.edited')} {formatUpdated(project.updatedAt)}
          </p>
        </div>
      </Link>

      <div className="mt-auto flex items-center gap-1 border-t border-border px-2 py-1.5">
        <button
          type="button"
          onClick={() => onRename(project)}
          disabled={busy}
          className="flex min-h-[36px] items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 disabled:opacity-50"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          {t('studio.rename')}
        </button>
        <button
          type="button"
          onClick={() => onDuplicate(project)}
          disabled={busy}
          className="flex min-h-[36px] items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 disabled:opacity-50"
        >
          <MoreHorizontal className="size-3.5" aria-hidden="true" />
          {t('studio.duplicate')}
        </button>
        <button
          type="button"
          onClick={() => onExport(project)}
          disabled={busy}
          className="flex min-h-[36px] items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 disabled:opacity-50"
        >
          <Download className="size-3.5" aria-hidden="true" />
          {t('studio.export')}
        </button>
        <button
          type="button"
          onClick={() => onDelete(project)}
          disabled={busy}
          className="ml-auto flex min-h-[36px] items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 disabled:opacity-50"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          {t('studio.remove')}
        </button>
      </div>
    </article>
  );
}
