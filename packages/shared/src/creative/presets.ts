/**
 * Canvas presets.
 *
 * A preset describes a physical or digital starting point. Print presets carry
 * millimetres plus a DPI, digital presets carry pixels. `toMillimetres()` on the
 * resulting document always answers the physical question, so the two worlds are
 * never silently mixed.
 *
 * `bleedMm` and `safeAreaMm` are guidance for the export dialog: guides are drawn
 * on screen and never exported.
 */

import type { CreativeCanvas, CreativeUnit } from './document';
import { DIGITAL_DPI } from './document';

export type CreativePresetCategory = 'print' | 'digital';

export interface CreativePreset {
  readonly id: string;
  readonly name: string;
  readonly category: CreativePresetCategory;
  readonly description: string;
  /** Millimetres for print presets, pixels for digital presets. */
  readonly width: number;
  readonly height: number;
  readonly unit: CreativeUnit;
  readonly dpi: number;
  /** Print only: extra paper on each edge that must be trimmed away. */
  readonly bleedMm?: number;
  /** Print only: content should stay inside this margin. */
  readonly safeAreaMm?: number;
  readonly keywords: readonly string[];
}

/** Print presets are authored in millimetres at 300 DPI. */
const PRINT = { unit: 'mm' as const, dpi: 300 };

export const CREATIVE_PRESETS: readonly CreativePreset[] = [
  {
    id: 'a4-portrait',
    name: 'A4 portrait',
    category: 'print',
    description: 'The everyday flyer and document size, 210 × 297 mm at 300 DPI.',
    width: 210,
    height: 297,
    ...PRINT,
    safeAreaMm: 10,
    keywords: ['flyer', 'document', 'poster'],
  },
  {
    id: 'a4-landscape',
    name: 'A4 landscape',
    category: 'print',
    description: '297 × 210 mm at 300 DPI for landscape flyers and menus.',
    width: 297,
    height: 210,
    ...PRINT,
    safeAreaMm: 10,
    keywords: ['flyer', 'menu', 'landscape'],
  },
  {
    id: 'a5-portrait',
    name: 'A5 portrait',
    category: 'print',
    description: '148 × 210 mm at 300 DPI for leaflets and handbills.',
    width: 148,
    height: 210,
    ...PRINT,
    safeAreaMm: 8,
    keywords: ['leaflet', 'handbill'],
  },
  {
    id: 'social-square',
    name: 'Square post',
    category: 'digital',
    description: '1080 × 1080 px, the universal social post size.',
    width: 1080,
    height: 1080,
    unit: 'px',
    dpi: DIGITAL_DPI,
    keywords: ['instagram', 'facebook', 'post'],
  },
  {
    id: 'social-portrait',
    name: 'Portrait post',
    category: 'digital',
    description: '1080 × 1350 px, the taller feed post that performs well on mobile.',
    width: 1080,
    height: 1350,
    unit: 'px',
    dpi: DIGITAL_DPI,
    keywords: ['instagram', 'portrait'],
  },
  {
    id: 'social-story',
    name: 'Story',
    category: 'digital',
    description: '1080 × 1920 px full-screen vertical format for stories and reels covers.',
    width: 1080,
    height: 1920,
    unit: 'px',
    dpi: DIGITAL_DPI,
    keywords: ['story', 'reel', 'tiktok'],
  },
  {
    id: 'business-card',
    name: 'Business card',
    category: 'print',
    description: '85 × 55 mm at 300 DPI with a 3 mm bleed allowance.',
    width: 85,
    height: 55,
    ...PRINT,
    bleedMm: 3,
    safeAreaMm: 4,
    keywords: ['card', 'business'],
  },
  {
    id: 'banner-landscape',
    name: 'Landscape banner',
    category: 'digital',
    description: '1920 × 640 px web banner for headers and campaign strips.',
    width: 1920,
    height: 640,
    unit: 'px',
    dpi: DIGITAL_DPI,
    keywords: ['banner', 'web', 'header'],
  },
  {
    id: 'youtube-thumbnail',
    name: 'YouTube thumbnail',
    category: 'digital',
    description: '1280 × 720 px, the 16:9 thumbnail size YouTube recommends.',
    width: 1280,
    height: 720,
    unit: 'px',
    dpi: DIGITAL_DPI,
    keywords: ['youtube', 'video', 'thumbnail'],
  },
] as const;

export const DEFAULT_PRESET_ID = 'social-square';

export function getPreset(id: string): CreativePreset | undefined {
  return CREATIVE_PRESETS.find((preset) => preset.id === id);
}

export function requirePreset(id: string): CreativePreset {
  const preset = getPreset(id);
  if (!preset) throw new RangeError(`Unknown canvas preset: ${id}`);
  return preset;
}

export interface CustomCanvasInput {
  readonly unit: CreativeUnit;
  readonly width: number;
  readonly height: number;
  readonly dpi?: number;
}

/** Build a canvas for a preset, or for explicit custom dimensions. */
export function canvasFromPreset(preset: CreativePreset): CreativeCanvas {
  return {
    unit: preset.unit,
    width: preset.width,
    height: preset.height,
    dpi: preset.dpi,
    background: { type: 'solid', color: '#ffffff' },
  };
}

export function canvasFromCustom(input: CustomCanvasInput): CreativeCanvas {
  return {
    unit: input.unit,
    width: input.width,
    height: input.height,
    dpi: input.dpi ?? (input.unit === 'mm' ? 300 : DIGITAL_DPI),
    background: { type: 'solid', color: '#ffffff' },
  };
}
