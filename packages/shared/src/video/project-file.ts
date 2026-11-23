/**
 * Parse untrusted video project files.
 *
 * A malformed or hostile file must never surface a stack trace, an internal
 * field path from a deep schema, or an unhandled rejection in the interface.
 */

import { z } from 'zod';
import { videoDocumentSchema, type VideoDocument } from './document';

export const VIDEO_PROJECT_FILE_KIND = 'quickbiz.video-project' as const;
export const VIDEO_PROJECT_FILE_VERSION = 1 as const;

export const videoProjectFileSchema = z
  .object({
    kind: z.literal(VIDEO_PROJECT_FILE_KIND),
    version: z.literal(VIDEO_PROJECT_FILE_VERSION),
    document: videoDocumentSchema,
  })
  .strict();

export type VideoProjectFile = z.infer<typeof videoProjectFileSchema>;

export interface VideoProjectFileResult {
  readonly ok: boolean;
  readonly project?: VideoProjectFile;
  readonly error?: string;
}

export function toVideoProjectFile(document: VideoDocument): VideoProjectFile {
  return {
    kind: VIDEO_PROJECT_FILE_KIND,
    version: VIDEO_PROJECT_FILE_VERSION,
    document,
  };
}

export function serialiseVideoProjectFile(document: VideoDocument): string {
  return `${JSON.stringify(toVideoProjectFile(document), null, 2)}\n`;
}

const MAX_PROJECT_FILE_BYTES = 8 * 1024 * 1024;

export interface ParseVideoProjectFileOptions {
  readonly maxBytes?: number;
}

function invalid(message: string): VideoProjectFileResult {
  return { ok: false, error: message };
}

/** Parse an untrusted string into a video project file, or a readable error. */
export function parseVideoProjectFile(
  raw: string,
  options: ParseVideoProjectFileOptions = {},
): VideoProjectFileResult {
  const maxBytes = options.maxBytes ?? MAX_PROJECT_FILE_BYTES;
  if (raw.length > maxBytes) {
    return invalid('That project file is too large.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return invalid('That file is not valid JSON.');
  }

  const result = videoProjectFileSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join('.') ?? '';
    return invalid(path ? `Invalid field: ${path}.` : 'That file is not a valid video project.');
  }

  // Guard the documented kind/version explicitly for a clearer message.
  if (result.data.kind !== VIDEO_PROJECT_FILE_KIND) {
    return invalid('That file is not a QuickBiz video project.');
  }
  if (result.data.version !== VIDEO_PROJECT_FILE_VERSION) {
    return invalid('That project was saved by a newer version of the app.');
  }

  return { ok: true, project: result.data };
}
