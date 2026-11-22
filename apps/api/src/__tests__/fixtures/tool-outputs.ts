/**
 * Deterministic, schema-valid sample outputs for all eight AI tools.
 *
 * These exist so the pipeline can be exercised offline for every tool without a
 * provider. They are test data: they are never served, never used as a fallback and
 * never presented to a customer as generated text.
 *
 * Each fixture is validated against its output schema in the AI suite, so a schema
 * change that breaks a fixture fails the build rather than silently drifting.
 */

export const TOOL_OUTPUT_FIXTURES = {
  'ai-writer': {
    title: 'Opening a neighbourhood bakery',
    sections: [
      {
        heading: 'Start with a small menu',
        body: 'A short menu keeps waste low while you learn what the neighbourhood buys.',
      },
      {
        heading: 'Price for ingredients and time',
        body: 'Cost every loaf, then add a margin that covers rent, power and your own hours.',
      },
    ],
  },
  'ad-generator': {
    variants: [
      {
        headline: 'Fresh bread, every morning',
        body: 'Baked on site before the shutters go up.',
        cta: 'Order today',
      },
      {
        headline: 'Your street now has a bakery',
        body: 'Sourdough, pastries and proper coffee, five minutes from home.',
        cta: 'Visit us',
      },
      {
        headline: 'Pre-order for the weekend',
        body: 'Reserve a loaf and skip the queue on Saturday morning.',
        cta: 'Reserve now',
      },
    ],
    hashtags: ['bakery', 'freshbread', 'lagosfood'],
  },
  translator: {
    translation: 'Bonjour, comment allez-vous ?',
    detectedSourceLanguage: 'en',
    notes: ['Formal register.'],
  },
  'text-improver': {
    improved: 'We are writing to follow up on invoice 1042, which was due on the 9th.',
    changes: ['Replaced the informal greeting.', 'Shortened the sentence.'],
    summary: 'Made the message clearer and more concise.',
  },
  'product-description': {
    shortDescription: 'A compact stand mixer built for small kitchens.',
    longDescription:
      'A compact stand mixer with a 4.5 litre bowl, ten speeds and a dough hook, designed to fit on a crowded counter without giving up power.',
    bulletPoints: [
      '4.5 litre bowl',
      'Ten speed settings',
      'Dough hook included',
      'Dishwasher-safe parts',
      'Two-year warranty',
    ],
    metaDescription: 'Compact stand mixer with a 4.5 litre bowl and ten speeds.',
    keywords: ['stand mixer', 'baking', 'kitchen'],
  },
  'business-name-generator': {
    ideas: Array.from({ length: 10 }, (_, index) => ({
      name: `Crumb & Co ${index + 1}`,
      slogan: 'Baked for your street.',
      rationale: 'Short, memorable and easy to say in English and Yoruba.',
      style: 'modern' as const,
    })),
  },
  'social-caption': {
    captions: [
      {
        text: 'Fresh bread, out of the oven at 7am. Come and get it while it is warm.',
        hashtags: ['freshbread', 'lagosfood'],
        characterCount: 74,
      },
      {
        text: 'Three new pastries this week. Which one should we bake again?',
        hashtags: ['bakery', 'pastry'],
        characterCount: 66,
      },
      {
        text: 'We are open until 6pm today. Bring a friend, get a second coffee on us.',
        hashtags: ['coffee', 'deals'],
        characterCount: 77,
      },
    ],
  },
  'business-plan-assistant': {
    title: 'Neighbourhood bakery — first year plan',
    sections: [
      {
        heading: 'Summary',
        body: 'A single-site bakery serving a dense residential area with fresh bread and pastries.',
        assumptions: ['Average spend per visit stays at 2,500 naira.'],
      },
      {
        heading: 'Operations',
        body: 'Two ovens, one storefront, four staff, opening six days a week.',
        assumptions: ['Rent is reviewed annually.'],
      },
    ],
    nextSteps: ['Confirm the lease terms.', 'Price the fit-out.'],
    disclaimer: 'Financial projections are estimates, not guarantees.',
  },
} as const;
