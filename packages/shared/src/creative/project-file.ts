/**
 * Parse untrusted project files.
 *
 * Everything that can throw is caught here and turned into a short, readable
 * message. A malformed file must never surface a stack trace, an internal field
 * path from a deep schema, or an unhandled rejection in the interface.
 */

import { z } from 'zod';
import {
  CREATIVE_DOCUMENT_KIND,
  CREATIVE_DOCUMENT_VERSION,
  creativeDocumentSchema,
  type CreativeDocument,
} from './document';

export const CREATIVE_PROJECT_FILE_KIND = 'quickbiz.creative-project' as const;
export const CREATIVE_PROJECT_FILE_VERSION = 1 as const;

export const creativeProjectFileSchema = z
  .object({
    kind: z.literal(CREATIVE_PROJECT_FILE_KIND),
    version: z.literal(CREATIVE_PROJECT_FILE_VERSION),
    document: creativeDocumentSchema,
  })
  .strict();

export type CreativeProjectFile = z.infer<typeof creativeProjectFileSchema>;

export interface CreativeProjectFileResult {
  readonly ok: boolean;
  readonly project?: CreativeProjectFile;
  readonly error?: string;
}

/** Wrap a document for download. */
export function toProjectFile(document: CreativeDocument): CreativeProjectFile {
  return {
    kind: CREATIVE_PROJECT_FILE_KIND,
    version: CREATIVE_PROJECT_FILE_VERSION,
    document,
  };
}

/** Serialise with stable, human-readable JSON for a `.qbdesign` file. */
export function serialiseProjectFile(document: CreativeDocument): string {
  return `${JSON.stringify(toProjectFile(document), null, 2)}\n`;
}

const MAX_PROJECT_FILE_BYTES = 8 * 1024 * 1024;

export interface ParseProjectFileOptions {
  /** Refuse payloads above this size before parsing. */
  readonly maxBytes?: number;
}

function invalid(message: string): CreativeProjectFileResult {
  return { ok: false, error: message };
}

/**
 * Validate an imported project file.
 *
 * Size is checked first so a multi-megabyte upload cannot reach the parser, and
 * every parsing step is guarded so a hostile document produces a message rather
 * than an exception.
 */
export function parseProjectFile(
  input: string,
  options: ParseProjectFileOptions = {},
): CreativeProjectFileResult {
  const maxBytes = options.maxBytes ?? MAX_PROJECT_FILE_BYTES;
  if (input.length > maxBytes) {
    return invalid('This project file is too large to open.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    return invalid('This file is not valid JSON, so it cannot be a QuickBiz project.');
  }

  let envelope: z.ZodSafeParseResult<unknown>;
  try {
    envelope = creativeProjectFileSchema.safeParse(raw);
  } catch {
    // A stack overflow from extreme nesting lands here rather than escaping.
    return invalid('This project file is too complex to open safely.');
  }
  if (envelope.success) {
    return { ok: true, project: envelope.data as z.infer<typeof creativeProjectFileSchema> };
  }

  const candidate = (raw as { document?: unknown } | null)?.document;
  if (candidate === undefined) {
    return invalid('This file is not a QuickBiz Creative Studio project.');
  }

  const version = (candidate as { version?: unknown }).version;
  if (version !== undefined && version !== CREATIVE_DOCUMENT_VERSION) {
    return invalid(
      `This project uses document format ${CREATIVE_DOCUMENT_KIND} version ${CREATIVE_DOCUMENT_VERSION}, which this app does not support.`,
    );
  }

  let document: z.ZodSafeParseResult<unknown>;
  try {
    document = creativeDocumentSchema.safeParse(candidate);
  } catch {
    return invalid('This project file is too complex to open safely.');
  }

  if (!document.success) {
    return invalid('This project contains an invalid design document.');
  }

  return invalid('This project file is missing its design document.');
}
