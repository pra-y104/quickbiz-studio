import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Plus, ShieldAlert, Sparkles } from 'lucide-react';
import type { CreativeDocument } from '@quickbiz/shared';
import { Container } from '../../components/ui/container';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ProjectCard } from '../../components/creative/project-card';
import { NewDesignDialog } from '../../components/creative/new-design-dialog';
import { getProjectStore, type CreativeProjectRecord } from '../../lib/creative/storage';
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
 * Creative Studio landing page: saved designs, a new-design entry point and a
 * clear statement of where the work is stored.
 */
export function StudioProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ['creative-projects'],
    queryFn: () => getProjectStore().list(),
    enabled: isCreativeStudioEnabled(),
  });

  const createProject = useMutation({
    mutationFn: async (document: CreativeDocument) => {
      const record: CreativeProjectRecord = {
        id: document.id,
        title: document.title,
        document,
        createdAt: document.createdAt,
        updatedAt: new Date().toISOString(),
      };
      await getProjectStore().put(record);
      return record;
    },
    onSuccess: async (record) => {
      await queryClient.invalidateQueries({ queryKey: ['creative-projects'] });
      navigate(`/studio/${record.id}`);
    },
  });

  if (!isCreativeStudioEnabled()) return <UnavailableState />;

  const projects = projectsQuery.data ?? [];
  const storageBlocked = projectsQuery.isSuccess && !getProjectStore().persistent;

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
          <Button onClick={() => setDialogOpen(true)} className="shrink-0">
            <Plus className="size-4" aria-hidden="true" />
            {t('studio.newDesign')}
          </Button>
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
                  <a href="#templates">{t('studio.browseTemplates')}</a>
                </Button>
              </div>
            </Card>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <li key={project.id}>
                  <ProjectCard project={project} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </Container>

      <NewDesignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={(document) => createProject.mutate(document)}
        pending={createProject.isPending}
      />
    </>
  );
}
