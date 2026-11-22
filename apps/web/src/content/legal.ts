/**
 * Legal and contact copy.
 *
 * These pages must never invent facts about the business. Where the owner has not
 * supplied a detail, the text says so explicitly with a clearly marked placeholder
 * such as `[SUPPORT EMAIL]`. Publishing a placeholder is safe; publishing a guess is
 * not.
 *
 * Each document also states what the product actually does today, so the policy
 * matches the implementation rather than an aspiration.
 */

export type LegalPlaceholder = string;

export interface LegalSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export interface LegalDocument {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly updated: string;
  /** True while owner-supplied details are still missing. */
  readonly draft: boolean;
  readonly sections: readonly LegalSection[];
}

export const PLACEHOLDERS = {
  supportEmail: '[SUPPORT EMAIL — to be supplied by the owner]',
  businessName: '[REGISTERED BUSINESS NAME — to be supplied by the owner]',
  businessAddress: '[BUSINESS ADDRESS — to be supplied by the owner]',
  jurisdiction: '[JURISDICTION — to be supplied by the owner]',
  privacyContact: '[PRIVACY CONTACT — to be supplied by the owner]',
} as const;

const UPDATED = '2026-11-22';

export const LEGAL_DOCUMENTS: Readonly<Record<string, LegalDocument>> = {
  privacy: {
    slug: 'privacy',
    title: 'Privacy Policy',
    summary: 'What QuickBiz Studio stores, where it stores it, and what it refuses to collect.',
    updated: UPDATED,
    draft: true,
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          `This policy covers QuickBiz Studio, operated by ${PLACEHOLDERS.businessName}, based at ${PLACEHOLDERS.businessAddress}.`,
          `Privacy questions can be sent to ${PLACEHOLDERS.privacyContact}.`,
        ],
      },
      {
        heading: 'What this build actually stores',
        paragraphs: [
          'Account details (email address and a display name) are held by our authentication provider, Supabase, when you create an account.',
          'Designs created in Creative Studio are stored in your browser on your device using IndexedDB. They are not uploaded to us.',
          'Uploaded images are stored in your browser on your device. They are not uploaded to us.',
          'AI text tools are not available in this build, so no prompt or result is sent to an AI provider.',
          'We do not run advertising networks or third-party analytics.',
        ],
      },
      {
        heading: 'AI and your data',
        paragraphs: [
          'When AI features are enabled in a future release, the text you submit will be sent to the AI provider needed to answer. That will be disclosed at the point of use, with the provider named and its retention terms linked.',
          'Voice dictation in Translator is handled by your browser. Chrome may send audio to its own speech service to transcribe it; QuickBiz does not record or store audio.',
        ],
      },
      {
        heading: 'Your choices',
        paragraphs: [
          'You can delete your account, which removes your profile. Locally stored designs can be deleted individually or by clearing this site’s browser data.',
          `Requests about your data can be sent to ${PLACEHOLDERS.privacyContact}.`,
        ],
      },
      {
        heading: 'Retention',
        paragraphs: [
          'Account data is retained while your account exists. Locally stored designs remain until you delete them or clear your browser data.',
          'A formal retention schedule will be published before paid AI features launch.',
        ],
      },
      {
        heading: 'International transfers',
        paragraphs: [
          `Our infrastructure providers process data in regions outside ${PLACEHOLDERS.jurisdiction}. Where a transfer requires a specific safeguard, it will be documented here before the relevant feature launches.`,
        ],
      },
      {
        heading: 'Children',
        paragraphs: [
          'QuickBiz Studio is a business productivity product and is not directed at children under 16. We do not knowingly collect their data.',
        ],
      },
      {
        heading: 'Changes',
        paragraphs: [
          'Material changes to this policy will be announced in the product before they take effect.',
        ],
      },
    ],
  },

  terms: {
    slug: 'terms',
    title: 'Terms of Service',
    summary: 'The rules for using QuickBiz Studio, written in plain language.',
    updated: UPDATED,
    draft: true,
    sections: [
      {
        heading: 'Agreement',
        paragraphs: [
          `By using QuickBiz Studio you agree to these terms. The service is operated by ${PLACEHOLDERS.businessName}.`,
        ],
      },
      {
        heading: 'Your account',
        paragraphs: [
          'You must provide accurate information and keep your credentials secure. You are responsible for activity under your account.',
          'You must be at least 16, or the age of majority in your country if higher.',
        ],
      },
      {
        heading: 'Acceptable use',
        paragraphs: [
          'Do not use the service for unlawful purposes, to infringe others’ rights, to distribute malware, or to attempt to disrupt the service or access another user’s data.',
          'Do not upload content you do not have the right to use.',
        ],
      },
      {
        heading: 'Your content',
        paragraphs: [
          'You keep ownership of the designs, documents and images you create. You grant us only the permission needed to operate the service you asked for.',
          'Creative Studio projects are stored on your device. Export anything you want to keep, because clearing browser data removes local projects.',
        ],
      },
      {
        heading: 'Availability',
        paragraphs: [
          'We aim for a reliable service but do not promise uninterrupted availability. Free tools are provided as they are.',
          'AI features are not available in this build. When they launch they will be offered under the pricing shown before each run.',
        ],
      },
      {
        heading: 'Liability',
        paragraphs: [
          `To the extent permitted by law, our liability is limited to the amount you paid us in the three months before the claim. Nothing here excludes liability that cannot lawfully be excluded, including for fraud.`,
        ],
      },
      {
        heading: 'Termination',
        paragraphs: [
          'You can stop using the service at any time. We may suspend accounts that breach these terms or put the service or other customers at risk.',
        ],
      },
      {
        heading: 'Governing law',
        paragraphs: [
          `These terms are governed by the laws of ${PLACEHOLDERS.jurisdiction}, and the courts there have jurisdiction.`,
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [`Questions about these terms: ${PLACEHOLDERS.supportEmail}.`],
      },
    ],
  },

  refunds: {
    slug: 'refunds',
    title: 'Refund Policy',
    summary: 'When refunds apply. No refund promise is made before payments exist.',
    updated: UPDATED,
    draft: true,
    sections: [
      {
        heading: 'Current status',
        paragraphs: [
          'Payments are not enabled in this build, so no charge can be made and no refund can be due.',
          'This policy will be finalised, with the payment provider’s own refund rules, before checkout opens.',
        ],
      },
      {
        heading: 'Planned approach',
        paragraphs: [
          'Where a paid AI run fails for a technical reason on our side or the provider’s, the credits reserved for that run will be returned automatically.',
          'Unused credit packs will be refundable in line with consumer law in your country and the payment provider’s terms.',
          'Any refund will be returned to the original payment method, in the currency that was charged.',
        ],
      },
      {
        heading: 'How to request one',
        paragraphs: [
          `Once payments are live, refund requests can be sent to ${PLACEHOLDERS.supportEmail} with the transaction reference.`,
        ],
      },
      {
        heading: 'Timescales',
        paragraphs: [
          'Approved refunds are usually processed within five business days; your bank may take longer to post the credit.',
        ],
      },
    ],
  },

  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy',
    summary: 'This product uses no tracking cookies.',
    updated: UPDATED,
    draft: false,
    sections: [
      {
        heading: 'What we use',
        paragraphs: [
          'QuickBiz Studio does not set advertising or analytics cookies.',
          'The web app stores your colour theme and your Creative Studio projects in your browser using local storage and IndexedDB. These stay on your device and are not sent to us.',
          'Authentication, when you sign in, uses tokens managed by Supabase in your browser.',
        ],
      },
      {
        heading: 'Managing them',
        paragraphs: [
          'You can clear this site’s data in your browser settings. Doing so removes locally saved designs, so export anything you want to keep first.',
        ],
      },
    ],
  },
};

export const LEGAL_INDEX = Object.values(LEGAL_DOCUMENTS);
