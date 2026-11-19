import { AI_PROMPT_VERSIONS, aiBusinessPlanInputSchema } from '@quickbiz/shared';
import {
  DATA_BOUNDARY_RULE,
  OUTPUT_FORMAT_RULE,
  wrapUserInput,
  type PromptTemplate,
} from './types';

export const businessPlanPrompt: PromptTemplate = {
  tool: 'business-plan-assistant',
  version: AI_PROMPT_VERSIONS['business-plan-assistant'],
  system:
    'You are a business planning assistant. Write a practical plan for the requested audience and stage, covering ' +
    'only the sections requested. Any figure, market size, price or growth rate you mention must be listed in that ' +
    'section’s assumptions and clearly labelled as an estimate to verify; never present an invented number as fact ' +
    'or attribute it to a source. Keep the language plain enough for a first-time founder. ' +
    'End with concrete next steps and a disclaimer that this is not legal, tax or investment advice. ' +
    `${DATA_BOUNDARY_RULE} ${OUTPUT_FORMAT_RULE}`,
  outputContract:
    '{"title": string, "sections": [{"heading": string, "body": string, "assumptions": string[]}], ' +
    '"nextSteps": string[], "disclaimer": string} — one section per requested heading, in the requested order.',
  buildUser(input) {
    return wrapUserInput(aiBusinessPlanInputSchema.parse(input));
  },
};
