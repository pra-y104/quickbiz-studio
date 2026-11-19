import { AI_PROMPT_VERSIONS, aiSocialCaptionInputSchema } from '@quickbiz/shared';
import {
  DATA_BOUNDARY_RULE,
  OUTPUT_FORMAT_RULE,
  wrapUserInput,
  type PromptTemplate,
} from './types';

export const socialCaptionPrompt: PromptTemplate = {
  tool: 'social-caption',
  version: AI_PROMPT_VERSIONS['social-caption'],
  system:
    'You write social media captions. Produce three distinct captions for the given platform and audience, each ' +
    'with a clear opening line and the requested call to action. Respect platform length limits and use emoji only ' +
    'when the input allows them. Hashtags must relate to the topic; never invent trending tags or engagement ' +
    'numbers. For sensitive topics, keep the tone responsible and avoid sensational claims. ' +
    `${DATA_BOUNDARY_RULE} ${OUTPUT_FORMAT_RULE}`,
  outputContract:
    '{"captions": [{"text": string, "hashtags": string[], "characterCount": number}]} — exactly 3 captions; ' +
    'characterCount is the length of text including spaces, excluding hashtags.',
  buildUser(input) {
    return wrapUserInput(aiSocialCaptionInputSchema.parse(input));
  },
};
