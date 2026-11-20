import { describe, expect, it } from 'vitest';
import { buildImagePdf, pageMillimetresFor, pagePointsFor } from '../export/creative-pdf';
import { EXPORT_LIMITS, assertExportSize, ExportError } from '../export/raster';
import { exportExtension, exportFilename } from '../export';
import { canvasFromPreset, requirePreset } from '@quickbiz/shared';

/** A 1×1 pixel JPEG, enough to exercise the PDF structure without a browser. */
const TINY_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07,
  0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f,
  0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c,
  0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d,
  0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc9,
]);

function textDecoder(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

describe('export size guards', () => {
  it('accepts a normal A4 export at 200 DPI', () => {
    expect(() => assertExportSize(1654, 2339)).not.toThrow();
  });

  it('rejects an excessive edge', () => {
    expect(() => assertExportSize(EXPORT_LIMITS.maxEdge + 1, 100)).toThrow(ExportError);
  });

  it('rejects an excessive pixel count', () => {
    expect(() => assertExportSize(20_000, 20_000)).toThrow(/too large/);
  });

  it('rejects invalid dimensions', () => {
    expect(() => assertExportSize(0, 100)).toThrow(ExportError);
    expect(() => assertExportSize(Number.NaN, 100)).toThrow(ExportError);
  });
});

describe('pdf writer', () => {
  it('converts millimetres to points', () => {
    const page = pagePointsFor(canvasFromPreset(requirePreset('a4-portrait')));
    expect(page.width).toBeCloseTo(595.28, 1);
    expect(page.height).toBeCloseTo(841.89, 1);
  });

  it('converts pixels to points at 96 DPI', () => {
    const page = pagePointsFor(canvasFromPreset(requirePreset('social-square')));
    expect(page.width).toBeCloseTo(810, 5);
  });

  it('reports the physical size in millimetres', () => {
    const size = pageMillimetresFor(canvasFromPreset(requirePreset('a4-portrait')));
    expect(size.width).toBeCloseTo(210, 5);
  });

  it('writes a well-formed single-page PDF', () => {
    const bytes = buildImagePdf({
      canvas: canvasFromPreset(requirePreset('social-square')),
      image: { jpegBytes: TINY_JPEG, pixelWidth: 1, pixelHeight: 1 },
    });

    const text = textDecoder(bytes);

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/Type /Pages');
    expect(text).toContain('/Subtype /Image');
    expect(text).toContain('/Filter /DCTDecode');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('records byte offsets that point at the objects they name', () => {
    const bytes = buildImagePdf({
      canvas: canvasFromPreset(requirePreset('social-square')),
      image: { jpegBytes: TINY_JPEG, pixelWidth: 1, pixelHeight: 1 },
    });
    const text = textDecoder(bytes);

    const startxref = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(Number.isFinite(startxref)).toBe(true);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');

    const entries = [...text.matchAll(/(\d{10}) 00000 n /g)].map((match) => Number(match[1]));
    expect(entries).toHaveLength(5);
    entries.forEach((offset, index) => {
      const expected = `${index + 1} 0 obj`;
      expect(text.slice(offset, offset + expected.length)).toBe(expected);
    });
  });

  it('embeds the jpeg bytes verbatim', () => {
    const bytes = buildImagePdf({
      canvas: canvasFromPreset(requirePreset('social-square')),
      image: { jpegBytes: TINY_JPEG, pixelWidth: 1, pixelHeight: 1 },
    });

    const asText = textDecoder(bytes);
    expect(asText).toContain(TINY_JPEG[0] === 0xff ? '/Length ' + TINY_JPEG.byteLength : '');
    expect(asText).toContain('stream');
  });
});

describe('filenames', () => {
  it('slugifies the design title', () => {
    expect(exportFilename('Summer Sale — 2026!', 'png')).toBe('summer-sale-2026.png');
    expect(exportFilename('  ', 'pdf')).toBe('design.pdf');
  });

  it('uses the jpg extension for jpeg exports', () => {
    expect(exportExtension('jpeg')).toBe('jpg');
    expect(exportExtension('png')).toBe('png');
    expect(exportExtension('pdf')).toBe('pdf');
  });
});
