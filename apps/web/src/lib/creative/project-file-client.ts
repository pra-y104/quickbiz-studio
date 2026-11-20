/**
 * Browser-side project files.
 *
 * `.qbdesign` is plain JSON wrapped in a versioned envelope. Export is a local
 * download; import reads a file the customer chose and validates it with the same
 * schema the editor uses, so a malformed file can never reach the document model.
 */

import { parseProjectFile, serialiseProjectFile, type CreativeDocument } from '@quickbiz/shared';
import { downloadText } from '../tools/download';

export const PROJECT_FILE_EXTENSION = '.qbdesign';
export const PROJECT_FILE_MIME = 'application/json';

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function projectFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'design'}${PROJECT_FILE_EXTENSION}`;
}

export function exportProjectFile(title: string, document: CreativeDocument): void {
  downloadText(serialiseProjectFile(document), projectFileName(title), PROJECT_FILE_MIME);
}

export interface ImportResult {
  readonly ok: boolean;
  readonly document?: CreativeDocument;
  readonly error?: string;
}

/** Read and validate a `.qbdesign` file chosen by the customer. */
export async function readProjectFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: 'That project file is too large to open.' };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: 'That file could not be read.' };
  }

  const result = parseProjectFile(text);
  if (!result.ok || !result.project) {
    return { ok: false, error: result.error ?? 'That file is not a QuickBiz project.' };
  }

  return { ok: true, document: result.project.document };
}
