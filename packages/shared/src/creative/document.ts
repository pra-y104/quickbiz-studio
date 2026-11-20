/**
 * Creative Studio document model.
 *
 * One versioned, serialisable description of a design. The renderer, the editor
 * commands, persistence and import/export all speak this format, so a document
 * can be validated once and trusted everywhere.
 *
 * Rules enforced here:
 *
 * - The document is data, never code. There is no `html`, `src` or `url` field
 *   that a document can use to make the application fetch or render something.
 * - Assets are referenced by id (`assetId`). A remote URL cannot be smuggled in.
 * - Node types are a closed set. Unknown types are rejected, not ignored.
 * - Sizes and counts are capped so a hostile or corrupt file cannot exhaust
 *   memory in the editor.
 * - An unsupported `version` is rejected explicitly, never silently coerced.
 *
 * Geometry note: node coordinates are stored in **document pixels** (pixels at
 * the document's own DPI). The canvas is stored in the unit the customer chose
 * (`mm` for print, `px` for digital) and converted with `toDocPixels()`. This
 * keeps a 300 DPI print document at 3508 px wide without mixing millimetres into
 * every node.
 */

import { z } from 'zod';

export const CREATIVE_DOCUMENT_KIND = 'creative-document.v1' as const;
export const CREATIVE_DOCUMENT_VERSION = 1 as const;

/** Hard engineering ceilings. A document above these is rejected, not trimmed. */
export const CREATIVE_LIMITS = {
  maxNodes: 150,
  maxDepth: 2,
  maxDocPixels: 4096,
  maxTitleLength: 120,
  maxTextLength: 5_000,
  maxAssets: 100,
  maxAssetNameLength: 120,
  minFontSize: 4,
  maxFontSize: 400,
  minOpacity: 0,
  maxOpacity: 1,
  minDimension: 1,
  maxDimension: 20_000,
} as const;

export type CreativeUnit = 'mm' | 'px';

export const CREATIVE_UNITS = ['mm', 'px'] as const;

/** Millimetres per inch, exact by definition. */
export const MM_PER_INCH = 25.4;

/** Document pixels per inch for digital presets (CSS reference density). */
export const DIGITAL_DPI = 96;

export const CREATIVE_DPI_RANGE = { min: 72, max: 600 } as const;

/* -------------------------------------------------------------------------- */
/* Paint                                                                       */
/* -------------------------------------------------------------------------- */

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const creativeColorSchema = z.string().regex(HEX_COLOR, 'must be a #rrggbb colour');

export type CreativeColor = z.infer<typeof creativeColorSchema>;

export const creativePaintSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('solid'),
      color: creativeColorSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal('linear'),
      from: creativeColorSchema,
      to: creativeColorSchema,
      /** Degrees, clockwise from "to the right". */
      angle: z.number().min(-360).max(360),
    })
    .strict(),
]);

export type CreativePaint = z.infer<typeof creativePaintSchema>;

export const TRANSPARENT_PAINT: CreativePaint = { type: 'solid', color: '#ffffff' };

/* -------------------------------------------------------------------------- */
/* Typography                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Font stacks available to a design.
 *
 * `source` records where the family comes from today. `system` families render
 * with fonts already on the device, so nothing is downloaded and no licence is
 * implied. The `self-hosted` entries are the intended OFL families; they only
 * take effect once the owner approves adding the font files, which is why they
 * are listed with a fallback stack that stays legible in the meantime.
 */
export const FONT_FAMILIES = [
  {
    id: 'sans',
    label: 'Modern Sans',
    stack: "ui-sans-serif, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    source: 'system',
    licence: 'System fonts, no redistribution',
  },
  {
    id: 'serif',
    label: 'Editorial Serif',
    stack: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
    source: 'system',
    licence: 'System fonts, no redistribution',
  },
  {
    id: 'geometric',
    label: 'Geometric Sans',
    stack: "'Century Gothic', 'Avenir Next', 'Trebuchet MS', ui-sans-serif, sans-serif",
    source: 'system',
    licence: 'System fonts, no redistribution',
  },
  {
    id: 'condensed',
    label: 'Condensed Display',
    stack: "'Arial Narrow', 'Helvetica Neue Condensed', 'Liberation Sans Narrow', sans-serif",
    source: 'system',
    licence: 'System fonts, no redistribution',
  },
  {
    id: 'mono',
    label: 'Technical Mono',
    stack: "ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    source: 'system',
    licence: 'System fonts, no redistribution',
  },
  {
    id: 'rounded',
    label: 'Friendly Rounded',
    stack: "'Trebuchet MS', 'Segoe UI', ui-rounded, system-ui, sans-serif",
    source: 'system',
    licence: 'System fonts, no redistribution',
  },
] as const;

export type FontFamilyId = (typeof FONT_FAMILIES)[number]['id'];

export const FONT_FAMILY_IDS = FONT_FAMILIES.map((family) => family.id);

export function getFontFamily(id: FontFamilyId): (typeof FONT_FAMILIES)[number] {
  const family = FONT_FAMILIES.find((candidate) => candidate.id === id);
  if (!family) throw new RangeError(`Unknown font family: ${id}`);
  return family;
}

export const creativeFontFamilySchema = z.enum([
  'sans',
  'serif',
  'geometric',
  'condensed',
  'mono',
  'rounded',
] as const);

export const creativeFontWeightSchema = z.union([
  z.literal(400),
  z.literal(500),
  z.literal(600),
  z.literal(700),
  z.literal(800),
]);

export type CreativeFontWeight = z.infer<typeof creativeFontWeightSchema>;

export const creativeTextAlignSchema = z.enum(['left', 'center', 'right']);
export type CreativeTextAlign = z.infer<typeof creativeTextAlignSchema>;

/* -------------------------------------------------------------------------- */
/* Nodes                                                                       */
/* -------------------------------------------------------------------------- */

/** Asset and node ids share one shape so references cannot smuggle a URL. */
const assetIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'must be a safe identifier');

const nodeIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'must be a safe identifier');

const nodeBase = {
  id: nodeIdSchema,
  name: z.string().min(1).max(80),
  /** Document pixels from the left edge of the canvas. */
  x: z.number().min(-CREATIVE_LIMITS.maxDimension).max(CREATIVE_LIMITS.maxDimension),
  /** Document pixels from the top edge of the canvas. */
  y: z.number().min(-CREATIVE_LIMITS.maxDimension).max(CREATIVE_LIMITS.maxDimension),
  width: z.number().min(CREATIVE_LIMITS.minDimension).max(CREATIVE_LIMITS.maxDimension),
  height: z.number().min(CREATIVE_LIMITS.minDimension).max(CREATIVE_LIMITS.maxDimension),
  /** Degrees, clockwise. */
  rotation: z.number().min(-360).max(360),
  opacity: z.number().min(CREATIVE_LIMITS.minOpacity).max(CREATIVE_LIMITS.maxOpacity),
  locked: z.boolean(),
  hidden: z.boolean(),
};

export interface CreativeNodeBase {
  readonly id: string;
  readonly name: string;
  /** Document pixels from the left edge of the canvas. */
  readonly x: number;
  /** Document pixels from the top edge of the canvas. */
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Degrees, clockwise. */
  readonly rotation: number;
  readonly opacity: number;
  readonly locked: boolean;
  readonly hidden: boolean;
}

export interface CreativeTextNode extends CreativeNodeBase {
  readonly type: 'text';
  readonly text: string;
  readonly fontFamily: FontFamilyId;
  /** Document pixels. */
  readonly fontSize: number;
  readonly fontWeight: CreativeFontWeight;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly align: CreativeTextAlign;
  /** Multiplier. */
  readonly lineHeight: number;
  /** Document pixels between characters. */
  readonly letterSpacing: number;
  readonly color: CreativeColor;
  readonly verticalAlign: 'top' | 'middle' | 'bottom';
}

export type CreativeShapeKind =
  'rect' | 'roundRect' | 'ellipse' | 'line' | 'arrow' | 'triangle' | 'star';

export interface CreativeShapeStroke {
  readonly color: CreativeColor;
  readonly width: number;
  readonly style: 'solid' | 'dashed' | 'dotted';
}

export interface CreativeShapeNode extends CreativeNodeBase {
  readonly type: 'shape';
  readonly shape: CreativeShapeKind;
  readonly fill: CreativePaint;
  /** `null` means no stroke. */
  readonly stroke: CreativeShapeStroke | null;
  /** Corner radius in document pixels; only used by `roundRect`. */
  readonly cornerRadius: number;
}

export interface CreativeImageCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CreativeImageNode extends CreativeNodeBase {
  readonly type: 'image';
  /** References `CreativeDocument.assets`. Never a URL. */
  readonly assetId: string;
  readonly fit: 'cover' | 'contain';
  /** Normalised crop rectangle inside the source image. */
  readonly crop: CreativeImageCrop;
}

export interface CreativeGroupNode extends CreativeNodeBase {
  readonly type: 'group';
  readonly children: readonly CreativeNode[];
}

/**
 * A node is one of four explicit shapes. Groups may contain nodes but not other
 * groups, which keeps depth at one and validation predictable.
 */
export type CreativeNode =
  CreativeTextNode | CreativeShapeNode | CreativeImageNode | CreativeGroupNode;

export type CreativeNodeType = CreativeNode['type'];

const textNodeSchema: z.ZodType<CreativeTextNode> = z
  .object({
    ...nodeBase,
    type: z.literal('text'),
    text: z.string().max(CREATIVE_LIMITS.maxTextLength),
    fontFamily: creativeFontFamilySchema,
    /** Document pixels. */
    fontSize: z.number().min(CREATIVE_LIMITS.minFontSize).max(CREATIVE_LIMITS.maxFontSize),
    fontWeight: creativeFontWeightSchema,
    italic: z.boolean(),
    underline: z.boolean(),
    align: creativeTextAlignSchema,
    /** Multiplier, 0.8 - 2.5. */
    lineHeight: z.number().min(0.8).max(2.5),
    /** Document pixels between characters. */
    letterSpacing: z.number().min(-10).max(40),
    color: creativeColorSchema,
    /** Vertical anchor used when the text box is resized by hand. */
    verticalAlign: z.enum(['top', 'middle', 'bottom']),
  })
  .strict();

const shapeNodeSchema: z.ZodType<CreativeShapeNode> = z
  .object({
    ...nodeBase,
    type: z.literal('shape'),
    shape: z.enum(['rect', 'roundRect', 'ellipse', 'line', 'arrow', 'triangle', 'star']),
    fill: creativePaintSchema,
    /** `null` means no stroke. */
    stroke: z
      .object({
        color: creativeColorSchema,
        width: z.number().min(0).max(200),
        style: z.enum(['solid', 'dashed', 'dotted']),
      })
      .strict()
      .nullable(),
    /** Corner radius in document pixels; only used by `roundRect`. */
    cornerRadius: z.number().min(0).max(1_000),
  })
  .strict();

const imageNodeSchema: z.ZodType<CreativeImageNode> = z
  .object({
    ...nodeBase,
    type: z.literal('image'),
    /** References `CreativeDocument.assets`. Never a URL. */
    assetId: assetIdSchema,
    fit: z.enum(['cover', 'contain']),
    /** Normalised crop rectangle inside the source image (0-1). */
    crop: z
      .object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().min(0.01).max(1),
        height: z.number().min(0.01).max(1),
      })
      .strict(),
  })
  .strict();

/**
 * Groups may contain nodes but never other groups.
 *
 * The depth limit is enforced by the schema rather than by convention: a recursive
 * `z.lazy` union accepts unbounded nesting, which makes both node counting and
 * rendering recursive on untrusted input.
 */
const groupChildSchema = z.union([textNodeSchema, shapeNodeSchema, imageNodeSchema]);

const groupNodeSchema: z.ZodType<CreativeGroupNode> = z
  .object({
    ...nodeBase,
    type: z.literal('group'),
    children: z.array(groupChildSchema).max(CREATIVE_LIMITS.maxNodes),
  })
  .strict();

export const creativeNodeSchema: z.ZodType<CreativeNode> = z.union([
  textNodeSchema,
  shapeNodeSchema,
  imageNodeSchema,
  groupNodeSchema,
]);

export const CREATIVE_NODE_TYPES = ['text', 'shape', 'image', 'group'] as const;

export function isCreativeNode(value: unknown): value is CreativeNode {
  return creativeNodeSchema.safeParse(value).success;
}

/* -------------------------------------------------------------------------- */
/* Canvas and document                                                         */
/* -------------------------------------------------------------------------- */

const canvasSchema = z
  .object({
    unit: z.enum(CREATIVE_UNITS),
    /** Millimetres when `unit` is `mm`, pixels when `unit` is `px`. */
    width: z.number().min(CREATIVE_LIMITS.minDimension).max(CREATIVE_LIMITS.maxDimension),
    height: z.number().min(CREATIVE_LIMITS.minDimension).max(CREATIVE_LIMITS.maxDimension),
    dpi: z.number().int().min(CREATIVE_DPI_RANGE.min).max(CREATIVE_DPI_RANGE.max),
    background: creativePaintSchema,
  })
  .strict()
  .refine((canvas) => canvas.unit === 'mm' || canvas.width <= CREATIVE_LIMITS.maxDocPixels, {
    message: `A pixel canvas cannot exceed ${CREATIVE_LIMITS.maxDocPixels} px`,
  });

export type CreativeCanvas = z.infer<typeof canvasSchema>;

const assetRefSchema = z
  .object({
    id: assetIdSchema,
    name: z.string().min(1).max(CREATIVE_LIMITS.maxAssetNameLength),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    /** Intrinsic pixel size of the stored asset. */
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    bytes: z.number().int().min(1),
  })
  .strict();

export type CreativeAssetRef = z.infer<typeof assetRefSchema>;

export const creativeDocumentSchema = z
  .object({
    kind: z.literal(CREATIVE_DOCUMENT_KIND),
    version: z.literal(CREATIVE_DOCUMENT_VERSION),
    id: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/),
    title: z.string().min(1).max(CREATIVE_LIMITS.maxTitleLength),
    canvas: canvasSchema,
    nodes: z.array(creativeNodeSchema).max(CREATIVE_LIMITS.maxNodes),
    assets: z.array(assetRefSchema).max(CREATIVE_LIMITS.maxAssets),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type CreativeDocument = z.infer<typeof creativeDocumentSchema>;

export interface CreativeParseIssue {
  readonly path: string;
  readonly message: string;
}

export interface CreativeParseSuccess {
  readonly ok: true;
  readonly document: CreativeDocument;
}

export interface CreativeParseFailure {
  readonly ok: false;
  readonly issues: readonly CreativeParseIssue[];
  /** True when the payload simply comes from a newer format. */
  readonly unsupportedVersion: boolean;
}

export type CreativeParseResult = CreativeParseSuccess | CreativeParseFailure;

function toIssues(error: z.ZodError): CreativeParseIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Validate untrusted input as a creative document.
 *
 * Returns a result rather than throwing so callers can show field-level feedback.
 * Nothing is coerced: a wrong type is an error, and an unknown key is an error.
 */
export function parseCreativeDocument(input: unknown): CreativeParseResult {
  const version = (input as { version?: unknown } | null)?.version;
  if (version !== undefined && version !== CREATIVE_DOCUMENT_VERSION) {
    return {
      ok: false,
      unsupportedVersion: true,
      issues: [
        {
          path: 'version',
          message: `unsupported document version (expected ${CREATIVE_DOCUMENT_VERSION})`,
        },
      ],
    };
  }

  const result = creativeDocumentSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, unsupportedVersion: false, issues: toIssues(result.error) };
  }
  return { ok: true, document: result.data };
}

/** Flatten a document's nodes for counting and traversal, groups included. */
/**
 * Count nodes including group children.
 *
 * Iterative rather than recursive: the schema forbids nested groups, and an
 * explicit stack keeps this safe even if a future format change loosens that rule.
 */
export function countCreativeNodes(nodes: readonly CreativeNode[]): number {
  let total = 0;
  const stack: (readonly CreativeNode[])[] = [nodes];

  while (stack.length > 0) {
    const level = stack.pop();
    if (!level) continue;
    for (const node of level) {
      total += 1;
      if (node.type === 'group') stack.push(node.children);
    }
  }

  return total;
}

/* -------------------------------------------------------------------------- */
/* Unit helpers                                                                */
/* -------------------------------------------------------------------------- */

export function mmToDocPixels(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

export function docPixelsToMm(pixels: number, dpi: number): number {
  return (pixels / dpi) * MM_PER_INCH;
}

/** Pixels at the document's own resolution, which is what nodes are stored in. */
export function toDocPixels(canvas: CreativeCanvas): { width: number; height: number } {
  if (canvas.unit === 'px') return { width: canvas.width, height: canvas.height };
  return {
    width: mmToDocPixels(canvas.width, canvas.dpi),
    height: mmToDocPixels(canvas.height, canvas.dpi),
  };
}

/** Physical size in millimetres, whatever unit the canvas was authored in. */
export function toMillimetres(canvas: CreativeCanvas): { width: number; height: number } {
  if (canvas.unit === 'mm') return { width: canvas.width, height: canvas.height };
  return {
    width: docPixelsToMm(canvas.width, canvas.dpi),
    height: docPixelsToMm(canvas.height, canvas.dpi),
  };
}

/** Points are the unit print software expects; 1 pt = 1/72 inch. */
export function docPixelsToPoints(pixels: number, dpi: number): number {
  return (pixels / dpi) * 72;
}

export function pointsToDocPixels(points: number, dpi: number): number {
  return (points / 72) * dpi;
}

/** Square pixels per document unit; used to keep aspect ratios honest. */
export function isSquarePixels(canvas: CreativeCanvas): boolean {
  const pixels = toDocPixels(canvas);
  return Math.abs(pixels.width - pixels.height) < 0.5;
}

/* -------------------------------------------------------------------------- */
/* Construction                                                                */
/* -------------------------------------------------------------------------- */

let fallbackId = 0;

function createId(prefix: string): string {
  const cryptoApi = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `${prefix}_${cryptoApi.randomUUID()}`;
  }
  fallbackId += 1;
  return `${prefix}_${Date.now().toString(36)}${fallbackId.toString(36)}`;
}

export interface CreateCreativeDocumentOptions {
  readonly title: string;
  readonly canvas: CreativeCanvas;
  readonly nodes?: readonly CreativeNode[];
  readonly assets?: readonly CreativeAssetRef[];
  readonly now?: Date;
}

export function createCreativeDocument(options: CreateCreativeDocumentOptions): CreativeDocument {
  const timestamp = (options.now ?? new Date()).toISOString();
  return {
    kind: CREATIVE_DOCUMENT_KIND,
    version: CREATIVE_DOCUMENT_VERSION,
    id: createId('doc'),
    title: options.title,
    canvas: options.canvas,
    nodes: [...(options.nodes ?? [])],
    assets: [...(options.assets ?? [])],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createNodeId(): string {
  return createId('n');
}

/** A fresh document id, used when importing must not overwrite an existing design. */
export function createCreativeDocumentId(): string {
  return createId('doc');
}

export function createAssetId(): string {
  return createId('a');
}
