/**
 * The portable `.qbdesign` project file.
 *
 * A project file wraps one creative document with a small envelope so the
 * format can evolve without guessing from the document alone. Import is strict:
 * the envelope must match, the payload must validate, and anything else is
 * rejected with a readable reason.
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

/**
 * Validate an imported project file.
 *
 * Size is checked first so a multi-megabyte upload cannot reach the parser.
 */
export function parseProjectFile(
  input: string,
  options: ParseProjectFileOptions = {},
): CreativeProjectFileResult {
  const maxBytes = options.maxBytes ?? MAX_PROJECT_FILE_BYTES;
  if (input.length > maxBytes) {
    return { ok: false, error: 'This project file is too large to open.' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    return { ok: false, error: 'This file is not valid JSON, so it cannot be a QuickBiz project.' };
  }

  const envelope = creativeProjectFileSchema.safeParse(raw);
  if (envelope.success) return { ok: true, project: envelope.data };

  const candidate = (raw as { document?: unknown } | null)?.document;
  if (candidate !== undefined) {
    const version = (candidate as { version?: unknown }).version;
    if (version !== undefined && version !== CREATIVE_DOCUMENT_VERSION) {
      return {
        ok: false,
        error: `This project uses document format ${CREATIVE_DOCUMENT_KIND} version ${CREATIVE_DOCUMENT_VERSION}, which this app does not support.`,
      };
    }
    const document = creativeDocumentSchema.safeParse(candidate);
    if (!document.success) {
      const first = document.error.issues[0];
      return {
        ok: false,
        error: `This project contains an invalid design document (${first?.path ?? 'document'}).`,
      };
    }
  }

  return {
    ok: false,
    error: 'This file is not a QuickBiz Creative Studio project.',
  };
}
