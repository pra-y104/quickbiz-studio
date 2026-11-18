import type { ZodType } from 'zod';
import { AppError } from './errors';

export interface FieldIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Validate input and convert failures into a 422 with field-level details.
 * The same Zod schema is used by the frontend, so users see consistent rules.
 */
export function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues: FieldIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
    throw AppError.validation(issues);
  }
  return result.data;
}
