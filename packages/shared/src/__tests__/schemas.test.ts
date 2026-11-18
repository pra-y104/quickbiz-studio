import { describe, expect, it } from 'vitest';
import { paginationQuerySchema, listToolsQuerySchema, uuidSchema } from '../index';

describe('shared schemas', () => {
  it('applies pagination defaults and coerces query strings', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '10' })).toEqual({
      page: 3,
      pageSize: 10,
    });
  });

  it('rejects out-of-range pagination', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });

  it('validates tool list filters', () => {
    expect(listToolsQuerySchema.parse({ kind: 'ai' }).kind).toBe('ai');
    expect(listToolsQuerySchema.safeParse({ kind: 'robot' }).success).toBe(false);
  });

  it('validates UUIDs', () => {
    expect(uuidSchema.safeParse('7f6c2f7e-1b4a-4a55-9f43-0f2c9c9b6a11').success).toBe(true);
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});
