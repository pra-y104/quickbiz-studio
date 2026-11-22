/**
 * M3 acceptance: every one of the eight tools runs end to end through the shared
 * pipeline with a deterministic provider.
 *
 * Nothing here performs a network request. The fake provider returns the fixtures in
 * \`fixtures/tool-outputs.ts\`, and the pipeline validates them against each tool's
 * output schema exactly as it would for a real adapter.
 */

import { describe, expect, it } from 'vitest';
import { AI_TOOL_SLUGS, getAiToolLimits, getAiToolSchemas } from '@quickbiz/shared';
import { executeAiTool } from '../ai/execution';
import { FakeProvider } from '../ai/testing/fake-provider';
import { TOOL_OUTPUT_FIXTURES } from './fixtures/tool-outputs';

const INPUTS: Readonly<Record<string, unknown>> = {
  'ai-writer': {
    documentType: 'email',
    topic: 'A practical guide to opening a small bakery in Lagos',
    tone: 'friendly',
    length: 'medium',
    language: 'en',
  },
  'ad-generator': {
    product: 'Fresh bread from a neighbourhood bakery',
    platform: 'instagram',
    objective: 'awareness',
    tone: 'friendly',
    hashtagCount: 3,
  },
  translator: {
    text: 'Hello, how are you today?',
    sourceLanguage: 'en',
    targetLanguage: 'fr',
    formality: 'formal',
    preserveLineBreaks: true,
  },
  'text-improver': {
    text: 'hey, just checking in about invoice 1042 which was due last week',
    goal: 'professional',
    keepMeaning: true,
    lengthPreference: 'similar',
    language: 'en',
  },
  'product-description': {
    productName: 'Compact stand mixer',
    features: ['4.5 litre bowl', 'Ten speeds'],
    platform: 'website',
    tone: 'professional',
  },
  'business-name-generator': {
    industry: 'Neighbourhood bakery',
    style: 'modern',
    language: 'en',
  },
  'social-caption': {
    platform: 'instagram',
    topic: 'Fresh bread out of the oven at 7am',
    tone: 'friendly',
    hashtagCount: 3,
    emoji: true,
    language: 'en',
  },
  'business-plan-assistant': {
    idea: 'A single-site neighbourhood bakery serving a dense residential area',
    market: 'Lagos mainland',
    stage: 'idea',
    audience: 'internal',
    sections: ['summary', 'operations'],
  },
};

describe('M3: all eight tools run through the shared pipeline', () => {
  for (const tool of AI_TOOL_SLUGS) {
    it(`${tool} produces schema-valid output with a deterministic provider`, async () => {
      const fixture = TOOL_OUTPUT_FIXTURES[tool];
      const provider = new FakeProvider({ text: JSON.stringify(fixture) });

      const result = await executeAiTool({
        tool,
        input: INPUTS[tool],
        provider,
      });

      // The output must satisfy the tool's own schema after normalisation.
      expect(getAiToolSchemas(tool).output.safeParse(result.output).success).toBe(true);
      expect(result.metadata.providerId).toBe('fake');
      expect(result.metadata.promptVersion).toBeTruthy();
      expect(provider.calls).toHaveLength(1);
    });

    it(`${tool} enforces its output token ceiling`, async () => {
      const provider = new FakeProvider({ text: JSON.stringify(TOOL_OUTPUT_FIXTURES[tool]) });

      await executeAiTool({ tool, input: INPUTS[tool], provider });

      expect(provider.calls[0]?.maxOutputTokens).toBe(getAiToolLimits(tool).maxOutputTokens);
    });

    it(`${tool} rejects an invalid input before calling the provider`, async () => {
      const provider = new FakeProvider({ text: JSON.stringify(TOOL_OUTPUT_FIXTURES[tool]) });

      const error = await executeAiTool({
        tool,
        input: {},
        provider,
      }).catch((value: unknown) => value);

      expect(error).toBeInstanceOf(Error);
      expect(provider.calls).toHaveLength(0);
    });
  }

  it('strips unknown keys from provider output', async () => {
    const provider = new FakeProvider({
      text: JSON.stringify({
        ...TOOL_OUTPUT_FIXTURES['ai-writer'],
        unexpected: 'value',
      }),
    });

    const result = await executeAiTool({
      tool: 'ai-writer',
      input: INPUTS['ai-writer'],
      provider,
    });

    expect((result.output as Record<string, unknown>).unexpected).toBeUndefined();
  });

  it('rejects a response that misses a required field', async () => {
    const provider = new FakeProvider({ text: JSON.stringify({ title: 'Only a title' }) });

    await expect(
      executeAiTool({ tool: 'ai-writer', input: INPUTS['ai-writer'], provider }),
    ).rejects.toMatchObject({ reason: 'invalid-response' });
  });
});
