/**
 * Transactional email templates.
 *
 * Pure functions that return a subject, plain-text and HTML body. They contain
 * no secrets and escape every interpolated value so a value can never break out
 * of the HTML document.
 */

import type { EmailMessage } from './provider';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title: string, bodyHtml: string): string {
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title></head>`,
    '<body style="margin:0;background:#0B1222;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">',
    '<div style="max-width:560px;margin:0 auto;padding:32px 24px;">',
    '<div style="background:#fff;border-radius:16px;padding:32px;">',
    `<h1 style="margin:0 0 16px;font-size:20px;color:#0B1222;">${escapeHtml(title)}</h1>`,
    bodyHtml,
    '</div>',
    '<p style="color:#64748b;font-size:12px;text-align:center;margin-top:16px;">QuickBiz Studio</p>',
    '</div></body></html>',
  ].join('');
}

export interface PaymentNotification {
  readonly to: string;
  readonly reference: string;
  readonly amountFormatted: string;
  readonly currency: string;
}

/** A confirmed payment or refund notification. */
export function buildPaymentNotification(input: PaymentNotification): EmailMessage {
  const reference = escapeHtml(input.reference);
  const amount = escapeHtml(input.amountFormatted);
  const currency = escapeHtml(input.currency);
  const subject = `QuickBiz Studio payment ${input.reference}`;
  const text = [
    `Your payment ${input.reference} for ${input.amountFormatted} ${input.currency} was confirmed.`,
    'You can review it in your wallet transaction history.',
  ].join('\n');
  const html = layout(
    subject,
    `<p style="color:#334155;line-height:1.6;">Your payment <strong>${reference}</strong> for ` +
      `<strong>${amount} ${currency}</strong> was confirmed.</p>` +
      '<p style="color:#334155;line-height:1.6;">You can review it in your wallet transaction history.</p>',
  );
  return { to: input.to, subject, text, html };
}

export interface AccountNotification {
  readonly to: string;
  readonly subject: string;
  readonly heading: string;
  readonly body: string;
}

/** A generic account notification (e.g. a security or profile notice). */
export function buildAccountNotification(input: AccountNotification): EmailMessage {
  const subject = input.subject.slice(0, 200);
  const text = `${input.heading}\n\n${input.body}`;
  const html = layout(
    input.heading,
    `<p style="color:#334155;line-height:1.6;">${escapeHtml(input.body)}</p>`,
  );
  return { to: input.to, subject, text, html };
}
