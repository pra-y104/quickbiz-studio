import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { ArrowLeft, FileText } from 'lucide-react';
import { toDocPixels, toMillimetres, type CreativeDocument } from '@quickbiz/shared';
import { StudioShell } from '../../components/creative/studio-shell';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { getProjectStore } from '../../lib/creative/storage';
import { isCreativeStudioEnabled } from '../../lib/creative/flags';

function ArtboardPreview({ document }: { document: CreativeDocument }) {
  const pixels = toDocPixels(document.canvas);
  const millimetres = toMillimetres(document.canvas);
  const background =
    document.canvas.background.type === 'solid'
      ? document.canvas.background.color
      : '#ffffff';

  return (
    <div className="flex max-h-full max-w-full flex-col items-center gap-3">
      <div
        className="max-h-[70dvh] max-w-full rounded-sm shadow-elev-3 ring-1 ring-border"
        style={{
          aspectRatio: `${pixels.width} / ${pixels.height}`,
          background,
          width: `min(100%, ${Math.round(pixels.width / 2)}px)`,
        }}
        role="img"
        aria-label={`${document.title}, ${Math.round(millimetres.width)} by ${Math.round(
          millimetres.height,
        )} millimetres`}
      />
      <p className="text-xs text-ink-subtle">
        {document.canvas.unit === 'mm'
          ? `${document.canvas.width} × ${document.canvas.height} mm at ${document.canvas.dpi} DPI`
          : `${document.canvas.width} × ${document.canvas.height} px`}
      </p>
    </div>
  );
}

/**
 * Editor route.
 *
 * Loads one saved design and mounts the studio shell. The canvas renderer and the
 * editing commands are attached in the next milestone; until then the artboard is
 * shown at the correct proportions with its real dimensions, so the page is
 * truthful about what is loaded.
 */
export function StudioPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();

  const projectQuery = useQuery({
    queryKey: ['creative-project', projectId],
    queryFn: () => {
      if (!projectId) throw new Error('Missing project id');
      return getProjectStore().get(projectId);
    },
    enabled: isCreativeStudioEnabled() && Boolean(projectId),
  });

  if (!isCreativeStudioEnabled()) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-ink">{t('studio.unavailableTitle')}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t('studio.unavailableBody')}
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/studio">{t('studio.backToProjects')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (projectQuery.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas" role="status">
        <Spinner className="size-6 text-primary" label="{t('studio.opening')}" />
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-ink">{t('studio.openFailedTitle')}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t('studio.openFailedBody')}
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/studio">Back to projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { document } = projectQuery.data;

  return (
    <StudioShell
      title={document.title}
      canvasLabel={
        document.canvas.unit === 'mm'
          ? `${document.canvas.width} × ${document.canvas.height} mm`
          : `${document.canvas.width} × ${document.canvas.height} px`
      }
      saveState="saved"
      onBack={() => window.history.back()}
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/studio">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('studio.projects')}
          </Link>
        </Button>
      }
      rail={
        <Link
          to="/studio"
          className="flex size-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70"
          aria-label="Back to projects"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
      }
      canvas={<ArtboardPreview document={document} />}
      inspector={
        <div className="space-y-6 p-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <FileText className="size-4 text-primary" aria-hidden="true" />
              {t('studio.document')}
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">{t('studio.name')}</dt>
                <dd className="truncate text-right font-medium text-ink">{document.title}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">{t('studio.elements')}</dt>
                <dd className="font-medium text-ink">{document.nodes.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">{t('studio.assets')}</dt>
                <dd className="font-medium text-ink">{document.assets.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      }
      mobileBar={
        <p className="text-center text-xs text-ink-subtle">
          The editing toolbar arrives with the next studio milestone.
        </p>
      }
    />
  );
}