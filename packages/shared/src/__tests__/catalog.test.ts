import { describe, expect, it } from 'vitest';
import { TOOL_CATALOGUE, getToolBySlug, isToolExecutable, listToolsByKind } from '../index';
import { toolSlugSchema } from '../schemas/tools';

describe('tool catalogue', () => {
  it('contains unique, URL-safe slugs', () => {
    const slugs = TOOL_CATALOGUE.map((tool) => tool.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(toolSlugSchema.safeParse(slug).success).toBe(true);
    }
  });

  it('covers both AI and utility tools', () => {
    expect(listToolsByKind('ai').length).toBeGreaterThan(0);
    expect(listToolsByKind('utility').length).toBeGreaterThan(0);
  });

  it('keeps utility tools free and anonymous', () => {
    for (const tool of listToolsByKind('utility')) {
      expect(tool.creditCost).toBe(0);
      expect(tool.requiresAuth).toBe(false);
    }
  });

  it('requires authentication for AI tools', () => {
    for (const tool of listToolsByKind('ai')) {
      expect(tool.requiresAuth).toBe(true);
    }
  });

  it('treats unpriced or non-live tools as not executable', () => {
    for (const tool of TOOL_CATALOGUE) {
      if (tool.creditCost === null || tool.status !== 'live') {
        expect(isToolExecutable(tool)).toBe(false);
      }
    }
    expect(isToolExecutable({ ...TOOL_CATALOGUE[0]!, status: 'live', creditCost: 2 })).toBe(true);
  });

  it('resolves tools by slug and returns undefined for unknown slugs', () => {
    expect(getToolBySlug('ai-writer')?.name).toBe('AI Writer');
    expect(getToolBySlug('does-not-exist')).toBeUndefined();
  });
});
