/** Tool taxonomy shared by the directory, dashboard shortcuts and API. */
export const TOOL_KINDS = ['ai', 'utility'] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

export const TOOL_CATEGORIES = [
  'writing',
  'marketing',
  'business',
  'language',
  'productivity',
  'calculators',
  'documents',
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const TOOL_STATUSES = ['planned', 'live', 'paused'] as const;
export type ToolStatus = (typeof TOOL_STATUSES)[number];

export interface ToolDefinition {
  /** URL-safe identifier, also the route segment: /tools/<slug>. */
  readonly slug: string;
  readonly name: string;
  /** One short line used on cards and directory lists. */
  readonly summary: string;
  readonly category: ToolCategory;
  readonly kind: ToolKind;
  readonly status: ToolStatus;
  /** AI tools require a verified account. Utility tools work anonymously. */
  readonly requiresAuth: boolean;
  /**
   * Credit cost shown before submission. `null` means pricing has not been
   * approved yet, and the tool must not be executable in that state.
   */
  readonly creditCost: number | null;
  /** Icon name from the icon set used by the frontend. */
  readonly icon: string;
}

export function isToolExecutable(tool: ToolDefinition): boolean {
  return tool.status === 'live' && tool.creditCost !== null;
}
