import {
  DEFAULT_CURRENCY,
  DOCUMENT_CURRENCIES,
  computeDocumentTotals,
  documentFileName,
  documentNumberPrefix,
  formatAmount,
  getCurrency,
  lineTotalMinor,
  parseAmountToMinor,
  parseDecimalInput,
  validateDocumentDraft,
  type CurrencyCode,
  type DiscountType,
  type DocumentDraftInput,
  type DocumentErrorCode,
  type DocumentKind,
  type DocumentLine,
  type DocumentValidationErrors,
} from '@quickbiz/shared';
import { Copy, Download, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { renderDocumentPdf } from '../../lib/tools/document-pdf';
import { canDownloadFiles, downloadBytes } from '../../lib/tools/download';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Field } from '../ui/field';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { ToolPage } from './tool-page';

const ERROR_TEXT: Readonly<Record<DocumentErrorCode, string>> = {
  'number-required': 'Give this document a number.',
  'date-required': 'Choose a valid date.',
  'date-before-issue': 'This date cannot be before the issue date.',
  'seller-required': 'Add the name of the business sending this document.',
  'client-required': 'Add the client name.',
  'lines-required': 'Add at least one line item.',
  'description-required': 'Describe what this line is for.',
  'quantity-invalid': 'Quantity must be more than zero.',
  'price-invalid': 'Enter a valid price.',
  'discount-invalid': 'Discount must be between 0 and 100%.',
  'tax-invalid': 'Tax must be between 0 and 100%.',
  'shipping-invalid': 'Shipping must be zero or more.',
  'total-not-positive': 'The total is zero. Add a priced line before downloading.',
};

const DISCOUNT_OPTIONS: ReadonlyArray<{ value: DiscountType; label: string }> = [
  { value: 'none', label: 'No discount' },
  { value: 'percent', label: 'Percentage' },
  { value: 'amount', label: 'Fixed amount' },
];

interface LineDraft {
  readonly id: string;
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: string;
}

interface DraftState {
  readonly number: string;
  readonly issueDate: string;
  readonly secondaryDate: string;
  readonly currency: CurrencyCode;
  readonly sellerName: string;
  readonly sellerDetails: string;
  readonly clientName: string;
  readonly clientDetails: string;
  readonly lines: readonly LineDraft[];
  readonly discountType: DiscountType;
  readonly discountValue: string;
  readonly taxPercent: string;
  readonly shipping: string;
  readonly notes: string;
  readonly terms: string;
}

interface SavedDraft {
  readonly id: string;
  readonly kind: DocumentKind;
  readonly name: string;
  readonly savedAt: string;
  readonly draft: DraftState;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isoFromOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function newLine(): LineDraft {
  return {
    id: `line-${Math.random().toString(36).slice(2, 9)}`,
    description: '',
    quantity: '1',
    unitPrice: '',
  };
}

function initialState(kind: DocumentKind): DraftState {
  return {
    number: `${documentNumberPrefix(kind)}-0001`,
    issueDate: isoFromOffset(0),
    secondaryDate: isoFromOffset(kind === 'invoice' ? 14 : 30),
    currency: DEFAULT_CURRENCY,
    sellerName: '',
    sellerDetails: '',
    clientName: '',
    clientDetails: '',
    lines: [newLine()],
    discountType: 'none',
    discountValue: '',
    taxPercent: '',
    shipping: '',
    notes: '',
    terms: kind === 'invoice' ? 'Payment is due by the date shown above.' : '',
  };
}

function splitDetails(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function draftKey(kind: DocumentKind): string {
  return `quickbiz-draft-${kind}`;
}

function savedDraftsKey(): string {
  return 'quickbiz-saved-drafts';
}

function loadDraft(kind: DocumentKind): DraftState | null {
  try {
    const raw = localStorage.getItem(draftKey(kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftState;
    return parsed;
  } catch {
    return null;
  }
}

function loadSavedDrafts(): readonly SavedDraft[] {
  try {
    const raw = localStorage.getItem(savedDraftsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSavedDrafts(drafts: readonly SavedDraft[]): void {
  try {
    localStorage.setItem(savedDraftsKey(), JSON.stringify(drafts));
  } catch {
    // Storage may be blocked or full.
  }
}

export interface DocumentMakerProps {
  readonly kind: DocumentKind;
}

/**
 * Invoice and quotation editor with preview, save/reopen, copy, print and
 * download.
 *
 * Both documents share one implementation: the arithmetic, validation and PDF
 * layout are identical, and only labels and the second date differ. Drafts are
 * persisted to localStorage so they survive a refresh; nothing is transmitted
 * to a server. The PDF is generated and downloaded on the device.
 */
export function DocumentMaker({ kind }: DocumentMakerProps) {
  const isInvoice = kind === 'invoice';
  const [draft, setDraft] = useState<DraftState>(() => loadDraft(kind) ?? initialState(kind));
  const [errors, setErrors] = useState<DocumentValidationErrors>({});
  const [message, setMessage] = useState<{
    readonly tone: 'success' | 'danger';
    readonly title: string;
    readonly body: string;
  } | null>(null);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [savedDrafts, setSavedDrafts] = useState<readonly SavedDraft[]>(() => loadSavedDrafts());
  const [saving, setSaving] = useState(false);

  const currency = draft.currency;

  function update<K extends keyof DraftState>(key: K, value: DraftState[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  function updateLine(id: string, patch: Partial<LineDraft>): void {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    }));
    setMessage(null);
  }

  const parsedLines = useMemo<DocumentLine[]>(
    () =>
      draft.lines.map((line) => ({
        id: line.id,
        description: line.description,
        quantity: parseDecimalInput(line.quantity) ?? 0,
        unitPriceMinor: parseAmountToMinor(line.unitPrice, currency) ?? 0,
      })),
    [currency, draft.lines],
  );

  const pricing = useMemo(
    () => ({
      lines: parsedLines,
      discountType: draft.discountType,
      discountValue:
        draft.discountType === 'amount'
          ? (parseAmountToMinor(draft.discountValue, currency) ?? 0)
          : (parseDecimalInput(draft.discountValue) ?? 0),
      taxPercent: parseDecimalInput(draft.taxPercent) ?? 0,
      shippingMinor: parseAmountToMinor(draft.shipping, currency) ?? 0,
    }),
    [
      currency,
      draft.discountType,
      draft.discountValue,
      draft.shipping,
      draft.taxPercent,
      parsedLines,
    ],
  );

  const totals = useMemo(() => computeDocumentTotals(pricing), [pricing]);

  const documentDraft = useMemo<DocumentDraftInput>(
    () => ({
      kind,
      currency,
      number: draft.number,
      issueDate: draft.issueDate,
      ...(isInvoice ? { dueDate: draft.secondaryDate } : { validUntil: draft.secondaryDate }),
      sellerName: draft.sellerName,
      clientName: draft.clientName,
      lines: parsedLines,
      discountType: draft.discountType,
      discountValue: pricing.discountValue,
      taxPercent: pricing.taxPercent,
      shippingMinor: pricing.shippingMinor,
    }),
    [currency, draft, isInvoice, kind, parsedLines, pricing],
  );

  const errorList = Object.entries(errors);

  function download(): void {
    const validation = validateDocumentDraft(documentDraft);
    setErrors(validation.errors);

    if (!validation.valid) {
      setMessage({
        tone: 'danger',
        title: 'Finish the highlighted fields',
        body: 'The document is not downloaded until every required detail is correct.',
      });
      return;
    }

    if (!canDownloadFiles()) {
      setMessage({
        tone: 'danger',
        title: 'This browser cannot save files',
        body: 'Open this page in Chrome or another modern browser to download the PDF.',
      });
      return;
    }

    try {
      const bytes = renderDocumentPdf({
        kind,
        currency,
        number: draft.number.trim(),
        issueDate: draft.issueDate,
        ...(isInvoice ? { dueDate: draft.secondaryDate } : { validUntil: draft.secondaryDate }),
        seller: { name: draft.sellerName.trim(), lines: splitDetails(draft.sellerDetails) },
        client: { name: draft.clientName.trim(), lines: splitDetails(draft.clientDetails) },
        lines: parsedLines,
        discountType: draft.discountType,
        discountValue: pricing.discountValue,
        taxPercent: pricing.taxPercent,
        shippingMinor: pricing.shippingMinor,
        notes: draft.notes,
        terms: draft.terms,
      });

      downloadBytes(bytes, documentFileName(kind, draft.number));
      setMessage({
        tone: 'success',
        title: 'PDF ready',
        body: `${documentFileName(kind, draft.number)} was generated on this device and handed to your browser.`,
      });
    } catch {
      setMessage({
        tone: 'danger',
        title: 'The PDF could not be created',
        body: 'Nothing was uploaded. Reload the page and try again.',
      });
    }
  }

  function printDocument(): void {
    const validation = validateDocumentDraft(documentDraft);
    setErrors(validation.errors);
    if (!validation.valid) {
      setMessage({
        tone: 'danger',
        title: 'Finish the highlighted fields',
        body: 'The document cannot be printed until every required detail is correct.',
      });
      return;
    }
    window.print();
  }

  function copyContent(): void {
    const linesText = parsedLines
      .map((line) => `• ${line.description} — ${line.quantity} × ${formatAmount(lineTotalMinor(line), currency)}`)
      .join('\n');
    const content = [
      `${isInvoice ? 'INVOICE' : 'QUOTATION'} #${draft.number}`,
      `Issue date: ${draft.issueDate}`,
      isInvoice ? `Due date: ${draft.secondaryDate}` : `Valid until: ${draft.secondaryDate}`,
      '',
      `From: ${draft.sellerName}`,
      splitDetails(draft.sellerDetails).join('\n') || '',
      '',
      `To: ${draft.clientName}`,
      splitDetails(draft.clientDetails).join('\n') || '',
      '',
      'Line items:',
      linesText || '(no line items)',
      '',
      `Subtotal: ${formatAmount(totals.subtotalMinor, currency)}`,
      totals.discountMinor > 0 ? `Discount: −${formatAmount(totals.discountMinor, currency)}` : '',
      totals.taxMinor > 0 ? `Tax: ${formatAmount(totals.taxMinor, currency)}` : '',
      totals.shippingMinor > 0 ? `Shipping: ${formatAmount(totals.shippingMinor, currency)}` : '',
      `Total: ${formatAmount(totals.totalMinor, currency)}`,
      '',
      draft.notes ? `Notes: ${draft.notes}` : '',
      draft.terms ? `Terms: ${draft.terms}` : '',
      '',
      'Created with QuickBiz Studio',
    ]
      .filter(Boolean)
      .join('\n');

    void navigator.clipboard.writeText(content);
    setMessage({
      tone: 'success',
      title: 'Copied',
      body: 'The document contents were copied to your clipboard.',
    });
  }

  function reset(): void {
    if (!window.confirm(`Clear this ${kind} and start again?`)) return;
    setDraft(initialState(kind));
    setErrors({});
    setMessage(null);
  }

  function saveAs(): void {
    const name = window.prompt('Give this document a name:');
    if (!name?.trim()) return;
    setSaving(true);
    try {
      const entry: SavedDraft = {
        id: `draft-${Date.now()}`,
        kind,
        name: name.trim(),
        savedAt: new Date().toISOString(),
        draft,
      };
      const next = [...savedDrafts, entry].slice(-50);
      setSavedDrafts(next);
      saveSavedDrafts(next);
      setMessage({
        tone: 'success',
        title: 'Saved',
        body: `“${entry.name}” is saved on this device.`,
      });
    } finally {
      setSaving(false);
    }
  }

  function loadSaved(entry: SavedDraft): void {
    if (entry.kind !== kind) {
      setMessage({
        tone: 'danger',
        title: 'Wrong document type',
        body: 'That saved item is a different document kind.',
      });
      return;
    }
    setDraft(entry.draft);
    setErrors({});
    setMessage(null);
    setTab('edit');
  }

  function deleteSaved(id: string): void {
    if (!window.confirm('Delete this saved document?')) return;
    const next = savedDrafts.filter((entry) => entry.id !== id);
    setSavedDrafts(next);
    saveSavedDrafts(next);
  }

  const previewContent = (
    <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-canvas text-ink">
      <div className="border border-border rounded-xl p-6 sm:p-8 shadow-elev-1 bg-surface">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isInvoice ? 'INVOICE' : 'QUOTATION'}
            </h1>
            <p className="text-sm text-ink-muted">#{draft.number}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-ink">Issue date: {draft.issueDate}</p>
            <p className="text-sm text-ink-muted">
              {isInvoice ? `Due: ${draft.secondaryDate}` : `Valid until: ${draft.secondaryDate}`}
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-3">From</h2>
            <p className="text-sm text-ink font-medium">{draft.sellerName || '—'}</p>
            {splitDetails(draft.sellerDetails).map((line) => (
              <p key={line} className="text-sm text-ink-muted">{line}</p>
            ))}
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-3">To</h2>
            <p className="text-sm text-ink font-medium">{draft.clientName || '—'}</p>
            {splitDetails(draft.clientDetails).map((line) => (
              <p key={line} className="text-sm text-ink-muted">{line}</p>
            ))}
          </div>
        </div>

        <table className="w-full text-sm mb-8 border-collapse">
          <thead>
            <tr className="border-b border-border-strong text-ink-subtle">
              <th className="text-left pb-2">Description</th>
              <th className="text-right pb-2">Qty</th>
              <th className="text-right pb-2">Unit price</th>
              <th className="text-right pb-2">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {parsedLines.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-ink-subtle">
                  No line items
                </td>
              </tr>
            ) : (
              parsedLines.map((line) => (
                <tr key={line.id} className="text-ink">
                  <td className="py-3">{line.description || '—'}</td>
                  <td className="py-3 text-right tabular-nums">{line.quantity}</td>
                  <td className="py-3 text-right tabular-nums">
                    {formatAmount(line.unitPriceMinor, currency)}
                  </td>
                  <td className="py-3 text-right tabular-nums font-medium">
                    {formatAmount(lineTotalMinor(line), currency)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="ml-auto w-full sm:w-96 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-ink-muted">Subtotal</span>
            <span className="text-sm tabular-nums text-ink">{formatAmount(totals.subtotalMinor, currency)}</span>
          </div>
          {totals.discountMinor > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-ink-muted">Discount</span>
              <span className="text-sm tabular-nums text-success">−{formatAmount(totals.discountMinor, currency)}</span>
            </div>
          )}
          {totals.taxMinor > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-ink-muted">Tax</span>
              <span className="text-sm tabular-nums text-ink">{formatAmount(totals.taxMinor, currency)}</span>
            </div>
          )}
          {totals.shippingMinor > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-ink-muted">Shipping</span>
              <span className="text-sm tabular-nums text-ink">{formatAmount(totals.shippingMinor, currency)}</span>
            </div>
          )}
          <div className="border-t border-border-strong pt-3 flex justify-between">
            <span className="text-base font-semibold text-ink">Total</span>
            <span className="text-xl font-semibold tabular-nums text-ink">
              {formatAmount(totals.totalMinor, currency)}
            </span>
          </div>
        </div>

        {draft.notes && (
          <div className="mt-8 pt-4 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Notes</p>
            <p className="mt-1 text-sm text-ink">{draft.notes}</p>
          </div>
        )}
        {draft.terms && (
          <div className="mt-4 pt-2 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Terms</p>
            <p className="mt-1 text-sm text-ink">{draft.terms}</p>
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-border/50 flex items-center justify-between">
          <span className="text-xs text-ink-subtle">
            Created with <span className="font-semibold text-primary">QuickBiz Studio</span>
          </span>
          <span className="text-xs text-ink-subtle">{new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );

  return (
    <ToolPage slug={isInvoice ? 'invoice-maker' : 'quotation-maker'}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{isInvoice ? 'Invoice details' : 'Quotation details'}</CardTitle>
              <CardDescription>
                Totals update as you type. Save drafts to return later, preview before you
                download, or print directly from the browser.
              </CardDescription>
            </div>
            <div className="flex gap-1.5">
              <Button
                type="button"
                variant={tab === 'edit' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTab('edit')}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant={tab === 'preview' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTab('preview')}
              >
                Preview
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {tab === 'edit' ? (
            <>
              <section aria-labelledby="document-basics" className="space-y-3">
                <h2 id="document-basics" className="text-sm font-semibold text-ink">
                  Document
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={isInvoice ? 'Invoice number' : 'Quotation number'}
                    htmlFor="document-number"
                    error={errors['number'] ? ERROR_TEXT[errors['number']] : undefined}
                  >
                    <Input
                      id="document-number"
                      value={draft.number}
                      onChange={(event) => update('number', event.target.value)}
                      autoComplete="off"
                      aria-invalid={Boolean(errors['number'])}
                    />
                  </Field>

                  <div className="space-y-1.5">
                    <Label htmlFor="document-currency">Currency</Label>
                    <Select
                      id="document-currency"
                      value={currency}
                      onChange={(event) => update('currency', event.target.value as CurrencyCode)}
                    >
                      {DOCUMENT_CURRENCIES.map((code) => (
                        <option key={code} value={code}>
                          {code} — {getCurrency(code).name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <Field
                    label="Issue date"
                    htmlFor="document-issued"
                    error={errors['issueDate'] ? ERROR_TEXT[errors['issueDate']] : undefined}
                  >
                    <Input
                      id="document-issued"
                      type="date"
                      value={draft.issueDate}
                      onChange={(event) => update('issueDate', event.target.value)}
                      aria-invalid={Boolean(errors['issueDate'])}
                    />
                  </Field>

                  <Field
                    label={isInvoice ? 'Payment due' : 'Valid until'}
                    htmlFor="document-secondary"
                    error={
                      errors['dueDate']
                        ? ERROR_TEXT[errors['dueDate']]
                        : errors['validUntil']
                          ? ERROR_TEXT[errors['validUntil']]
                          : undefined
                    }
                  >
                    <Input
                      id="document-secondary"
                      type="date"
                      value={draft.secondaryDate}
                      onChange={(event) => update('secondaryDate', event.target.value)}
                      aria-invalid={Boolean(errors['dueDate'] ?? errors['validUntil'])}
                    />
                  </Field>
                </div>
              </section>

              <section aria-labelledby="document-parties" className="space-y-3">
                <h2 id="document-parties" className="text-sm font-semibold text-ink">
                  From and to
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-3 rounded-xl border border-border bg-surface-muted/40 p-3">
                    <Field
                      label="Your business"
                      htmlFor="document-seller"
                      required
                      error={errors['sellerName'] ? ERROR_TEXT[errors['sellerName']] : undefined}
                    >
                      <Input
                        id="document-seller"
                        value={draft.sellerName}
                        onChange={(event) => update('sellerName', event.target.value)}
                        placeholder="Business or your name"
                        autoComplete="organization"
                        aria-invalid={Boolean(errors['sellerName'])}
                      />
                    </Field>
                    <Field
                      label="Your details"
                      htmlFor="document-seller-details"
                      hint="One item per line: address, phone, email, tax ID."
                    >
                      <Textarea
                        id="document-seller-details"
                        rows={3}
                        value={draft.sellerDetails}
                        onChange={(event) => update('sellerDetails', event.target.value)}
                        placeholder={'14 Marina Road, Lagos\n+234 800 000 0000\nhello@example.com'}
                      />
                    </Field>
                  </div>

                  <div className="space-y-3 rounded-xl border border-border bg-surface-muted/40 p-3">
                    <Field
                      label={isInvoice ? 'Bill to' : 'Prepared for'}
                      htmlFor="document-client"
                      required
                      error={errors['clientName'] ? ERROR_TEXT[errors['clientName']] : undefined}
                    >
                      <Input
                        id="document-client"
                        value={draft.clientName}
                        onChange={(event) => update('clientName', event.target.value)}
                        placeholder="Client or company name"
                        autoComplete="off"
                        aria-invalid={Boolean(errors['clientName'])}
                      />
                    </Field>
                    <Field
                      label="Client details"
                      htmlFor="document-client-details"
                      hint="Optional, but it makes the document look professional."
                    >
                      <Textarea
                        id="document-client-details"
                        rows={3}
                        value={draft.clientDetails}
                        onChange={(event) => update('clientDetails', event.target.value)}
                        placeholder={'Client address\nAttention: contact name'}
                      />
                    </Field>
                  </div>
                </div>
              </section>

              <section aria-labelledby="document-lines" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="document-lines" className="text-sm font-semibold text-ink">
                    Line items
                  </h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => update('lines', [...draft.lines, newLine()])}
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    Add line
                  </Button>
                </div>

                {errors['lines'] ? (
                  <p role="alert" className="text-xs font-medium text-danger">
                    {ERROR_TEXT[errors['lines']]}
                  </p>
                ) : null}

                <ul className="space-y-3">
                  {draft.lines.map((line, index) => {
                    const descriptionError = errors[`lines.${index}.description`];
                    const quantityError = errors[`lines.${index}.quantity`];
                    const priceError = errors[`lines.${index}.unitPriceMinor`];
                    const parsed = parsedLines[index];
                    const lineTotal = parsed ? lineTotalMinor(parsed) : 0;

                    return (
                      <li
                        key={line.id}
                        className="rounded-xl border border-border bg-surface p-3 sm:p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-ink-subtle">Line {index + 1}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              update(
                                'lines',
                                draft.lines.filter((entry) => entry.id !== line.id),
                              )
                            }
                            aria-label={`Remove line ${index + 1}`}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>

                        <div className="mt-1 space-y-2.5">
                          <Field
                            label="Description"
                            htmlFor={`line-${line.id}-description`}
                            error={descriptionError ? ERROR_TEXT[descriptionError] : undefined}
                          >
                            <Input
                              id={`line-${line.id}-description`}
                              value={line.description}
                              onChange={(event) =>
                                updateLine(line.id, { description: event.target.value })
                              }
                              placeholder="What are you charging for?"
                              aria-invalid={Boolean(descriptionError)}
                            />
                          </Field>

                          <div className="grid grid-cols-2 gap-2.5">
                            <Field
                              label="Quantity"
                              htmlFor={`line-${line.id}-quantity`}
                              error={quantityError ? ERROR_TEXT[quantityError] : undefined}
                            >
                              <Input
                                id={`line-${line.id}-quantity`}
                                value={line.quantity}
                                onChange={(event) =>
                                  updateLine(line.id, { quantity: event.target.value })
                                }
                                inputMode="decimal"
                                autoComplete="off"
                                aria-invalid={Boolean(quantityError)}
                              />
                            </Field>

                            <Field
                              label={`Unit price (${currency})`}
                              htmlFor={`line-${line.id}-price`}
                              error={priceError ? ERROR_TEXT[priceError] : undefined}
                            >
                              <Input
                                id={`line-${line.id}-price`}
                                value={line.unitPrice}
                                onChange={(event) =>
                                  updateLine(line.id, { unitPrice: event.target.value })
                                }
                                inputMode="decimal"
                                placeholder="0.00"
                                autoComplete="off"
                                aria-invalid={Boolean(priceError)}
                              />
                            </Field>
                          </div>

                          <p className="flex items-baseline justify-between text-xs text-ink-subtle">
                            <span>Line total</span>
                            <span className="font-mono text-sm font-medium tabular-nums text-ink">
                              {formatAmount(lineTotal, currency)}
                            </span>
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section aria-labelledby="document-pricing" className="space-y-3">
                <h2 id="document-pricing" className="text-sm font-semibold text-ink">
                  Discount, tax and shipping
                </h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="document-discount-type">Discount</Label>
                    <Select
                      id="document-discount-type"
                      value={draft.discountType}
                      onChange={(event) => update('discountType', event.target.value as DiscountType)}
                    >
                      {DISCOUNT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <Field
                    label={draft.discountType === 'amount' ? `Discount (${currency})` : 'Discount (%)'}
                    htmlFor="document-discount-value"
                    error={errors['discountValue'] ? ERROR_TEXT[errors['discountValue']] : undefined}
                  >
                    <Input
                      id="document-discount-value"
                      value={draft.discountValue}
                      onChange={(event) => update('discountValue', event.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      autoComplete="off"
                      disabled={draft.discountType === 'none'}
                      aria-invalid={Boolean(errors['discountValue'])}
                    />
                  </Field>

                  <Field
                    label="Tax (%)"
                    htmlFor="document-tax"
                    hint="Leave empty when no tax applies."
                    error={errors['taxPercent'] ? ERROR_TEXT[errors['taxPercent']] : undefined}
                  >
                    <Input
                      id="document-tax"
                      value={draft.taxPercent}
                      onChange={(event) => update('taxPercent', event.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      autoComplete="off"
                      aria-invalid={Boolean(errors['taxPercent'])}
                    />
                  </Field>

                  <Field
                    label={`Shipping (${currency})`}
                    htmlFor="document-shipping"
                    error={errors['shippingMinor'] ? ERROR_TEXT[errors['shippingMinor']] : undefined}
                  >
                    <Input
                      id="document-shipping"
                      value={draft.shipping}
                      onChange={(event) => update('shipping', event.target.value)}
                      inputMode="decimal"
                      placeholder="0.00"
                      autoComplete="off"
                      aria-invalid={Boolean(errors['shippingMinor'])}
                    />
                  </Field>
                </div>
              </section>

              <section aria-labelledby="document-notes" className="space-y-3">
                <h2 id="document-notes" className="text-sm font-semibold text-ink">
                  Notes and terms
                </h2>
                <Field label="Notes" htmlFor="document-notes-field" hint="Shown under the totals.">
                  <Textarea
                    id="document-notes-field"
                    rows={3}
                    value={draft.notes}
                    onChange={(event) => update('notes', event.target.value)}
                    placeholder="Bank details, a thank-you note, or delivery information."
                  />
                </Field>
                <Field
                  label={isInvoice ? 'Payment terms' : 'Terms'}
                  htmlFor="document-terms"
                  hint="Keep it short; long terms are cut off in the PDF."
                >
                  <Textarea
                    id="document-terms"
                    rows={2}
                    value={draft.terms}
                    onChange={(event) => update('terms', event.target.value)}
                  />
                </Field>
              </section>

              {/* Save / load controls */}
              <Card className="border border-border">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-ink">Saved documents</h3>
                  <p className="text-xs text-ink-muted mt-1">
                    Drafts are saved in this browser on this device. Clearing site data removes them.
                  </p>
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={saveAs}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save as…'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={reset}>
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      Start over
                    </Button>
                  </div>
                  {savedDrafts.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {savedDrafts.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-surface-hover"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{entry.name}</p>
                            <p className="text-xs text-ink-subtle truncate">
                              {new Date(entry.savedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => loadSaved(entry)}
                              title="Load this document"
                            >
                              <Download className="size-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteSaved(entry.id)}
                              title="Delete this document"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-ink-muted">
                      No saved documents yet. Use “Save as…” to keep a draft.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            previewContent
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between sm:items-center">
            <div className="flex gap-2">
              <Button
                type="button"
                size="lg"
                onClick={copyContent}
                className="w-full sm:w-auto"
                disabled={tab === 'preview'}
              >
                <Copy className="size-4" aria-hidden="true" />
                Copy text
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={printDocument}
                className="w-full sm:w-auto"
                disabled={tab === 'preview'}
              >
                Print
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={download}
                className="w-full sm:w-auto"
                disabled={tab === 'preview'}
              >
                <Download className="size-4" aria-hidden="true" />
                Download PDF
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={reset}
              className="w-full sm:w-auto"
              disabled={tab === 'preview'}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Start over
            </Button>
          </div>
        </CardContent>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Summary</CardTitle>
            <CardDescription>
              {isInvoice ? 'What the client will pay.' : 'What the quote comes to.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-ink-muted">Subtotal</dt>
                <dd className="font-mono tabular-nums text-ink">
                  {formatAmount(totals.subtotalMinor, currency)}
                </dd>
              </div>
              {totals.discountMinor > 0 ? (
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">Discount</dt>
                  <dd className="font-mono tabular-nums text-success">
                    −{formatAmount(totals.discountMinor, currency)}
                  </dd>
                </div>
              ) : null}
              {totals.taxMinor > 0 ? (
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">Tax</dt>
                  <dd className="font-mono tabular-nums text-ink">
                    {formatAmount(totals.taxMinor, currency)}
                  </dd>
                </div>
              ) : null}
              {totals.shippingMinor > 0 ? (
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">Shipping</dt>
                  <dd className="font-mono tabular-nums text-ink">
                    {formatAmount(totals.shippingMinor, currency)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between border-t border-border pt-2.5">
                <dt className="text-base font-semibold text-ink">Total</dt>
                <dd className="font-mono text-xl font-semibold tabular-nums text-ink">
                  {formatAmount(totals.totalMinor, currency)}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-xs leading-relaxed text-ink-subtle">
              Tax is charged after the discount. Shipping is added after tax.
            </p>
          </CardContent>
        </Card>

        {message ? (
          <Alert tone={message.tone} title={message.title}>
            {message.body}
          </Alert>
        ) : null}

        {errorList.length > 0 ? (
          <Alert
            tone="warning"
            title={`${errorList.length} field${errorList.length === 1 ? '' : 's'} need attention`}
          >
            <ul className="list-inside list-disc space-y-1">
              {[...new Set(errorList.map(([, code]) => ERROR_TEXT[code]))].map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <Alert tone="info" title="Nothing is stored on a server">
          This {kind} exists only in this tab and in your browser's local storage.
          Download it before closing the page, and check the tax rules that apply where
          you trade.
        </Alert>
      </aside>
    </ToolPage>
  );
}

export default DocumentMaker;
