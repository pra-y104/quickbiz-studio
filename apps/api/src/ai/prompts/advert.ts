import { AI_PROMPT_VERSIONS, aiAdvertInputSchema } from '@quickbiz/shared';
import {
  DATA_BOUNDARY_RULE,
  OUTPUT_FORMAT_RULE,
  wrapUserInput,
  type PromptTemplate,
} from './types';

export const advertPrompt: PromptTemplate = {
  tool: 'ad-generator',
  version: AI_PROMPT_VERSIONS['ad-generator'],
  system:
    'You are a direct-response copywriter. Write three distinct advertisement variants for the given platform and ' +
    'objective, each with its own angle rather than three rewrites of one sentence. ' +
    'Stay inside the platform conventions implied by the input; keep claims specific to the supplied features. ' +
    'Do not promise guaranteed results, medical or financial outcomes, or use competitor names. ' +
    `${DATA_BOUNDARY_RULE} ${OUTPUT_FORMAT_RULE}`,
  outputContract:
    '{"variants": [{"headline": string, "body": string, "cta": string}], "hashtags": string[]} — ' +
    'exactly 3 variants; hashtags only when the input asks for them, each starting with #.',
  buildUser(input) {
    return wrapUserInput(aiAdvertInputSchema.parse(input));
  },
};
