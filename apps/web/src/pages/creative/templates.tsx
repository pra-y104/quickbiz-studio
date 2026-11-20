import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  CREATIVE_TEMPLATES,
  CREATIVE_TEMPLATE_CATEGORIES,
  canvasFromPreset,
  createDocumentFromTemplate,
  getPreset,
  type CreativeTemplateCategory,
} from '@quickbiz/shared';
import { Container } from '../../components/ui/container';
import { Button } from '../../components/ui/button';
import { NewDesignDialog } from '../../components/creative/new-design-dialog';
import { TemplateCard } from '../../components/creative/template-card';
import { useCreateProject } from '../../lib/creative/use-create-project';

/**
 * Template gallery.
 *
 * Every card is a real document template: opening one creates an editable
 * project on this device. Nothing is downloaded and no third-party artwork is
 * redistributed.
 */
export function StudioTemplatesPage() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<CreativeTemplateCategory | 'all'>('all');
  const [blankOpen, setBlankOpen] = useState(false);
  const createProject = useCreateProject();

  const templates = useMemo(
    () =>
      category === 'all'
        ? CREATIVE_TEMPLATES
        : CREATIVE_TEMPLATES.filter((template) => template.category === category),
    [category],
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <Container className="py-8 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Link
              to="/studio"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              {t('studio.backToProjects')}
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {t('studio.templateTitle')}
            </h1>
            <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
              {t('studio.templateBody')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBlankOpen(true)}>
              {t('studio.startBlank')}
            </Button>
            <Button asChild>
              <Link to="/studio">
                {t('studio.projects')}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory('all')}
            aria-pressed={category === 'all'}
            className={`min-h-[40px] rounded-pill border px-4 text-sm font-medium transition-colors ${
              category === 'all'
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border bg-surface text-ink-muted hover:bg-surface-muted'
            }`}
          >
            {t('studio.templateAll')}
          </button>
          {CREATIVE_TEMPLATE_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              aria-pressed={category === value}
              className={`min-h-[40px] rounded-pill border px-4 text-sm font-medium transition-colors ${
                category === value
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-surface text-ink-muted hover:bg-surface-muted'
              }`}
            >
              {t(`studio.category.${value}`)}
            </button>
          ))}
        </div>

        {templates.length === 0 ? (
          <p className="mt-8 text-sm text-ink-muted">{t('studio.emptyTitle')}</p>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((template) => {
              const preset = getPreset(template.presetId);
              const canvas = preset ? canvasFromPreset(preset) : null;
              return (
                <li key={template.id}>
                  <TemplateCard
                    template={template}
                    canvasLabel={
                      canvas
                        ? canvas.unit === 'mm'
                          ? `${canvas.width} × ${canvas.height} mm`
                          : `${canvas.width} × ${canvas.height} px`
                        : template.presetId
                    }
                    busy={createProject.isPending}
                    onUse={() =>
                      createProject.mutate({
                        title: template.name,
                        document: createDocumentFromTemplate(template.id),
                      })
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Container>

      <NewDesignDialog
        open={blankOpen}
        onOpenChange={setBlankOpen}
        onCreate={(document) => createProject.mutate({ title: document.title, document })}
        pending={createProject.isPending}
      />
    </div>
  );
}
