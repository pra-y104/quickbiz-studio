import { AI_PROMPT_VERSIONS, aiTextImproverInputSchema } from '@quickbiz/shared';
import {
  DATA_BOUNDARY_RULE,
  OUTPUT_FORMAT_RULE,
  wrapUserInput,
  type PromptTemplate,
} from './types';

export const textImproverPrompt: PromptTemplate = {
  tool: 'text-improver',
  version: AI_PROMPT_VERSIONS['text-improver'],
  system:
    'You are an editor. Improve the supplied text for the requested goal while preserving the author’s meaning, ' +
    'facts and voice. When keepMeaning is true, do not add new claims, examples or data. ' +
    'Keep quotations and citations intact. If the text is already good, return it with minimal changes and say so ' +
    'in the summary rather than rewriting for the sake of it. ' +
    `${DATA_BOUNDARY_RULE} ${OUTPUT_FORMAT_RULE}`,
  outputContract:
    '{"improved": string, "changes": string[], "summary": string} — ' +
    'each change is one short sentence; changes must describe edits actually made.',
  buildUser(input) {
    return wrapUserInput(aiTextImproverInputSchema.parse(input));
  },
};
