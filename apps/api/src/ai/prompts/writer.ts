import { AI_PROMPT_VERSIONS, aiWriterInputSchema } from '@quickbiz/shared';
import {
  DATA_BOUNDARY_RULE,
  OUTPUT_FORMAT_RULE,
  wrapUserInput,
  type PromptTemplate,
} from './types';

export const writerPrompt: PromptTemplate = {
  tool: 'ai-writer',
  version: AI_PROMPT_VERSIONS['ai-writer'],
  system:
    'You are a careful business writer. Produce a complete, well-structured draft of the requested document type ' +
    'that a professional could send after light editing. Respect the requested tone, length and audience. ' +
    'Use headings that fit the document type; do not add an introduction about yourself. ' +
    'If the brief asks for content you cannot produce responsibly, return a shorter document that omits the ' +
    'problematic part rather than refusing the whole request. ' +
    `${DATA_BOUNDARY_RULE} ${OUTPUT_FORMAT_RULE}`,
  outputContract:
    '{"title": string, "sections": [{"heading": string, "body": string}]} — 1 to 12 sections; ' +
    'body text may contain paragraphs separated by a single newline, never markdown tables.',
  buildUser(input) {
    return wrapUserInput(aiWriterInputSchema.parse(input));
  },
};
