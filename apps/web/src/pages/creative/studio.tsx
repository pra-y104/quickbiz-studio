import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { Copy, Redo2, Trash2, Undo2, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import type { CreativeAssetRef, CreativeDocument } from '@quickbiz/shared';
import { StudioShell } from '../../components/creative/studio-shell';
import { CanvasStage, type StudioTool } from '../../components/creative/canvas-stage';
import { ToolRail } from '../../components/creative/tool-rail';
import { LayersPanel } from '../../components/creative/layers-panel';
import { ExportDialog } from '../../components/creative/export-dialog';
import { MobileInspector } from '../../components/creative/mobile-inspector';
import { AiAssistDialog } from '../../components/creative/ai-assist-dialog';
import { PropertiesPanel } from '../../components/creative/properties-panel';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { getProjectStore } from '../../lib/creative/storage';
import { useStudioEditor } from '../../lib/creative/editor/use-studio-editor';
import { useAssetImages } from '../../lib/creative/editor/use-asset-images';
import { ingestImage, ImageIngestError } from '../../lib/creative/assets/ingest';
import { invalidateAsset } from '../../lib/creative/render/asset-images';
import { isCreativeStudioEnabled } from '../../lib/creative/flags';
import { ASSET_STORE } from '../../lib/creative/storage/idb';
import { runRequest, openDatabase } from '../../lib/creative/storage/idb';

function LoadingScreen({ label }: { readonly label: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas" role="status">
      <Spinner className="size-6 text-primary" label={label} />
    </div>
  );
}

function MessageScreen({
  title,
  body,
  action,
}: {
  readonly title: string;
  readonly body: string;
  readonly action: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{body}</p>
        <div className="mt-4 flex justify-center">{action}</div>
      </div>
    </div>
  );
}

/** Store one ingested image and return the document asset reference. */
async function storeIngestedImage(
  name: string,
  image: Awaited<ReturnType<typeof ingestImage>>,
): Promise<CreativeAssetRef> {
  const database = await openDatabase();
  await runRequest({
    database,
    store: ASSET_STORE,
    mode: 'readwrite',
    operation: (store) =>
      store.put({
        id: image.asset.id,
        name: image.asset.name,
        mimeType: image.asset.mimeType,
        bytes: image.bytes.buffer.slice(
          image.bytes.byteOffset,
          image.bytes.byteOffset + image.bytes.byteLength,
        ) as ArrayBuffer,
        width: image.asset.width,
        height: image.asset.height,
        createdAt: new Date().toISOString(),
      }),
  });
  void name;
  return image.asset;
}

function EditorView({
  projectId,
  document,
}: {
  readonly projectId: string;
  readonly document: CreativeDocument;
}) {
  const { t } = useTranslation();
  const editor = useStudioEditor({ projectId, initial: document, store: getProjectStore() });
  const assets = useAssetImages(editor.document);

  const [tool, setTool] = useState<StudioTool>('select');
  const [zoomFactor, setZoomFactor] = useState(1);
  const [scale, setScale] = useState(0.2);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [aiPanel, setAiPanel] = useState<'text' | 'image' | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const selected = editor.selectedNodes[0] ?? null;

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), 4_000);
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        const image = await ingestImage(file, { name: file.name });
        const asset = await storeIngestedImage(file.name, image);
        invalidateAsset(asset.id);
        editor.addImage(asset);
      } catch (error) {
        if (error instanceof ImageIngestError) showNotice(error.message);
        else showNotice(t('studio.uploadFailed'));
      }
    },
    [editor, showNotice, t],
  );

  const handleCanvasTap = useCallback(
    (point: { x: number; y: number }) => {
      if (tool === 'text') {
        editor.addText({ text: 'Your text here' });
        setTool('select');
        return;
      }
      if (tool === 'shape') {
        editor.addShape('rect');
        setTool('select');
        return;
      }
      if (tool === 'image') {
        fileInput.current?.click();
      }
      void point;
    },
    [editor, tool],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (meta && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        editor.duplicateSelection();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        editor.deleteSelection();
        return;
      }
      if (event.key.startsWith('Arrow') && editor.selection.length > 0) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        if (event.key === 'ArrowLeft') editor.nudge(-step, 0);
        if (event.key === 'ArrowRight') editor.nudge(step, 0);
        if (event.key === 'ArrowUp') editor.nudge(0, -step);
        if (event.key === 'ArrowDown') editor.nudge(0, step);
        return;
      }
      if (event.key === 'Escape') editor.select([]);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editor]);

  const actions = useMemo(
    () => (
      <>
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          {t('studio.export')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={editor.undo}
          disabled={!editor.canUndo}
          aria-label={t('studio.undo')}
        >
          <Undo2 className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={editor.redo}
          disabled={!editor.canRedo}
          aria-label={t('studio.redo')}
        >
          <Redo2 className="size-4" aria-hidden="true" />
        </Button>
        <span className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <Button
          variant="ghost"
          size="sm"
          onClick={editor.duplicateSelection}
          disabled={editor.selection.length === 0}
          aria-label={t('studio.duplicate')}
        >
          <Copy className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={editor.deleteSelection}
          disabled={editor.selection.length === 0}
          aria-label={t('studio.remove')}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </>
    ),
    [editor, t],
  );

  return (
    <>
      <p id="studio-help" className="sr-only">
        {t('studio.keyboardHelp')}
      </p>
      <StudioShell
        title={editor.document.title}
        canvasLabel={
          editor.document.canvas.unit === 'mm'
            ? `${editor.document.canvas.width} × ${editor.document.canvas.height} mm`
            : `${editor.document.canvas.width} × ${editor.document.canvas.height} px`
        }
        saveState={editor.saveState}
        onBack={() => window.history.back()}
        actions={actions}
        rail={
          <ToolRail
            tool={tool}
            onToolChange={setTool}
            onAddText={() => {
              setTool('text');
              editor.addText();
              setTool('select');
            }}
            onAddShape={() => editor.addShape('rect')}
            onUploadImage={() => {
              setTool('image');
              fileInput.current?.click();
            }}
            onOpenTemplates={() => showNotice(t('studio.templateBody'))}
            onOpenAiPanel={(panel) => setAiPanel(panel)}
          />
        }
        canvas={
          <CanvasStage
            document={editor.document}
            selection={editor.selection}
            assets={assets}
            tool={tool}
            zoomFactor={zoomFactor}
            onScaleChange={setScale}
            onSelect={editor.select}
            onCommit={(next, historyKey) => editor.commit(next, { historyKey })}
            onBeginGesture={editor.beginGesture}
            onEndGesture={editor.endGesture}
            onCanvasTap={handleCanvasTap}
          />
        }
        inspector={
          <div className="flex h-full flex-col">
            <div className="border-b border-border p-3">
              <h2 className="text-sm font-semibold text-ink">{t('studio.layers')}</h2>
            </div>
            <div className="max-h-64 shrink-0 overflow-y-auto">
              <LayersPanel
                nodes={editor.document.nodes}
                selection={editor.selection}
                onSelect={(id, additive) => editor.select([id], additive)}
                onToggleHidden={() => editor.toggleHidden()}
                onToggleLocked={() => editor.toggleLocked()}
                onMove={(id, direction) => editor.reorder(id, direction)}
                onDelete={() => editor.deleteSelection()}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-border">
              <PropertiesPanel
                node={selected}
                onChange={editor.updateSelected}
                onDuplicate={editor.duplicateSelection}
                onDelete={editor.deleteSelection}
              />
            </div>
          </div>
        }
        mobileBar={
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <Button
                variant={tool === 'select' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setTool('select')}
                aria-pressed={tool === 'select'}
              >
                {t('studio.select')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => editor.addText()}>
                {t('studio.text')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => editor.addShape('rect')}>
                {t('studio.shapes')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInput.current?.click()}
                aria-label={t('studio.upload')}
              >
                <Upload className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('studio.zoomOut')}
                onClick={() => setZoomFactor((value) => Math.max(0.5, value - 0.25))}
              >
                <ZoomOut className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('studio.zoomIn')}
                onClick={() => setZoomFactor((value) => Math.min(4, value + 0.25))}
              >
                <ZoomIn className="size-4" aria-hidden="true" />
              </Button>
              <MobileInspector
                nodes={editor.document.nodes}
                selection={editor.selection}
                selected={selected}
                onSelect={(id, additive) => editor.select([id], additive)}
                onChange={editor.updateSelected}
                onDuplicate={editor.duplicateSelection}
                onDelete={editor.deleteSelection}
                onReorder={(id, direction) => editor.reorder(id, direction)}
                onToggleHidden={editor.toggleHidden}
                onToggleLocked={editor.toggleLocked}
              />
            </div>
          </div>
        }
      />

      <div className="pointer-events-none fixed bottom-20 left-1/2 z-40 -translate-x-1/2 sm:bottom-6">
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="rounded-full bg-navy-900/90 px-3 py-1 text-xs font-medium text-white">
            {Math.round(scale * 100)}%
          </span>
          {notice ? (
            <p
              role="status"
              className="max-w-sm rounded-card border border-border bg-surface px-3 py-2 text-xs text-ink shadow-elev-2"
            >
              {notice}
            </p>
          ) : null}
        </div>
      </div>

      <AiAssistDialog
        open={aiPanel !== null}
        mode={aiPanel}
        onOpenChange={(next) => {
          if (!next) setAiPanel(null);
        }}
      />

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        document={editor.document}
        assets={assets}
      />

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleUpload(file);
          event.target.value = '';
        }}
      />
    </>
  );
}

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
      <MessageScreen
        title={t('studio.unavailableTitle')}
        body={t('studio.unavailableBody')}
        action={
          <Button variant="outline" asChild>
            <Link to="/studio">{t('studio.backToProjects')}</Link>
          </Button>
        }
      />
    );
  }

  if (projectQuery.isPending) {
    return <LoadingScreen label={t('studio.opening')} />;
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <MessageScreen
        title={t('studio.openFailedTitle')}
        body={t('studio.openFailedBody')}
        action={
          <Button variant="outline" asChild>
            <Link to="/studio">{t('studio.backToProjects')}</Link>
          </Button>
        }
      />
    );
  }

  return <EditorView projectId={projectQuery.data.id} document={projectQuery.data.document} />;
}
