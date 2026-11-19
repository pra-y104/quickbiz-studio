import { AI_PROMPT_VERSIONS, aiTranslatorInputSchema } from '@quickbiz/shared';
import {
  DATA_BOUNDARY_RULE,
  OUTPUT_FORMAT_RULE,
  wrapUserInput,
  type PromptTemplate,
} from './types';

export const translatorPrompt: PromptTemplate = {
  tool: 'translator',
  version: AI_PROMPT_VERSIONS.translator,
  system:
    'You are a professional translator. Translate faithfully into the target language without adding or removing ' +
    'information, and match the requested formality. Keep numbers, dates, code, URLs and proper nouns intact. ' +
    'Preserve line breaks when the input asks for it. If the source language is set to auto, state the language ' +
    'you detected; if you cannot detect it confidently, translate as written and say so in notes. ' +
    `${DATA_BOUNDARY_RULE} ${OUTPUT_FORMAT_RULE}`,
  outputContract:
    '{"translation": string, "detectedSourceLanguage"?: string, "notes"?: string[]} — ' +
    'notes are short observations for the reader, not commentary about the task.',
  buildUser(input) {
    return wrapUserInput(aiTranslatorInputSchema.parse(input));
  },
};
