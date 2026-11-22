import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CREATIVE_TEMPLATES,
  listPublishedTemplates,
  templatePack,
  templateStatus,
  templateTier,
  type CreativeTemplate,
} from '@quickbiz/shared';
import {
  clearTemplateThumbnailCache,
  getCachedTemplateThumbnail,
  renderTemplateThumbnail,
} from '../render/template-thumbnail';

const TEMPLATE = CREATIVE_TEMPLATES[0]!;

/** Minimal 2D context stub: jsdom has no canvas implementation. */
function createStubContext() {
  const record = () => () => undefined;
  const gradient = { addColorStop: record() };

  return {
    canvas: { width: 300, height: 300 },
    save: record(),
    restore: record(),
    setTransform: record(),
    clearRect: record(),
    fillRect: record(),
    strokeRect: record(),
    beginPath: record(),
    closePath: record(),
    rect: record(),
    roundRect: record(),
    ellipse: record(),
    moveTo: record(),
    lineTo: record(),
    fill: record(),
    stroke: record(),
    arc: record(),
    translate: record(),
    rotate: record(),
    clip: record(),
    drawImage: record(),
    fillText: record(),
    setLineDash: record(),
    measureText: (text: string) => ({ width: text.length * 8 }),
    createLinearGradient: () => gradient,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    globalAlpha: 1,
    textBaseline: 'top',
    letterSpacing: '0px',
  };
}

function stubCanvas(available: boolean) {
  const spy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() =>
      available ? (createStubContext() as unknown as CanvasRenderingContext2D) : null,
    );

  const toData = vi
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockImplementation(() => 'data:image/webp;base64,AAAA');

  return () => {
    spy.mockRestore();
    toData.mockRestore();
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  clearTemplateThumbnailCache();
});

describe('template catalogue metadata (P1)', () => {
  it('publishes every starter template by default', () => {
    expect(listPublishedTemplates()).toHaveLength(CREATIVE_TEMPLATES.length);
  });

  it('groups templates into a named pack with a tier and status', () => {
    for (const template of CREATIVE_TEMPLATES) {
      expect(templatePack(template)).toBe('starter');
      expect(templateTier(template)).toBe('free');
      expect(templateStatus(template)).toBe('published');
    }
  });

  it('treats a retired template as unpublished', () => {
    const retired = { ...TEMPLATE, id: 'retired-one', status: 'retired' } as CreativeTemplate;
    expect(templateStatus(retired)).toBe('retired');
    expect(listPublishedTemplates().some((template) => template.id === 'retired-one')).toBe(false);
  });
});

describe('template thumbnails (P1)', () => {
  it('falls back gracefully when the browser has no 2D context', () => {
    const restore = stubCanvas(false);
    try {
      expect(renderTemplateThumbnail(TEMPLATE, 160)).toBeUndefined();
      expect(getCachedTemplateThumbnail(TEMPLATE.id)).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('renders a preview and caches it by template id', () => {
    const restore = stubCanvas(true);
    try {
      const first = renderTemplateThumbnail(TEMPLATE, 240);
      expect(first).toBe('data:image/webp;base64,AAAA');
      expect(getCachedTemplateThumbnail(TEMPLATE.id)).toBe(first);

      // Second call must reuse the cache rather than re-render.
      const contextSpy = vi.mocked(HTMLCanvasElement.prototype.getContext);
      const callsBefore = contextSpy.mock.calls.length;
      expect(renderTemplateThumbnail(TEMPLATE, 240)).toBe(first);
      expect(contextSpy.mock.calls.length).toBe(callsBefore);
    } finally {
      restore();
    }
  });

  it('renders a preview for every template without throwing', () => {
    const restore = stubCanvas(true);
    try {
      for (const template of CREATIVE_TEMPLATES) {
        expect(renderTemplateThumbnail(template, 160), template.id).toBeDefined();
      }
    } finally {
      restore();
    }
  });
});
