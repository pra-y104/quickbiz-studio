/**
 * Minimal PDF writer for design exports.
 *
 * The document is rasterised to a JPEG and embedded as a single-page PDF with a
 * `DCTDecode` image XObject. That is deliberate:
 *
 * - no new dependency, and no font subsetting to get wrong,
 * - the page reproduces exactly what the customer designed.
 *
 * The trade-off is honest and must be stated in the interface: the PDF is
 * image-based, so its text is not selectable and the file is larger than a vector
 * PDF. Vector export with embedded fonts is future work.
 *
 * PDF 1.4 requires the cross-reference table to contain byte offsets, so every
 * chunk is measured rather than counted in characters.
 */

import { toMillimetres, type CreativeCanvas } from '@quickbiz/shared';

/** One point is 1/72 inch. */
const MM_TO_POINTS = 72 / 25.4;
const PX_TO_POINTS = 72 / 96;

export interface PdfImagePage {
  readonly jpegBytes: Uint8Array;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
}

export interface PdfPageOptions {
  readonly canvas: CreativeCanvas;
  readonly marginPoints?: number;
}

/** Page size in PDF points, derived from the design's physical size. */
export function pagePointsFor(canvas: CreativeCanvas): { width: number; height: number } {
  if (canvas.unit === 'mm') {
    return { width: canvas.width * MM_TO_POINTS, height: canvas.height * MM_TO_POINTS };
  }
  return { width: canvas.width * PX_TO_POINTS, height: canvas.height * PX_TO_POINTS };
}

class ByteWriter {
  readonly #chunks: Uint8Array[] = [];
  #length = 0;

  get length(): number {
    return this.#length;
  }

  push(chunk: Uint8Array): void {
    this.#chunks.push(chunk);
    this.#length += chunk.byteLength;
  }

  text(value: string): void {
    this.push(new TextEncoder().encode(value));
  }

  toUint8Array(): Uint8Array {
    const output = new Uint8Array(this.#length);
    let offset = 0;
    for (const chunk of this.#chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Build a single-page PDF containing the supplied JPEG.
 *
 * Returns bytes plus a `pages` count so callers can assert the structure.
 */
export function buildImagePdf(
  options: PdfPageOptions & { readonly image: PdfImagePage },
): Uint8Array {
  const { canvas, image } = options;
  const page = pagePointsFor(canvas);
  const margin = options.marginPoints ?? 0;

  const drawWidth = Math.max(1, page.width - margin * 2);
  const drawHeight = Math.max(1, page.height - margin * 2);

  const content = [
    'q',
    `${round(drawWidth)} 0 0 ${round(drawHeight)} ${round(margin)} ${round(margin)} cm`,
    '/Im0 Do',
    'Q',
  ].join('\n');

  const writer = new ByteWriter();
  const offsets: number[] = [];

  writer.text('%PDF-1.4\n');
  // A binary comment marks the file as containing binary data.
  writer.push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const startObject = (id: number) => {
    offsets[id] = writer.length;
    writer.text(`${id} 0 obj\n`);
  };

  startObject(1);
  writer.text('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  startObject(2);
  writer.text('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  startObject(3);
  writer.text(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${round(page.width)} ${round(page.height)}] ` +
      '/Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\nendobj\n',
  );

  startObject(4);
  writer.text(
    `<< /Type /XObject /Subtype /Image /Width ${image.pixelWidth} /Height ${image.pixelHeight} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.jpegBytes.byteLength} >>\nstream\n`,
  );
  writer.push(image.jpegBytes);
  writer.text('\nendstream\nendobj\n');

  startObject(5);
  writer.text(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  const xrefOffset = writer.length;
  writer.text('xref\n');
  writer.text('0 6\n');
  writer.text('0000000000 65535 f \n');
  for (let index = 1; index <= 5; index += 1) {
    const offset = offsets[index] ?? 0;
    writer.text(`${String(offset).padStart(10, '0')} 00000 n \n`);
  }

  writer.text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return writer.toUint8Array();
}

/** Page size in millimetres, for user-facing copy about print output. */
export function pageMillimetresFor(canvas: CreativeCanvas): { width: number; height: number } {
  return toMillimetres(canvas);
}
