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
import { Download, Plus, RotateCcw, Trash2 } from 'lucide-react';
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

export interface DocumentMakerProps {
  readonly kind: DocumentKind;
}

/**
 * Invoice and quotation editor.
 *
 * Both documents share one implementation: the arithmetic, validation and PDF
 * layout are identical, and only labels and the second date differ. Nothing is
 * persisted or transmitted; the PDF is generated and downloaded on the device.
 */
export function DocumentMaker({ kind }: DocumentMakerProps) {
  const [draft, setDraft] = useState<DraftState>(() => initialState(kind));
  const [errors, setErrors] = useState<DocumentValidationErrors>({});
  const [message, setMessage] = useState<{
    readonly tone: 'success' | 'danger';
    readonly title: string;
    readonly body: string;
  } | null>(null);

  const isInvoice = kind === 'invoice';
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

  function reset(): void {
    if (!window.confirm(`Clear this ${kind} and start again?`)) return;
    setDraft(initialState(kind));
    setErrors({});
    setMessage(null);
  }

  return (
    <ToolPage slug={isInvoice ? 'invoice-maker' : 'quotation-maker'}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{isInvoice ? 'Invoice details' : 'Quotation details'}</CardTitle>
          <CardDescription>
            Totals update as you type. The PDF is produced in the browser, so nothing leaves your
            device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
            <Button type="button" size="lg" onClick={download} className="w-full sm:w-auto">
              <Download className="size-4" aria-hidden="true" />
              Download PDF
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={reset}
              className="w-full sm:w-auto"
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

        <Alert tone="info" title="Nothing is stored">
          This {kind} exists only in this tab. Download it before closing the page, and check the
          tax rules that apply where you trade.
        </Alert>
      </aside>
    </ToolPage>
  );
}
