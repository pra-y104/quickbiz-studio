/**
 * Invoice and quotation model.
 *
 * Money is always integer minor units (kobo, cents) and every calculation
 * rounds at the point where a line total or a tax amount becomes money, so the
 * printed totals are reproducible and the sum of the lines always equals the
 * subtotal shown.
 */

import { formatMoney, toMinorUnits } from '../format/currency';
import { CURRENCIES, type CurrencyCode } from '../types/currency';
import { parseDecimalInput } from './arithmetic';

export const DOCUMENT_KINDS = ['invoice', 'quotation'] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export interface DocumentLine {
  readonly id: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPriceMinor: number;
}

export const DISCOUNT_TYPES = ['none', 'percent', 'amount'] as const;

export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export interface DocumentPricingInput {
  readonly lines: readonly DocumentLine[];
  readonly discountType: DiscountType;
  /** Percentage 0-100, or an amount in minor units, depending on the type. */
  readonly discountValue: number;
  readonly taxPercent: number;
  readonly shippingMinor: number;
}

export interface DocumentTotals {
  readonly subtotalMinor: number;
  readonly discountMinor: number;
  /** Subtotal minus discount; tax is charged on this amount. */
  readonly taxableMinor: number;
  readonly taxMinor: number;
  readonly shippingMinor: number;
  readonly totalMinor: number;
}

export function documentNumberPrefix(kind: DocumentKind): string {
  return kind === 'invoice' ? 'INV' : 'QUO';
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function clampPercent(percent: number): number {
  return clamp(percent, 0, 100);
}

/** Quantity × unit price, rounded to the smallest currency unit once. */
export function lineTotalMinor(line: DocumentLine): number {
  const quantity = Math.max(0, Number.isFinite(line.quantity) ? line.quantity : 0);
  const price = Math.max(0, Number.isFinite(line.unitPriceMinor) ? line.unitPriceMinor : 0);
  return Math.round(quantity * price);
}

export function computeDocumentTotals(input: DocumentPricingInput): DocumentTotals {
  const subtotalMinor = input.lines.reduce((total, line) => total + lineTotalMinor(line), 0);

  let discountMinor = 0;
  if (input.discountType === 'percent') {
    discountMinor = Math.round((subtotalMinor * clampPercent(input.discountValue)) / 100);
  } else if (input.discountType === 'amount') {
    discountMinor = Math.round(clamp(input.discountValue, 0, subtotalMinor));
  }
  discountMinor = clamp(discountMinor, 0, subtotalMinor);

  const taxableMinor = subtotalMinor - discountMinor;
  const taxMinor = Math.round((taxableMinor * clampPercent(input.taxPercent)) / 100);
  const shippingMinor = Math.max(
    0,
    Math.round(Number.isFinite(input.shippingMinor) ? input.shippingMinor : 0),
  );

  return {
    subtotalMinor,
    discountMinor,
    taxableMinor,
    taxMinor,
    shippingMinor,
    totalMinor: taxableMinor + taxMinor + shippingMinor,
  };
}

/** Currencies offered by the document tools, in catalogue order. */
export const DOCUMENT_CURRENCIES: readonly CurrencyCode[] = (
  Object.keys(CURRENCIES) as CurrencyCode[]
).filter((code) => CURRENCIES[code].enabled);

export function getCurrencyDigits(currency: CurrencyCode): number {
  return CURRENCIES[currency].digits;
}

/** Parse a user-typed amount ("1,250.50") into integer minor units. */
export function parseAmountToMinor(value: string, currency: CurrencyCode): number | null {
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  const parsed = parseDecimalInput(cleaned);
  if (parsed === null || parsed < 0) return null;
  return toMinorUnits(parsed, currency);
}

/** Format a minor amount for display and for the printed document. */
export function formatAmount(amountMinor: number, currency: CurrencyCode): string {
  return formatMoney({ amountMinor, currency, locale: 'en' });
}

/** Editable draft of a document, before it is rendered or downloaded. */
export interface DocumentDraftInput {
  readonly kind: DocumentKind;
  readonly currency: CurrencyCode;
  readonly number: string;
  readonly issueDate: string;
  /** Invoice only: payment due date. */
  readonly dueDate?: string;
  /** Quotation only: how long the price stands. */
  readonly validUntil?: string;
  readonly sellerName: string;
  readonly clientName: string;
  readonly lines: readonly DocumentLine[];
  readonly discountType: DiscountType;
  readonly discountValue: number;
  readonly taxPercent: number;
  readonly shippingMinor: number;
}

export const DOCUMENT_ERROR_CODES = [
  'number-required',
  'date-required',
  'date-before-issue',
  'seller-required',
  'client-required',
  'lines-required',
  'description-required',
  'quantity-invalid',
  'price-invalid',
  'discount-invalid',
  'tax-invalid',
  'shipping-invalid',
  'total-not-positive',
] as const;

export type DocumentErrorCode = (typeof DOCUMENT_ERROR_CODES)[number];

export type DocumentValidationErrors = Readonly<Record<string, DocumentErrorCode>>;

export interface DocumentValidation {
  readonly valid: boolean;
  readonly errors: DocumentValidationErrors;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/**
 * Validate a draft. Keys are field paths (`lines.0.quantity`), so the form can
 * attach the message to the exact control.
 */
export function validateDocumentDraft(draft: DocumentDraftInput): DocumentValidation {
  const errors: Record<string, DocumentErrorCode> = {};

  if (draft.number.trim().length === 0) errors['number'] = 'number-required';
  if (!isIsoDate(draft.issueDate)) errors['issueDate'] = 'date-required';
  if (draft.kind === 'invoice' && draft.dueDate && isIsoDate(draft.dueDate)) {
    if (draft.dueDate < draft.issueDate) errors['dueDate'] = 'date-before-issue';
  }
  if (draft.kind === 'quotation' && draft.validUntil && isIsoDate(draft.validUntil)) {
    if (draft.validUntil < draft.issueDate) errors['validUntil'] = 'date-before-issue';
  }
  if (draft.sellerName.trim().length === 0) errors['sellerName'] = 'seller-required';
  if (draft.clientName.trim().length === 0) errors['clientName'] = 'client-required';

  if (draft.lines.length === 0) {
    errors['lines'] = 'lines-required';
  }

  draft.lines.forEach((line, index) => {
    if (line.description.trim().length === 0) {
      errors[`lines.${index}.description`] = 'description-required';
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      errors[`lines.${index}.quantity`] = 'quantity-invalid';
    }
    if (!Number.isFinite(line.unitPriceMinor) || line.unitPriceMinor < 0) {
      errors[`lines.${index}.unitPriceMinor`] = 'price-invalid';
    }
  });

  if (draft.discountType === 'percent') {
    if (
      !Number.isFinite(draft.discountValue) ||
      draft.discountValue < 0 ||
      draft.discountValue > 100
    ) {
      errors['discountValue'] = 'discount-invalid';
    }
  } else if (draft.discountType === 'amount') {
    if (!Number.isFinite(draft.discountValue) || draft.discountValue < 0) {
      errors['discountValue'] = 'discount-invalid';
    }
  }

  if (!Number.isFinite(draft.taxPercent) || draft.taxPercent < 0 || draft.taxPercent > 100) {
    errors['taxPercent'] = 'tax-invalid';
  }
  if (!Number.isFinite(draft.shippingMinor) || draft.shippingMinor < 0) {
    errors['shippingMinor'] = 'shipping-invalid';
  }

  if (Object.keys(errors).length === 0) {
    const totals = computeDocumentTotals(draft);
    if (totals.totalMinor <= 0) errors['lines'] = 'total-not-positive';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Safe file name for a downloaded document, e.g. `invoice-INV-0001.pdf`. */
export function documentFileName(kind: DocumentKind, number: string): string {
  const safe = number
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  const fallback = kind === 'invoice' ? 'invoice' : 'quotation';
  return `${fallback}-${safe.length > 0 ? safe : 'document'}.pdf`;
}
