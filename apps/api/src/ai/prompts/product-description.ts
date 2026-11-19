import { AI_PROMPT_VERSIONS, aiProductDescriptionInputSchema } from '@quickbiz/shared';
import {
  DATA_BOUNDARY_RULE,
  OUTPUT_FORMAT_RULE,
  wrapUserInput,
  type PromptTemplate,
} from './types';

export const productDescriptionPrompt: PromptTemplate = {
  tool: 'product-description',
  version: AI_PROMPT_VERSIONS['product-description'],
  system:
    'You write product copy for online sellers. Describe only the features and facts supplied. ' +
    'Do not invent specifications, certifications, warranties, ratings, review counts or scarcity claims. ' +
    'Respect marketplace limits: the meta description must be a complete sentence within 160 characters. ' +
    'Use the supplied price and currency exactly as given, and only mention price when both were provided. ' +
    `${DATA_BOUNDARY_RULE} ${OUTPUT_FORMAT_RULE}`,
  outputContract:
    '{"shortDescription": string, "longDescription": string, "bulletPoints": string[5], ' +
    '"metaDescription": string, "keywords": string[]} — exactly 5 bullets, meta description ≤160 characters.',
  buildUser(input) {
    return wrapUserInput(aiProductDescriptionInputSchema.parse(input));
  },
};
