import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Film, Plus, ShieldAlert, Sparkles, Upload } from 'lucide-react';
import type { CreativeDocument } from '@quickbiz/shared';
import { Container } from '../../components/ui/container';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ProjectCard } from '../../components/creative/project-card';
import { NewDesignDialog } from '../../components/creative/new-design-dialog';
import { ConfirmDialog, RenameDialog } from '../../components/creative/dialogs';
import {
  getAssetStore,
  getProjectStore,
  type CreativeProjectSummary,
} from '../../lib/creative/storage';
import { deleteProjectWithAssets } from '../../lib/creative/storage/project-store';
import { createBrowserId } from '../../lib/creative/id';
import { useCreateProject } from '../../lib/creative/use-create-project';
import { exportProjectFile, readProjectFile } from '../../lib/creative/project-file-client';
import { isCreativeStudioEnabled } from '../../lib/creative/flags';

function UnavailableState() {
  const { t } = useTranslation();
  return (
    <Card className="p-8 text-center">
      <h2 className="text-lg font-semibold text-ink">{t('studio.unavailableTitle')}</h2>
      <p className="mx-auto mt-2 max-w-prose text-sm text-ink-muted">
        {t('studio.unavailableBody')}
      </p>
    </Card>
  );
}

/**
 * Creative Studio landing page: saved designs, a new-design entry point, template
 * browsing and a clear statement of where the work is stored.
 */
export function StudioProjectsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<CreativeProjectSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CreativeProjectSummary | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ['creative-projects'],
    queryFn: () => getProjectStore().list(),
    enabled: isCreativeStudioEnabled(),
  });

  const createProject = useCreateProject();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['creative-projects'] });

  const duplicate = useMutation({
    mutationFn: async (project: CreativeProjectSummary) => {
      const record = await getProjectStore().get(project.id);
      if (!record) throw new Error('Project not found');
      const copy: typeof record = {
        ...record,
        id: createBrowserId('doc'),
        title: `${record.title} copy`.slice(0, 120),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await getProjectStore().put(copy);
    },
    onSuccess: () => void refresh(),
  });

  const rename = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const record = await getProjectStore().get(id);
      if (!record) throw new Error('Project not found');
      await getProjectStore().put({
        ...record,
        title,
        document: { ...record.document, title, updatedAt: new Date().toISOString() },
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => void refresh(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteProjectWithAssets(getProjectStore(), getAssetStore(), id);
    },
    onSuccess: () => void refresh(),
  });

  if (!isCreativeStudioEnabled()) return <UnavailableState />;

  const projects = projectsQuery.data ?? [];
  const storageBlocked = projectsQuery.isSuccess && !getProjectStore().persistent;

  async function handleImport(file: File) {
    const result = await readProjectFile(file);
    if (!result.ok || !result.document) {
      setNotice(result.error ?? t('studio.importFailed'));
      return;
    }
    createProject.mutate({
      title: result.document.title,
      document: result.document,
      freshId: true,
    });
  }

  return (
    <>
      <Container className="py-8 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="size-4" aria-hidden="true" />
              {t('studio.eyebrow')}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {t('studio.title')}
            </h1>
            <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
              {t('studio.intro')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/studio/templates">{t('studio.browseTemplates')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/studio/video">
                <Film className="size-4" aria-hidden="true" />
                Video Studio
              </Link>
            </Button>
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" aria-hidden="true" />
              {t('studio.import')}
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              {t('studio.newDesign')}
            </Button>
          </div>
        </div>

        {storageBlocked ? (
          <div
            role="status"
            className="mt-6 flex items-start gap-3 rounded-card border border-warning/40 bg-warning-soft p-4 text-sm text-ink"
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p>{t('studio.storageBlocked')}</p>
          </div>
        ) : (
          <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-subtle">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t('studio.storageNote')}
          </p>
        )}

        <section aria-labelledby="recent-designs" className="mt-8">
          <h2 id="recent-designs" className="text-sm font-semibold text-ink">
            {t('studio.recent')}
          </h2>

          {projectsQuery.isPending ? (
            <p className="mt-4 text-sm text-ink-muted" role="status">
              {t('studio.loading')}
            </p>
          ) : projectsQuery.isError ? (
            <Card className="mt-4 p-6">
              <h3 className="text-sm font-semibold text-ink">{t('studio.loadFailedTitle')}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t('studio.loadFailedBody')}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => void projectsQuery.refetch()}
              >
                {t('studio.retry')}
              </Button>
            </Card>
          ) : projects.length === 0 ? (
            <Card className="mt-4 flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"
              >
                <Plus className="size-6" />
              </div>
              <h3 className="text-base font-semibold text-ink">{t('studio.emptyTitle')}</h3>
              <p className="max-w-sm text-sm text-ink-muted">{t('studio.emptyBody')}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <Button onClick={() => setDialogOpen(true)}>{t('studio.startBlank')}</Button>
                <Button variant="outline" asChild>
                  <Link to="/studio/templates">{t('studio.browseTemplates')}</Link>
                </Button>
              </div>
            </Card>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <li key={project.id}>
                  <ProjectCard
                    project={project}
                    busy={duplicate.isPending || rename.isPending || remove.isPending}
                    onRename={setRenameTarget}
                    onDuplicate={(target) => duplicate.mutate(target)}
                    onDelete={setDeleteTarget}
                    onExport={(target) => {
                      void getProjectStore()
                        .get(target.id)
                        .then((record) => {
                          if (record) exportProjectFile(record.title, record.document);
                        })
                        .catch(() => setNotice(t('studio.exportFailed')));
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </Container>

      <NewDesignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={(document: CreativeDocument) =>
          createProject.mutate({ title: document.title, document })
        }
        pending={createProject.isPending}
      />

      <RenameDialog
        open={renameTarget !== null}
        title={t('studio.rename')}
        initialValue={renameTarget?.title ?? ''}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        onRename={(title) => {
          if (renameTarget) rename.mutate({ id: renameTarget.id, title });
          setRenameTarget(null);
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('studio.deleteTitle')}
        body={t('studio.deleteBody')}
        confirmLabel={t('studio.remove')}
        destructive
        pending={remove.isPending}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      <input
        ref={fileInput}
        type="file"
        accept=".qbdesign,application/json"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImport(file);
          event.target.value = '';
        }}
      />

      {notice ? (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-card border border-border bg-surface px-4 py-2 text-sm text-ink shadow-elev-2"
        >
          {notice}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-3 text-xs font-medium text-primary hover:underline"
          >
            {t('studio.close')}
          </button>
        </div>
      ) : null}
    </>
  );
}
