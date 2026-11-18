import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_CURRENCIES,
  computeDocumentTotals,
  documentFileName,
  documentNumberPrefix,
  formatAmount,
  lineTotalMinor,
  parseAmountToMinor,
  validateDocumentDraft,
  type DocumentDraftInput,
  type DocumentLine,
} from '../tools/documents';

const line = (overrides: Partial<DocumentLine> = {}): DocumentLine => ({
  id: 'line-1',
  description: 'Design work',
  quantity: 2,
  unitPriceMinor: 50_000,
  ...overrides,
});

const draft = (overrides: Partial<DocumentDraftInput> = {}): DocumentDraftInput => ({
  kind: 'invoice',
  currency: 'NGN',
  number: 'INV-0001',
  issueDate: '2026-11-18',
  dueDate: '2026-12-02',
  sellerName: 'QuickBiz Studio',
  clientName: 'Ada Obi',
  lines: [line()],
  discountType: 'none',
  discountValue: 0,
  taxPercent: 0,
  shippingMinor: 0,
  ...overrides,
});

describe('document totals', () => {
  it('rounds a line total once, in minor units', () => {
    expect(lineTotalMinor(line({ quantity: 3, unitPriceMinor: 33_333 }))).toBe(99_999);
    expect(lineTotalMinor(line({ quantity: 2.5, unitPriceMinor: 10_000 }))).toBe(25_000);
  });

  it('adds lines, discount, tax and shipping in order', () => {
    const totals = computeDocumentTotals({
      lines: [line(), line({ id: 'line-2', quantity: 1, unitPriceMinor: 25_000 })],
      discountType: 'percent',
      discountValue: 10,
      taxPercent: 7.5,
      shippingMinor: 2_000,
    });

    expect(totals.subtotalMinor).toBe(125_000);
    expect(totals.discountMinor).toBe(12_500);
    expect(totals.taxableMinor).toBe(112_500);
    expect(totals.taxMinor).toBe(8_438);
    expect(totals.shippingMinor).toBe(2_000);
    expect(totals.totalMinor).toBe(122_938);
  });

  it('supports a fixed-amount discount and clamps it to the subtotal', () => {
    const totals = computeDocumentTotals({
      lines: [line()],
      discountType: 'amount',
      discountValue: 500_000,
      taxPercent: 0,
      shippingMinor: 0,
    });

    expect(totals.discountMinor).toBe(100_000);
    expect(totals.totalMinor).toBe(0);
  });

  it('ignores a discount when the type is none', () => {
    const totals = computeDocumentTotals({
      lines: [line()],
      discountType: 'none',
      discountValue: 50,
      taxPercent: 0,
      shippingMinor: 0,
    });
    expect(totals.discountMinor).toBe(0);
  });

  it('clamps percentages and negative values instead of producing nonsense', () => {
    const totals = computeDocumentTotals({
      lines: [line()],
      discountType: 'percent',
      discountValue: 400,
      taxPercent: 250,
      shippingMinor: -500,
    });
    expect(totals.discountMinor).toBe(100_000);
    expect(totals.taxMinor).toBe(0);
    expect(totals.shippingMinor).toBe(0);
    expect(totals.totalMinor).toBe(0);
  });

  it('keeps an empty document at zero', () => {
    expect(
      computeDocumentTotals({
        lines: [],
        discountType: 'none',
        discountValue: 0,
        taxPercent: 18,
        shippingMinor: 0,
      }).totalMinor,
    ).toBe(0);
  });
});

describe('money parsing and formatting', () => {
  it('parses typed amounts into minor units', () => {
    expect(parseAmountToMinor('1,250.50', 'NGN')).toBe(125_050);
    expect(parseAmountToMinor('0', 'USD')).toBe(0);
    expect(parseAmountToMinor('12.345', 'USD')).toBe(1_235);
  });

  it('rejects empty, negative and malformed amounts', () => {
    expect(parseAmountToMinor('', 'NGN')).toBeNull();
    expect(parseAmountToMinor('-5', 'NGN')).toBeNull();
    expect(parseAmountToMinor('abc', 'NGN')).toBeNull();
  });

  it('formats an amount for the document currency', () => {
    expect(formatAmount(125_050, 'NGN')).toContain('1,250.50');
    expect(formatAmount(1_000, 'USD')).toBe('$10.00');
  });
});

describe('document validation', () => {
  it('accepts a complete draft', () => {
    expect(validateDocumentDraft(draft()).valid).toBe(true);
  });

  it('requires the identity fields', () => {
    const result = validateDocumentDraft(draft({ clientName: '  ', sellerName: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors['clientName']).toBe('client-required');
    expect(result.errors['sellerName']).toBe('seller-required');
  });

  it('rejects a due date before the issue date', () => {
    const result = validateDocumentDraft(draft({ dueDate: '2026-11-01' }));
    expect(result.errors['dueDate']).toBe('date-before-issue');
  });

  it('requires at least one complete line', () => {
    const empty = validateDocumentDraft(draft({ lines: [] }));
    expect(empty.errors['lines']).toBe('lines-required');

    const incomplete = validateDocumentDraft(
      draft({ lines: [line({ description: ' ', quantity: 0, unitPriceMinor: -1 })] }),
    );
    expect(incomplete.errors['lines.0.description']).toBe('description-required');
    expect(incomplete.errors['lines.0.quantity']).toBe('quantity-invalid');
    expect(incomplete.errors['lines.0.unitPriceMinor']).toBe('price-invalid');
  });

  it('rejects out-of-range discount and tax values', () => {
    expect(
      validateDocumentDraft(draft({ discountType: 'percent', discountValue: 120 })).errors[
        'discountValue'
      ],
    ).toBe('discount-invalid');
    expect(validateDocumentDraft(draft({ taxPercent: -1 })).errors['taxPercent']).toBe(
      'tax-invalid',
    );
  });

  it('rejects a document whose total is zero', () => {
    const result = validateDocumentDraft(
      draft({ lines: [line({ quantity: 1, unitPriceMinor: 0 })] }),
    );
    expect(result.errors['lines']).toBe('total-not-positive');
  });
});

describe('document metadata', () => {
  it('uses an obvious prefix per kind', () => {
    expect(documentNumberPrefix('invoice')).toBe('INV');
    expect(documentNumberPrefix('quotation')).toBe('QUO');
  });

  it('builds a safe file name', () => {
    expect(documentFileName('invoice', 'INV-0001')).toBe('invoice-INV-0001.pdf');
    expect(documentFileName('quotation', '  ')).toBe('quotation-document.pdf');
    expect(documentFileName('invoice', 'INV/2026 #4')).toBe('invoice-INV-2026-4.pdf');
  });

  it('offers only enabled currencies', () => {
    expect(DOCUMENT_CURRENCIES).toContain('NGN');
    expect(DOCUMENT_CURRENCIES).toContain('USD');
    expect(DOCUMENT_CURRENCIES).not.toContain('JPY');
  });
});
