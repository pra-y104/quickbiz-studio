import { z } from 'zod';
import { TOOL_CATEGORIES, TOOL_KINDS, TOOL_STATUSES } from '../types/tool';

export const toolSlugSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Use lowercase letters, numbers and single hyphens',
  });

export const toolKindSchema = z.enum(TOOL_KINDS);
export const toolCategorySchema = z.enum(TOOL_CATEGORIES);
export const toolStatusSchema = z.enum(TOOL_STATUSES);

export const listToolsQuerySchema = z.object({
  kind: toolKindSchema.optional(),
  category: toolCategorySchema.optional(),
  status: toolStatusSchema.optional(),
  q: z.string().trim().min(1).max(80).optional(),
});

export type ListToolsQuery = z.infer<typeof listToolsQuerySchema>;
