/**
 * Copy for the Stage 5 ordinary tools.
 *
 * Page copy follows the same pattern as `content/auth.ts`: a typed object keeps
 * the shape checked by the compiler and lets a second locale supply the same
 * structure without touching components. Only product-wide chrome strings stay
 * in `i18n/locales/en.json`.
 *
 * Honesty rule: every description here is limited to what the tool actually
 * does in this build. Nothing promises an account, a credit balance or AI.
 */

export interface ToolCopy {
  /** Page title; the catalogue name is used when this is absent. */
  readonly title: string;
  readonly description: string;
}

export const TOOL_COPY: Readonly<Record<string, ToolCopy>> = {
  calculator: {
    title: 'Calculator',
    description:
      'Add, subtract, multiply and divide with an expression you can read back before you trust the answer.',
  },
  'percentage-calculator': {
    title: 'Percentage Calculator',
    description:
      'Find a share of a value, the percentage change between two numbers, or the difference between them.',
  },
  'unit-converter': {
    title: 'Unit Converter',
    description:
      'Convert length, weight, temperature, volume and time without hunting for the factor.',
  },
  'date-calculator': {
    title: 'Date Calculator',
    description: 'Count the days between two dates, or add and subtract calendar time from a date.',
  },
  'invoice-maker': {
    title: 'Invoice Maker',
    description:
      'Itemise the work, apply a discount and tax, and download a PDF your client can read.',
  },
  'quotation-maker': {
    title: 'Quotation Maker',
    description: 'Price a job properly, show how long the quote stands, and download it as a PDF.',
  },
  'word-counter': {
    title: 'Word & Character Counter',
    description:
      'Count words, characters, sentences and paragraphs, with honest reading and speaking times.',
  },
  'text-formatter': {
    title: 'Text Formatter',
    description:
      'Change letter case, fix spacing and organise lines, with every change previewed before you copy it.',
  },
};

export const TOOLS_INDEX_COPY = {
  eyebrow: 'Everyday tools',
  title: 'Eight tools that already work.',
  description:
    'For the jobs between the important ones: a quick total, a unit you cannot convert in your head, an invoice a client can actually read. No account, no credits, nothing uploaded.',
  searchLabel: 'Find a tool',
  searchPlaceholder: 'Search by name or task',
  emptyTitle: 'No tool matches that search',
  emptyBody: 'Try a shorter word, such as “date”, “invoice” or “text”.',
  allCategories: 'All',
  privacyNote:
    'Every calculation and every document is produced on this device. Nothing you type is sent to a server.',
  aiNoteTitle: 'The AI tools are not switched on yet',
  aiNoteBody:
    'Writing, translation and marketing tools arrive in the next stage, after the credit system is in place. They are not previewable or chargeable in this build.',
} as const;
