import { describe, expect, it } from 'vitest';
import {
  CREATIVE_DOCUMENT_KIND,
  CREATIVE_DOCUMENT_VERSION,
  CREATIVE_LIMITS,
  createCreativeDocument,
  parseCreativeDocument,
  toDocPixels,
  toMillimetres,
  type CreativeNode,
} from '../index';
import { canvasFromPreset, getPreset, requirePreset } from '../index';

function baseDocument(overrides: Record<string, unknown> = {}) {
  return createCreativeDocument({
    title: 'Test design',
    canvas: canvasFromPreset(requirePreset('social-square')),
    now: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });
}

function textNode(overrides: Record<string, unknown> = {}): CreativeNode {
  return {
    id: 'n1',
    type: 'text',
    name: 'Headline',
    x: 0,
    y: 0,
    width: 400,
    height: 80,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    text: 'Hello',
    fontFamily: 'sans',
    fontSize: 48,
    fontWeight: 700,
    italic: false,
    underline: false,
    align: 'left',
    lineHeight: 1.15,
    letterSpacing: 0,
    color: '#101418',
    verticalAlign: 'top',
    ...overrides,
  } as CreativeNode;
}

describe('parseCreativeDocument', () => {
  it('accepts a document it created itself', () => {
    const document = baseDocument({ nodes: [textNode()] });
    const result = parseCreativeDocument(document);
    expect(result.ok).toBe(true);
  });

  it('reports the document kind and version', () => {
    const document = baseDocument();
    expect(document.kind).toBe(CREATIVE_DOCUMENT_KIND);
    expect(document.version).toBe(CREATIVE_DOCUMENT_VERSION);
  });

  it('rejects an unsupported version instead of coercing it', () => {
    const result = parseCreativeDocument({ ...baseDocument(), version: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unsupportedVersion).toBe(true);
      expect(result.issues[0]?.path).toBe('version');
    }
  });

  it('rejects a non-object payload', () => {
    for (const value of [null, undefined, 42, 'text', []]) {
      expect(parseCreativeDocument(value).ok).toBe(false);
    }
  });

  it('rejects unknown node types', () => {
    const document = baseDocument({ nodes: [{ ...(textNode() as object), type: 'video' }] });
    expect(parseCreativeDocument(document).ok).toBe(false);
  });

  it('rejects a node with a remote image url', () => {
    const imageNode = {
      id: 'n2',
      type: 'image',
      name: 'Photo',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      assetId: 'a1',
      fit: 'cover',
      crop: { x: 0, y: 0, width: 1, height: 1 },
      src: 'https://evil.example/x.png',
    };
    expect(parseCreativeDocument(baseDocument({ nodes: [imageNode] })).ok).toBe(false);
  });

  it('rejects an image node that references an unknown asset id format', () => {
    const imageNode = {
      id: 'n2',
      type: 'image',
      name: 'Photo',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      assetId: 'https://evil.example/x.png',
      fit: 'cover',
      crop: { x: 0, y: 0, width: 1, height: 1 },
    };
    expect(parseCreativeDocument(baseDocument({ nodes: [imageNode] })).ok).toBe(false);
  });

  it('rejects invalid dimensions and colours', () => {
    const zeroWidth = textNode({ width: 0 });
    const badColour = textNode({ color: 'red' });
    const negativeOpacity = textNode({ opacity: -0.5 });

    expect(parseCreativeDocument(baseDocument({ nodes: [zeroWidth] })).ok).toBe(false);
    expect(parseCreativeDocument(baseDocument({ nodes: [badColour] })).ok).toBe(false);
    expect(parseCreativeDocument(baseDocument({ nodes: [negativeOpacity] })).ok).toBe(false);
  });

  it('rejects a canvas whose pixel size exceeds the ceiling', () => {
    const document = baseDocument({
      canvas: {
        unit: 'px',
        width: 5_000,
        height: 5_000,
        dpi: 96,
        background: { type: 'solid', color: '#ffffff' },
      },
    });
    expect(parseCreativeDocument(document).ok).toBe(false);
  });

  it('rejects more nodes than the limit allows', () => {
    const nodes = Array.from({ length: CREATIVE_LIMITS.maxNodes + 1 }, (_, index) =>
      textNode({ id: `n${index}` }),
    );
    expect(parseCreativeDocument(baseDocument({ nodes })).ok).toBe(false);
  });

  it('reports a field path for each problem', () => {
    const result = parseCreativeDocument(baseDocument({ title: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.every((issue) => issue.path.length > 0)).toBe(true);
      expect(result.issues.map((issue) => issue.path)).toContain('title');
    }
  });
});

describe('unit conversion', () => {
  it('converts a print canvas to document pixels', () => {
    const canvas = canvasFromPreset(requirePreset('a4-portrait'));
    const pixels = toDocPixels(canvas);
    expect(Math.round(pixels.width)).toBe(2480);
    expect(Math.round(pixels.height)).toBe(3508);
  });

  it('keeps a digital canvas at its stated pixel size', () => {
    const canvas = canvasFromPreset(requirePreset('social-square'));
    expect(toDocPixels(canvas)).toEqual({ width: 1080, height: 1080 });
  });

  it('always answers the physical size in millimetres', () => {
    const print = toMillimetres(canvasFromPreset(requirePreset('business-card')));
    expect(print.width).toBeCloseTo(85, 5);
    expect(print.height).toBeCloseTo(55, 5);

    const digital = toMillimetres(canvasFromPreset(requirePreset('social-square')));
    expect(digital.width).toBeCloseTo(285.75, 1);
  });
});

describe('canvas presets', () => {
  it('offers print and digital presets', () => {
    const print = requirePreset('a4-portrait');
    const digital = requirePreset('social-story');

    expect(print.category).toBe('print');
    expect(print.unit).toBe('mm');
    expect(digital.category).toBe('digital');
    expect(digital.unit).toBe('px');
  });

  it('never offers a pixel canvas above the ceiling', () => {
    for (const id of [
      'a4-portrait',
      'a4-landscape',
      'a5-portrait',
      'social-square',
      'social-portrait',
      'social-story',
      'business-card',
      'banner-landscape',
      'youtube-thumbnail',
    ]) {
      const preset = getPreset(id);
      expect(preset, id).toBeDefined();
      const pixels = toDocPixels(canvasFromPreset(preset!));
      expect(Math.max(pixels.width, pixels.height), id).toBeLessThanOrEqual(
        CREATIVE_LIMITS.maxDocPixels,
      );
    }
  });

  it('throws for an unknown preset', () => {
    expect(() => requirePreset('nope')).toThrow(RangeError);
  });
});
