import { describe, expect, it } from 'vitest';
import {
  CREATIVE_TEMPLATES,
  CREATIVE_TEMPLATE_CATEGORIES,
  createDocumentFromTemplate,
  parseCreativeDocument,
  requireTemplate,
  toDocPixels,
} from '../index';
import { getPreset } from '../index';

describe('creative templates', () => {
  it('ships at least 24 original templates', () => {
    expect(CREATIVE_TEMPLATES.length).toBeGreaterThanOrEqual(24);
  });

  it('gives every template a unique id', () => {
    const ids = CREATIVE_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every advertised category', () => {
    const categories = new Set(CREATIVE_TEMPLATES.map((template) => template.category));
    for (const category of CREATIVE_TEMPLATE_CATEGORIES) {
      expect(categories.has(category), category).toBe(true);
    }
  });

  it('points each template at a real preset', () => {
    for (const template of CREATIVE_TEMPLATES) {
      expect(getPreset(template.presetId), template.id).toBeDefined();
    }
  });

  it('produces a document that passes validation', () => {
    for (const template of CREATIVE_TEMPLATES) {
      const document = createDocumentFromTemplate(template.id, {
        now: new Date('2026-01-01T00:00:00.000Z'),
      });
      const result = parseCreativeDocument(document);
      expect(result.ok, `${template.id}: ${result.ok ? '' : JSON.stringify(result.issues)}`).toBe(
        true,
      );
    }
  });

  it('keeps every text node inside its canvas and lets ornaments bleed', () => {
    for (const template of CREATIVE_TEMPLATES) {
      const document = createDocumentFromTemplate(template.id);
      const { width, height } = toDocPixels(document.canvas);
      for (const node of document.nodes) {
        expect(node.x, `${template.id}/${node.id} x`).toBeGreaterThanOrEqual(-1);
        expect(node.y, `${template.id}/${node.id} y`).toBeLessThan(height);
        // Decorative shapes are allowed to bleed off an edge; text never is.
        if (node.type === 'text') {
          expect(node.x + node.width, `${template.id}/${node.id} right`).toBeLessThanOrEqual(
            width + 1,
          );
          expect(node.y + node.height, `${template.id}/${node.id} bottom`).toBeLessThanOrEqual(
            height + 1,
          );
        } else {
          expect(node.x + node.width, `${template.id}/${node.id} right`).toBeLessThanOrEqual(
            width * 1.6,
          );
        }
      }
    }
  });

  it('gives every node a unique id inside a document', () => {
    for (const template of CREATIVE_TEMPLATES) {
      const document = createDocumentFromTemplate(template.id);
      const ids = document.nodes.map((node) => node.id);
      expect(new Set(ids).size, template.id).toBe(ids.length);
    }
  });

  it('keeps templates editable rather than flattened', () => {
    const document = createDocumentFromTemplate('poster-1');
    expect(document.nodes.length).toBeGreaterThan(3);
    expect(document.nodes.some((node) => node.type === 'text')).toBe(true);
    expect(document.nodes.some((node) => node.type === 'shape')).toBe(true);
  });

  it('builds a fresh document id per instantiation', () => {
    const first = createDocumentFromTemplate('social-1');
    const second = createDocumentFromTemplate('social-1');
    expect(first.id).not.toBe(second.id);
    expect(first.nodes[0]?.id).toBe(second.nodes[0]?.id);
  });

  it('throws for an unknown template', () => {
    expect(() => requireTemplate('missing')).toThrow(RangeError);
  });
});