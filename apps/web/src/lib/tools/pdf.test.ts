import { describe, expect, it } from 'vitest';
import { PdfDocument, PDF_PAGE } from './pdf';
import { renderDocumentPdf } from './document-pdf';

function toLatin1(bytes: Uint8Array): string {
  let output = '';
  for (const byte of bytes) output += String.fromCharCode(byte);
  return output;
}

/** Pull every literal string drawn with Tj, unescaping PDF string escapes. */
function extractText(bytes: Uint8Array): string {
  const source = toLatin1(bytes);
  const lines: string[] = [];
  const pattern = /\(((?:\\.|[^\\()])*)\)\s*Tj/g;
  let match: RegExpExecArray | null = pattern.exec(source);

  while (match) {
    const raw = match[1] ?? '';
    lines.push(raw.replace(/\\([\\()])/g, '$1'));
    match = pattern.exec(source);
  }

  return lines.join('\n');
}

describe('PdfDocument', () => {
  it('writes a header, trailer and a startxref that points at the table', () => {
    const doc = new PdfDocument();
    doc.text(48, 48, 'Hello world', { size: 12 });
    const source = toLatin1(doc.toBytes());

    expect(source.startsWith('%PDF-1.4')).toBe(true);
    expect(source.trimEnd().endsWith('%%EOF')).toBe(true);

    const startXref = Number(/startxref\n(\d+)\n/.exec(source)?.[1]);
    expect(Number.isInteger(startXref)).toBe(true);
    expect(source.slice(startXref, startXref + 4)).toBe('xref');
  });

  it('writes xref offsets that resolve to real objects', () => {
    const doc = new PdfDocument();
    doc.text(48, 48, 'Page one');
    doc.addPage();
    doc.text(48, 48, 'Page two');
    const bytes = doc.toBytes();
    const source = toLatin1(bytes);

    const tableStart = source.indexOf('xref');
    const table = source.slice(tableStart);
    const entries = [...table.matchAll(/^(\d{10}) (\d{5}) ([nf]) $/gm)];
    expect(entries.length).toBeGreaterThan(3);

    const size = Number(/\/Size (\d+)/.exec(source)?.[1]);
    expect(entries.length).toBe(size);

    for (const entry of entries) {
      if (entry[3] === 'f') continue;
      const offset = Number(entry[1]);
      expect(source.slice(offset)).toMatch(/^\d+ 0 obj\n/);
    }
  });

  it('declares one page object per page', () => {
    const doc = new PdfDocument();
    doc.addPage();
    doc.addPage();
    const source = toLatin1(doc.toBytes());

    expect(doc.pageCount).toBe(3);
    expect(source).toContain('/Count 3');
    expect([...source.matchAll(/\/Type \/Page\b/g)]).toHaveLength(3);
  });

  it('escapes parentheses and backslashes in text', () => {
    const doc = new PdfDocument();
    doc.text(48, 48, 'Deposit (50%) \\ final');
    const text = extractText(doc.toBytes());

    expect(text).toBe('Deposit (50%) \\ final');
  });

  it('transliterates currency symbols that WinAnsi cannot represent', () => {
    const doc = new PdfDocument();
    doc.text(48, 48, '\u20A61,250.50');
    expect(extractText(doc.toBytes())).toBe('NGN 1,250.50');
  });

  it('wraps text to the requested width without losing characters', () => {
    const doc = new PdfDocument();
    const source = 'The quick brown fox jumps over the lazy dog and keeps on running for a while.';
    const lines = doc.wrap(source, 10, 'regular', 140);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(doc.measure(line, 10)).toBeLessThanOrEqual(140.5);
    }
    expect(lines.join(' ').replace(/\s+/g, ' ')).toBe(source);
  });

  it('measures bold text wider than regular text', () => {
    const doc = new PdfDocument();
    expect(doc.measure('Invoice', 12, 'bold')).toBeGreaterThan(doc.measure('Invoice', 12));
  });

  it('rejects selecting a page that does not exist', () => {
    const doc = new PdfDocument();
    expect(() => doc.selectPage(4)).toThrow(RangeError);
  });
});

describe('renderDocumentPdf', () => {
  const base = {
    kind: 'invoice' as const,
    currency: 'NGN' as const,
    number: 'INV-0001',
    issueDate: '2026-11-18',
    dueDate: '2026-12-02',
    seller: { name: 'QuickBiz Studio', lines: ['Lagos, Nigeria', 'hello@quickbiz.example'] },
    client: { name: 'Ada Obi', lines: ['14 Marina Road'] },
    lines: [
      { id: '1', description: 'Brand identity design', quantity: 1, unitPriceMinor: 100_000 },
      { id: '2', description: 'Landing page (50%) deposit', quantity: 2, unitPriceMinor: 25_000 },
    ],
    discountType: 'percent' as const,
    discountValue: 10,
    taxPercent: 7.5,
    shippingMinor: 2_000,
    notes: 'Thank you for your business.',
    terms: 'Payment due within 14 days.',
  };

  it('renders the identity, line items and totals', () => {
    const text = extractText(renderDocumentPdf(base));

    expect(text).toContain('INVOICE');
    expect(text).toContain('INV-0001');
    expect(text).toContain('Ada Obi');
    expect(text).toContain('Brand identity design');
    expect(text).toContain('NGN 1,000.00');
    expect(text).toContain('Discount (10%)');
    expect(text).toContain('Tax (7.5%)');
    expect(text).toContain('Total');
    expect(text).toContain('Payment due within 14 days.');
  });

  it('computes the printed total from the same arithmetic as the screen', () => {
    // 100,000 + 50,000 minor units = 150,000; minus 10% = 135,000; plus 7.5% tax
    // = 145,125; plus 2,000 shipping = 147,125 minor units.
    const text = extractText(renderDocumentPdf(base));
    expect(text).toContain('NGN 1,471.25');
  });

  it('labels a quotation and uses its own date row', () => {
    const text = extractText(
      renderDocumentPdf({
        ...base,
        kind: 'quotation',
        number: 'QUO-0007',
        dueDate: undefined,
        validUntil: '2026-12-31',
      }),
    );

    expect(text).toContain('QUOTATION');
    expect(text).toContain('QUO-0007');
    expect(text).toContain('Valid until');
    // The invoice-only due-date row must not appear on a quotation.
    expect(text.split('\n')).not.toContain('Due');
  });

  it('paginates a long document and numbers every page', () => {
    const lines = Array.from({ length: 70 }, (_value, index) => ({
      id: `line-${index}`,
      description: `Consulting session ${index + 1} with a detailed scope of work`,
      quantity: 1,
      unitPriceMinor: 5_000,
    }));

    const bytes = renderDocumentPdf({ ...base, lines });
    const source = toLatin1(bytes);
    const text = extractText(bytes);

    expect(source).toMatch(/\/Count ([2-9]\d*)/);
    expect(text).toContain('Page 1 of');
    expect(text).toContain('Consulting session 70');
  });

  it('keeps the page size at A4', () => {
    const source = toLatin1(renderDocumentPdf(base));
    expect(source).toContain(`/MediaBox [0 0 ${PDF_PAGE.width} ${PDF_PAGE.height}]`);
  });
});
