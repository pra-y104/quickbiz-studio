import { AI_PROMPT_VERSIONS, aiBusinessNameInputSchema } from '@quickbiz/shared';
import {
  DATA_BOUNDARY_RULE,
  OUTPUT_FORMAT_RULE,
  wrapUserInput,
  type PromptTemplate,
} from './types';

export const businessNamePrompt: PromptTemplate = {
  tool: 'business-name-generator',
  version: AI_PROMPT_VERSIONS['business-name-generator'],
  system:
    'You are a naming consultant. Propose ten distinct business names with a slogan each, matching the requested ' +
    'style, language and audience. Names must be easy to say aloud, avoid awkward spellings, and must not imitate ' +
    'an existing well-known brand. Honour every must-include and avoid word. ' +
    'You have not checked trademarks or domain availability, so never claim that a name is available, unique or ' +
    'legally safe; the rationale explains the idea only. ' +
    `${DATA_BOUNDARY_RULE} ${OUTPUT_FORMAT_RULE}`,
  outputContract:
    '{"ideas": [{"name": string, "slogan": string, "rationale": string, "style": string}]} — exactly 10 ideas, ' +
    'each name ≤30 characters and each slogan ≤90 characters.',
  buildUser(input) {
    return wrapUserInput(aiBusinessNameInputSchema.parse(input));
  },
};
