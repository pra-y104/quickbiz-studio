import { z } from 'zod';
import { API_ERROR_CODES } from '../types/api';

/** ISO 8601 timestamp with an explicit offset or Z suffix. */
export const isoDateTimeSchema = z
  .string()
  .min(20)
  .max(40)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Must be a valid ISO 8601 date-time',
  })
  .refine((value) => /(Z|[+-]\d{2}:\d{2})$/.test(value), {
    message: 'Must include a UTC designator or offset',
  });

export const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, {
    message: 'Must be a valid UUID',
  });

export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);

export const sortDirectionSchema = z.enum(['asc', 'desc']).default('desc');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type SortDirection = z.infer<typeof sortDirectionSchema>;
