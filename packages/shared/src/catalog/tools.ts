import type { ToolDefinition, ToolKind } from '../types/tool';

/**
 * Tool catalogue foundation.
 *
 * This is the single source of truth for tool identity, category, auth
 * requirement and credit pricing. Routes, dashboards and the API all read from
 * here instead of duplicating lists.
 *
 * Stage 2 state: every tool is `planned`. Nothing is executable yet, and AI
 * tools deliberately have `creditCost: null` because the credit economy has not
 * been approved. `isToolExecutable()` returns false until a tool is both live
 * and priced, which prevents accidental charging.
 */
export const TOOL_CATALOGUE: readonly ToolDefinition[] = [
  {
    slug: 'ai-writer',
    name: 'AI Writer',
    summary: 'Draft letters, articles, essays and business content.',
    category: 'writing',
    kind: 'ai',
    status: 'planned',
    requiresAuth: true,
    creditCost: null,
    icon: 'pen-line',
  },
  {
    slug: 'ad-generator',
    name: 'Advertisement Generator',
    summary: 'Create sales adverts, promotions and campaign copy.',
    category: 'marketing',
    kind: 'ai',
    status: 'planned',
    requiresAuth: true,
    creditCost: null,
    icon: 'megaphone',
  },
  {
    slug: 'translator',
    name: 'Translator',
    summary: 'Translate text between supported languages.',
    category: 'language',
    kind: 'ai',
    status: 'planned',
    requiresAuth: true,
    creditCost: null,
    icon: 'languages',
  },
  {
    slug: 'text-improver',
    name: 'Text Improver',
    summary: 'Fix grammar, adjust tone and sharpen clarity.',
    category: 'writing',
    kind: 'ai',
    status: 'planned',
    requiresAuth: true,
    creditCost: null,
    icon: 'sparkles',
  },
  {
    slug: 'product-description',
    name: 'Product Description',
    summary: 'Write clear descriptions that help products sell.',
    category: 'marketing',
    kind: 'ai',
    status: 'planned',
    requiresAuth: true,
    creditCost: null,
    icon: 'tag',
  },
  {
    slug: 'business-name-generator',
    name: 'Business Name & Slogan',
    summary: 'Generate name and slogan ideas for a new venture.',
    category: 'business',
    kind: 'ai',
    status: 'planned',
    requiresAuth: true,
    creditCost: null,
    icon: 'shapes',
  },
  {
    slug: 'social-caption',
    name: 'Social Caption',
    summary: 'Caption posts with the right hook and hashtags.',
    category: 'marketing',
    kind: 'ai',
    status: 'planned',
    requiresAuth: true,
    creditCost: null,
    icon: 'message-square-quote',
  },
  {
    slug: 'business-plan-assistant',
    name: 'Business Plan Assistant',
    summary: 'Structure a practical plan for a business idea.',
    category: 'business',
    kind: 'ai',
    status: 'planned',
    requiresAuth: true,
    creditCost: null,
    icon: 'clipboard-list',
  },
  {
    slug: 'calculator',
    name: 'Calculator',
    summary: 'A fast everyday calculator that works offline.',
    category: 'calculators',
    kind: 'utility',
    status: 'planned',
    requiresAuth: false,
    creditCost: 0,
    icon: 'calculator',
  },
  {
    slug: 'percentage-calculator',
    name: 'Percentage Calculator',
    summary: 'Work out percentages, increases and discounts.',
    category: 'calculators',
    kind: 'utility',
    status: 'planned',
    requiresAuth: false,
    creditCost: 0,
    icon: 'percent',
  },
  {
    slug: 'unit-converter',
    name: 'Unit Converter',
    summary: 'Convert length, weight and temperature units.',
    category: 'calculators',
    kind: 'utility',
    status: 'planned',
    requiresAuth: false,
    creditCost: 0,
    icon: 'ruler',
  },
  {
    slug: 'date-calculator',
    name: 'Date Calculator',
    summary: 'Count days between dates and add date intervals.',
    category: 'calculators',
    kind: 'utility',
    status: 'planned',
    requiresAuth: false,
    creditCost: 0,
    icon: 'calendar-days',
  },
  {
    slug: 'invoice-maker',
    name: 'Invoice Maker',
    summary: 'Build a clean invoice and download it as a PDF.',
    category: 'documents',
    kind: 'utility',
    status: 'planned',
    requiresAuth: false,
    creditCost: 0,
    icon: 'file-text',
  },
  {
    slug: 'quotation-maker',
    name: 'Quotation Maker',
    summary: 'Prepare a professional quotation for a client.',
    category: 'documents',
    kind: 'utility',
    status: 'planned',
    requiresAuth: false,
    creditCost: 0,
    icon: 'receipt',
  },
  {
    slug: 'word-counter',
    name: 'Word Counter',
    summary: 'Count words, characters and reading time.',
    category: 'productivity',
    kind: 'utility',
    status: 'planned',
    requiresAuth: false,
    creditCost: 0,
    icon: 'type',
  },
  {
    slug: 'text-formatter',
    name: 'Text Formatter',
    summary: 'Clean up spacing, case and line breaks instantly.',
    category: 'productivity',
    kind: 'utility',
    status: 'planned',
    requiresAuth: false,
    creditCost: 0,
    icon: 'align-left',
  },
];

export const TOOL_SLUGS = TOOL_CATALOGUE.map((tool) => tool.slug);

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return TOOL_CATALOGUE.find((tool) => tool.slug === slug);
}

export function listToolsByKind(kind: ToolKind): ToolDefinition[] {
  return TOOL_CATALOGUE.filter((tool) => tool.kind === kind);
}
