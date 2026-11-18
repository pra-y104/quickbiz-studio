/**
 * Invoice and quotation PDF layout.
 *
 * The same layout renders both document kinds; only the labels and the third
 * date row differ. Totals are recomputed here from the raw lines so a caller
 * can never print a number that disagrees with the arithmetic.
 */

import {
  computeDocumentTotals,
  formatMoney,
  type CurrencyCode,
  type DocumentKind,
  type DocumentLine,
  type DocumentTotals,
  type DiscountType,
  parseIsoDate,
} from '@quickbiz/shared';
import { PDF_COLORS, PDF_PAGE, PdfDocument } from './pdf';

const LEFT = PDF_PAGE.margin;
const RIGHT = PDF_PAGE.width - PDF_PAGE.margin;
const BOTTOM_LIMIT = PDF_PAGE.height - 96;

const DESCRIPTION_LEFT = LEFT;
const DESCRIPTION_WIDTH = 236;
const QUANTITY_RIGHT = 396;
const UNIT_PRICE_RIGHT = 474;
const AMOUNT_RIGHT = RIGHT;
const TOTALS_LEFT = 336;

export interface PdfParty {
  readonly name: string;
  /** Address, phone, email or tax identifier: one short line each. */
  readonly lines: readonly string[];
}

export interface PdfDocumentInput {
  readonly kind: DocumentKind;
  readonly currency: CurrencyCode;
  readonly number: string;
  readonly issueDate: string;
  readonly dueDate?: string;
  readonly validUntil?: string;
  readonly seller: PdfParty;
  readonly client: PdfParty;
  readonly lines: readonly DocumentLine[];
  readonly discountType: DiscountType;
  readonly discountValue: number;
  readonly taxPercent: number;
  readonly shippingMinor: number;
  readonly notes?: string;
  readonly terms?: string;
}

function money(amountMinor: number, currency: CurrencyCode): string {
  // The ISO code is used instead of a symbol so the PDF renders identically in
  // every currency, including ones whose symbol is outside WinAnsi.
  return `${currency} ${formatMoney({ amountMinor, currency, locale: 'en', plain: true })}`;
}

function pdfDate(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function quantityLabel(quantity: number): string {
  const rounded = Math.round(quantity * 100) / 100;
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(rounded);
}

function uppercaseLabel(doc: PdfDocument, x: number, y: number, value: string): void {
  doc.text(x, y, value.toUpperCase(), {
    size: 7.5,
    font: 'bold',
    color: PDF_COLORS.inkSubtle,
  });
}

function drawHeader(doc: PdfDocument, input: PdfDocumentInput): number {
  doc.text(LEFT, 54, 'QuickBiz Studio', {
    size: 16,
    font: 'bold',
    color: PDF_COLORS.brand,
  });
  doc.text(LEFT, 74, 'Everyday business tools', {
    size: 8.5,
    color: PDF_COLORS.inkSubtle,
  });

  doc.textRight(RIGHT, 50, input.kind === 'invoice' ? 'INVOICE' : 'QUOTATION', {
    size: 21,
    font: 'bold',
  });
  doc.textRight(RIGHT, 76, input.number, {
    size: 10,
    color: PDF_COLORS.inkMuted,
  });

  doc.line(LEFT, 94, RIGHT, 94, { width: 1, color: PDF_COLORS.brand });

  return 112;
}

function drawParty(
  doc: PdfDocument,
  x: number,
  y: number,
  heading: string,
  party: PdfParty,
): number {
  uppercaseLabel(doc, x, y, heading);
  doc.text(x, y + 13, party.name, { size: 11, font: 'bold' });

  let cursor = y + 30;
  for (const line of party.lines) {
    if (line.trim().length === 0) continue;
    doc.text(x, cursor, line, { size: 9, color: PDF_COLORS.inkMuted });
    cursor += 12;
  }

  return cursor;
}

function drawParties(doc: PdfDocument, input: PdfDocumentInput, startY: number): number {
  const leftEnd = drawParty(doc, LEFT, startY, 'From', input.seller);

  const metaRows: Array<[string, string]> = [['Issued', pdfDate(input.issueDate)]];
  if (input.kind === 'invoice' && input.dueDate) {
    metaRows.push(['Due', pdfDate(input.dueDate)]);
  }
  if (input.kind === 'quotation' && input.validUntil) {
    metaRows.push(['Valid until', pdfDate(input.validUntil)]);
  }
  metaRows.push(['Currency', input.currency]);

  let metaY = startY;
  for (const [label, value] of metaRows) {
    doc.text(RIGHT - 150, metaY, label, { size: 8.5, color: PDF_COLORS.inkSubtle });
    doc.textRight(RIGHT, metaY, value, { size: 9, color: PDF_COLORS.ink });
    metaY += 14;
  }

  let y = Math.max(leftEnd, metaY) + 20;
  y = drawParty(doc, LEFT, y, input.kind === 'invoice' ? 'Bill to' : 'Prepared for', input.client);

  return y + 12;
}

function drawTableHeader(doc: PdfDocument, y: number): number {
  const height = 22;
  doc.rect(LEFT, y, RIGHT - LEFT, height, PDF_COLORS.surfaceMuted);
  uppercaseLabel(doc, DESCRIPTION_LEFT + 8, y + 7, 'Description');
  doc.textRight(QUANTITY_RIGHT, y + 7, 'Qty', {
    size: 7.5,
    font: 'bold',
    color: PDF_COLORS.inkSubtle,
  });
  doc.textRight(UNIT_PRICE_RIGHT, y + 7, 'Unit price', {
    size: 7.5,
    font: 'bold',
    color: PDF_COLORS.inkSubtle,
  });
  doc.textRight(AMOUNT_RIGHT - 8, y + 7, 'Amount', {
    size: 7.5,
    font: 'bold',
    color: PDF_COLORS.inkSubtle,
  });
  return y + height;
}

function drawItems(doc: PdfDocument, input: PdfDocumentInput, startY: number): number {
  let y = drawTableHeader(doc, startY);

  for (const line of input.lines) {
    const description = line.description.trim().length > 0 ? line.description : 'Item';
    const wrapped = doc.wrap(description, 9.5, 'regular', DESCRIPTION_WIDTH);
    // A pathological description must not push the totals off the page.
    const truncated = wrapped.length > 26;
    const visible = truncated ? [...wrapped.slice(0, 26)] : wrapped;
    if (truncated) visible[visible.length - 1] = `${visible[visible.length - 1] ?? ''}…`;
    const rowHeight = Math.max(22, visible.length * 12.5 + 9);

    if (y + rowHeight > BOTTOM_LIMIT) {
      doc.addPage();
      y = drawTableHeader(doc, 72);
    }

    let textY = y + 8;
    for (const part of visible) {
      doc.text(DESCRIPTION_LEFT + 8, textY, part, { size: 9.5 });
      textY += 12.5;
    }

    const lineTotal = Math.round(line.quantity * line.unitPriceMinor);
    doc.textRight(QUANTITY_RIGHT, y + 8, quantityLabel(line.quantity), {
      size: 9.5,
      color: PDF_COLORS.inkMuted,
    });
    doc.textRight(UNIT_PRICE_RIGHT, y + 8, money(line.unitPriceMinor, input.currency), {
      size: 9.5,
      color: PDF_COLORS.inkMuted,
    });
    doc.textRight(AMOUNT_RIGHT - 8, y + 8, money(lineTotal, input.currency), {
      size: 9.5,
      font: 'bold',
    });

    y += rowHeight;
    doc.line(LEFT, y, RIGHT, y, { width: 0.5, color: PDF_COLORS.border });
  }

  return y + 14;
}

function drawTotals(
  doc: PdfDocument,
  input: PdfDocumentInput,
  totals: DocumentTotals,
  startY: number,
): number {
  let y = startY;
  const estimatedHeight = 18 * (totals.discountMinor > 0 ? 5 : 4) + 40;
  if (y + estimatedHeight > BOTTOM_LIMIT) {
    doc.addPage();
    y = 72;
  }

  const row = (label: string, value: string, options: { bold?: boolean } = {}) => {
    doc.text(TOTALS_LEFT, y, label, {
      size: options.bold ? 11 : 9.5,
      font: options.bold ? 'bold' : 'regular',
      color: options.bold ? PDF_COLORS.ink : PDF_COLORS.inkMuted,
    });
    doc.textRight(RIGHT, y, value, {
      size: options.bold ? 11 : 9.5,
      font: options.bold ? 'bold' : 'regular',
    });
    y += options.bold ? 22 : 16;
  };

  row('Subtotal', money(totals.subtotalMinor, input.currency));

  if (totals.discountMinor > 0) {
    const suffix =
      input.discountType === 'percent'
        ? ` (${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(
            input.discountValue,
          )}%)`
        : '';
    row(`Discount${suffix}`, `-${money(totals.discountMinor, input.currency)}`);
  }

  if (totals.taxMinor > 0) {
    const taxLabel = `Tax (${new Intl.NumberFormat('en', {
      maximumFractionDigits: 2,
    }).format(input.taxPercent)}%)`;
    row(taxLabel, money(totals.taxMinor, input.currency));
  }

  if (totals.shippingMinor > 0) {
    row('Shipping', money(totals.shippingMinor, input.currency));
  }

  doc.line(TOTALS_LEFT, y - 4, RIGHT, y - 4, { width: 0.75, color: PDF_COLORS.border });
  y += 4;
  row('Total', money(totals.totalMinor, input.currency), { bold: true });

  return y;
}

function drawNotes(doc: PdfDocument, input: PdfDocumentInput, startY: number): number {
  const blocks: Array<[string, string]> = [];
  if (input.notes?.trim()) blocks.push(['Notes', input.notes.trim()]);
  if (input.terms?.trim()) {
    blocks.push([input.kind === 'invoice' ? 'Payment terms' : 'Terms', input.terms.trim()]);
  }
  if (blocks.length === 0) return startY;

  let y = startY + 8;
  for (const [heading, body] of blocks) {
    if (y > BOTTOM_LIMIT - 40) {
      doc.addPage();
      y = 72;
    }

    uppercaseLabel(doc, LEFT, y, heading);
    y += 14;
    const wrapped = doc.wrap(body, 9, 'regular', RIGHT - LEFT);
    for (const line of wrapped.slice(0, 18)) {
      doc.text(LEFT, y, line, { size: 9, color: PDF_COLORS.inkMuted });
      y += 12;
    }
    y += 8;
  }

  return y;
}

function drawFooters(doc: PdfDocument, input: PdfDocumentInput): void {
  const total = doc.pageCount;
  const kindLabel = input.kind === 'invoice' ? 'Invoice' : 'Quotation';

  for (let index = 0; index < total; index += 1) {
    doc.selectPage(index);
    const y = PDF_PAGE.height - 56;
    doc.line(LEFT, y - 10, RIGHT, y - 10, { width: 0.5, color: PDF_COLORS.border });
    doc.text(LEFT, y, `${kindLabel} ${input.number} · Created with QuickBiz Studio`, {
      size: 8,
      color: PDF_COLORS.inkSubtle,
    });
    doc.textRight(RIGHT, y, `Page ${index + 1} of ${total}`, {
      size: 8,
      color: PDF_COLORS.inkSubtle,
    });
  }
}

export function renderDocumentPdf(input: PdfDocumentInput): Uint8Array<ArrayBuffer> {
  const doc = new PdfDocument();
  const totals = computeDocumentTotals(input);

  let y = drawHeader(doc, input);
  y = drawParties(doc, input, y);
  y = drawItems(doc, input, y);
  y = drawTotals(doc, input, totals, y);
  drawNotes(doc, input, y);
  drawFooters(doc, input);

  return doc.toBytes();
}
