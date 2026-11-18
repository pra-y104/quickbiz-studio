/**
 * A deliberately small PDF writer.
 *
 * The project must not add a multi-megabyte PDF dependency for two documents, so
 * this module writes PDF 1.4 directly: base-14 Helvetica, uncompressed content
 * streams, one page object per page and a correct cross-reference table.
 *
 * Text is encoded as WinAnsi (a superset of Latin-1). Characters outside that
 * range that matter to this product are transliterated (`₦` becomes `NGN `)
 * rather than silently dropped.
 *
 * Everything the writer emits stays inside the Latin-1 byte range, so string
 * length equals byte length and offsets stay exact.
 */

export type PdfFontName = 'regular' | 'bold';

export interface PdfColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export const PDF_PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 48,
} as const;

export const PDF_COLORS = {
  ink: { r: 0.043, g: 0.071, b: 0.133 },
  inkMuted: { r: 0.29, g: 0.33, b: 0.41 },
  inkSubtle: { r: 0.42, g: 0.46, b: 0.53 },
  brand: { r: 0.404, g: 0.255, b: 0.91 },
  border: { r: 0.89, g: 0.905, b: 0.941 },
  surfaceMuted: { r: 0.945, g: 0.953, b: 0.976 },
  white: { r: 1, g: 1, b: 1 },
} as const satisfies Record<string, PdfColor>;

export type PdfColorName = keyof typeof PDF_COLORS;

/** Helvetica advance widths for ASCII 32-126, in thousandths of an em. */
const HELVETICA_WIDTHS: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const BOLD_FACTOR = 1.06;

const WIN_ANSI_SPECIALS: Readonly<Record<string, string>> = {
  '\u20ac': '\u0080',
  '\u201a': '\u0082',
  '\u0192': '\u0083',
  '\u201e': '\u0084',
  '\u2026': '\u0085',
  '\u2020': '\u0086',
  '\u2021': '\u0087',
  '\u02c6': '\u0088',
  '\u2030': '\u0089',
  '\u0160': '\u008a',
  '\u2039': '\u008b',
  '\u0152': '\u008c',
  '\u017d': '\u008e',
  '\u2018': '\u0091',
  '\u2019': '\u0092',
  '\u201c': '\u0093',
  '\u201d': '\u0094',
  '\u2022': '\u0095',
  '\u2013': '\u0096',
  '\u2014': '\u0097',
  '\u02dc': '\u0098',
  '\u2122': '\u0099',
  '\u0161': '\u009a',
  '\u203a': '\u009b',
  '\u0153': '\u009c',
  '\u017e': '\u009e',
  '\u0178': '\u009f',
  '\u00a0': ' ',
};

/** Currencies whose symbol has no WinAnsi slot are written as an ISO code. */
const CURRENCY_TRANSLITERATIONS: Readonly<Record<string, string>> = {
  '\u20a6': 'NGN ',
  '\u20b9': 'INR ',
  '\u20b5': 'GHS ',
  '\u20bd': 'RUB ',
  '\u20a9': 'KRW ',
};

function toWinAnsi(input: string): string {
  let output = '';
  for (const character of input) {
    const code = character.codePointAt(0) ?? 0;
    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      output += ' ';
      continue;
    }
    if (code < 0x20 || code === 0x7f) {
      output += ' ';
      continue;
    }
    if (code <= 0xff) {
      output += character;
      continue;
    }
    const special = WIN_ANSI_SPECIALS[character];
    if (special) {
      output += special;
      continue;
    }
    const currency = CURRENCY_TRANSLITERATIONS[character];
    output += currency ?? '?';
  }
  return output;
}

function escapeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function colourCommand(color: PdfColor): string {
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return `${round(color.r)} ${round(color.g)} ${round(color.b)}`;
}

export interface PdfTextOptions {
  readonly size?: number;
  readonly font?: PdfFontName;
  readonly color?: PdfColor;
  readonly maxWidth?: number;
}

interface PageContent {
  readonly operations: string[];
}

export class PdfDocument {
  readonly width = PDF_PAGE.width;
  readonly height = PDF_PAGE.height;

  private readonly pages: PageContent[] = [];
  private activeIndex = 0;

  constructor() {
    this.addPage();
  }

  get pageCount(): number {
    return this.pages.length;
  }

  addPage(): void {
    this.pages.push({ operations: [] });
    this.activeIndex = this.pages.length - 1;
  }

  /** Draw on an existing page, used for footers after the body is laid out. */
  selectPage(index: number): void {
    if (index < 0 || index >= this.pages.length) {
      throw new RangeError(`Page ${index} does not exist`);
    }
    this.activeIndex = index;
  }

  private currentPage(): PageContent {
    const page = this.pages[this.activeIndex];
    if (!page) throw new Error('No page available');
    return page;
  }

  /** Text width in points, estimated from the Helvetica metrics. */
  measure(text: string, size: number, font: PdfFontName = 'regular'): number {
    let width = 0;
    for (const character of toWinAnsi(text)) {
      const code = character.charCodeAt(0);
      const advance = code >= 32 && code <= 126 ? (HELVETICA_WIDTHS[code - 32] ?? 556) : 556;
      width += advance;
    }
    const measured = (width / 1000) * size;
    return font === 'bold' ? measured * BOLD_FACTOR : measured;
  }

  /** Greedy word wrapping that also breaks words wider than the column. */
  wrap(text: string, size: number, font: PdfFontName, maxWidth: number): string[] {
    const lines: string[] = [];

    for (const paragraph of text.split(/\r?\n/)) {
      const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
      if (words.length === 0) {
        lines.push('');
        continue;
      }

      let current = '';
      for (const word of words) {
        const candidate = current.length === 0 ? word : `${current} ${word}`;
        if (this.measure(candidate, size, font) <= maxWidth) {
          current = candidate;
          continue;
        }
        if (current.length > 0) {
          lines.push(current);
        }
        if (this.measure(word, size, font) <= maxWidth) {
          current = word;
          continue;
        }
        // A single long token: split by characters so it never overflows.
        let chunk = '';
        for (const character of word) {
          if (this.measure(`${chunk}${character}`, size, font) > maxWidth && chunk.length > 0) {
            lines.push(chunk);
            chunk = character;
          } else {
            chunk += character;
          }
        }
        current = chunk;
      }

      if (current.length > 0) lines.push(current);
    }

    return lines;
  }

  /** Draw text with the origin measured from the top-left corner. */
  text(x: number, y: number, value: string, options: PdfTextOptions = {}): void {
    if (value.length === 0) return;
    const { size = 10, font = 'regular', color = PDF_COLORS.ink } = options;
    const page = this.currentPage();
    const pdfY = this.height - y - size;

    page.operations.push(
      `BT /F${font === 'bold' ? 2 : 1} ${size} Tf ${colourCommand(color)} rg ` +
        `1 0 0 1 ${round2(x)} ${round2(pdfY)} Tm (${escapeLiteral(toWinAnsi(value))}) Tj ET`,
    );
  }

  /** Right-aligned text at `right`. */
  textRight(right: number, y: number, value: string, options: PdfTextOptions = {}): void {
    const { size = 10, font = 'regular' } = options;
    this.text(right - this.measure(value, size, font), y, value, options);
  }

  /** Centred text between `left` and `right`. */
  textCentered(
    left: number,
    right: number,
    y: number,
    value: string,
    options: PdfTextOptions = {},
  ) {
    const { size = 10, font = 'regular' } = options;
    const width = this.measure(value, size, font);
    this.text(left + (right - left - width) / 2, y, value, options);
  }

  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: { width?: number; color?: PdfColor } = {},
  ): void {
    const { width = 0.75, color = PDF_COLORS.border } = options;
    const page = this.currentPage();
    page.operations.push(
      `${round2(width)} w ${colourCommand(color)} RG ` +
        `${round2(x1)} ${round2(this.height - y1)} m ${round2(x2)} ${round2(this.height - y2)} l S`,
    );
  }

  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    colour: PdfColor = PDF_COLORS.surfaceMuted,
  ): void {
    const page = this.currentPage();
    page.operations.push(
      `${colourCommand(colour)} rg ${round2(x)} ${round2(this.height - y - height)} ` +
        `${round2(width)} ${round2(height)} re f`,
    );
  }

  /** Serialise the document, including the cross-reference table. */
  toBytes(): Uint8Array<ArrayBuffer> {
    const objects: string[] = [];

    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    objects.push(''); // Pages object, filled in once page numbers are known
    objects.push(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    );
    objects.push(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    );

    const pageObjectNumbers: number[] = [];

    for (const page of this.pages) {
      const content = page.operations.join('\n');
      const contentNumber = objects.length + 1;
      objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

      const pageNumber = objects.length + 1;
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
          `/Contents ${contentNumber} 0 R >>`,
      );
      pageObjectNumbers.push(pageNumber);
    }

    const kids = pageObjectNumbers.map((number) => `${number} 0 R`).join(' ');
    objects[1] = `<< /Type /Pages /Kids [${kids}] /Count ${pageObjectNumbers.length} >>`;

    let file = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';
    const offsets: number[] = [];

    objects.forEach((body, index) => {
      offsets.push(file.length);
      file += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });

    const startXref = file.length;
    file += `xref\n0 ${objects.length + 1}\n`;
    file += '0000000000 65535 f \n';
    for (const offset of offsets) {
      file += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
    file += `startxref\n${startXref}\n%%EOF\n`;

    return Uint8Array.from(file, (character) => character.charCodeAt(0) & 0xff);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
