/**
 * Homepage copy (English).
 *
 * Long-form marketing prose lives here as typed content instead of a translation
 * JSON so the shape is enforced at compile time and sections can be composed
 * safely. When a second locale is added, it supplies the same `HomepageContent`
 * shape and the page picks it by locale.
 *
 * Honesty rule: nothing in this file may promise a capability that the current
 * build does not have. Sections that describe tooling still in development say so.
 */
export type SectionIntro = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
};

export type ToolSectionContent = SectionIntro & {
  readonly note: string;
};

export type Step = {
  readonly title: string;
  readonly body: string;
  readonly icon: 'search' | 'receipt' | 'archive';
};

export type Plan = {
  readonly name: string;
  readonly price: string;
  readonly priceNote: string;
  readonly features: readonly string[];
  readonly emphasis?: boolean;
};

export type PromiseItem = {
  readonly title: string;
  readonly body: string;
};

export type TrustPoint = {
  readonly title: string;
  readonly body: string;
  readonly icon: 'server' | 'ledger' | 'refund' | 'shield' | 'privacy';
};

export type FaqItem = {
  readonly question: string;
  readonly answer: string;
};

export interface HomepageContent {
  readonly hero: {
    readonly eyebrow: string;
    readonly titleLead: string;
    readonly titleAccent: string;
    readonly subtitle: string;
    readonly primaryCta: string;
    readonly secondaryCta: string;
    readonly reassurance: string;
    readonly audienceLabel: string;
    readonly audiences: readonly string[];
    readonly previewCaption: string;
  };
  readonly aiTools: ToolSectionContent;
  readonly freeTools: ToolSectionContent;
  readonly howItWorks: SectionIntro & { readonly steps: readonly Step[] };
  readonly pricing: SectionIntro & {
    readonly plans: readonly Plan[];
    readonly footnote: string;
  };
  readonly promise: SectionIntro & {
    readonly items: readonly PromiseItem[];
    readonly footnote: string;
  };
  readonly trust: SectionIntro & { readonly points: readonly TrustPoint[] };
  readonly faq: SectionIntro & { readonly items: readonly FaqItem[] };
  readonly finalCta: {
    readonly title: string;
    readonly body: string;
    readonly cta: string;
    readonly note: string;
  };
}

export const HOMEPAGE: HomepageContent = {
  hero: {
    eyebrow: 'AI writing and everyday tools, together',
    titleLead: 'Do the work.',
    titleAccent: 'Skip the subscription.',
    subtitle:
      'Draft letters and adverts, translate, polish copy, build invoices, convert units and run the numbers — in one calm workspace. Free tools need no account. Paid AI runs on credits you buy once, at a price shown before you click.',
    primaryCta: 'Browse the tools',
    secondaryCta: 'See how credits work',
    reassurance:
      'No recurring subscription  ·  Cost shown before every run  ·  Free tools stay free',
    audienceLabel: 'Built for',
    audiences: [
      'Business owners',
      'Freelancers',
      'Students',
      'Job seekers',
      'Creators',
      'Small teams',
    ],
    previewCaption: 'Interface preview with sample content. Not a live generation.',
  },
  aiTools: {
    eyebrow: 'AI tools',
    title: 'Writing that clears your desk',
    description:
      'Eight focused assistants for the work people actually get asked to do — letters, adverts, product copy, translations, business plans and social captions.',
    note: 'These AI tools are in the current build queue. When they open, every run shows its credit cost before you confirm, and a qualifying technical failure is refunded automatically.',
  },
  freeTools: {
    eyebrow: 'Free tools',
    title: 'Everyday utilities, always free',
    description:
      'Calculators, converters, invoice and quotation builders, counters and text clean-up. No credits, no paywall, no sign-up wall between you and the result.',
    note: 'These eight tools are live now, free and without an account. Each one runs entirely in your browser, and nothing you type is uploaded.',
  },
  howItWorks: {
    eyebrow: 'How it works',
    title: 'Three steps, no learning curve',
    description:
      'The product is built around the task, not around a billing meter. You always know what a run will cost before it starts.',
    steps: [
      {
        title: 'Choose the tool',
        body: 'Pick the job you need done. Free utilities open instantly; AI tools are grouped by the kind of writing they produce.',
        icon: 'search',
      },
      {
        title: 'See the price first',
        body: 'For AI work, the exact credit cost sits on the submit button. Nothing is deducted silently or in the background.',
        icon: 'receipt',
      },
      {
        title: 'Keep what you make',
        body: 'Copy or download the result. Signed-in users can save outputs and review a complete usage and transaction history.',
        icon: 'archive',
      },
    ],
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Pay for the work, not the calendar',
    description:
      'Credits are the only thing you buy. No monthly plan, no auto-renewal, no surprise deductions. Purchased credits stay in your wallet until you choose to use them.',
    plans: [
      {
        name: 'Free tools',
        price: 'Free',
        priceNote: 'always',
        features: [
          'Calculators, converters and text utilities',
          'Invoice and quotation builders',
          'No account required',
          'No credits deducted, ever',
        ],
      },
      {
        name: 'New account trial',
        price: 'Free',
        priceNote: 'on email verification',
        features: [
          'A small AI allowance to try paid tools',
          'Same credit prices as everyone else',
          'Daily fair-use cap',
          'Free credits may expire — disclosed up front',
        ],
      },
      {
        name: 'Pay as you go',
        price: 'Credits',
        priceNote: 'price shown at checkout',
        features: [
          'Buy credits only when you need them',
          'Purchased credits never expire',
          'Qualifying failures refunded automatically',
          'No forced subscription',
        ],
        emphasis: true,
      },
    ],
    footnote:
      'Credit packages and local prices are published before checkout opens. This preview build cannot take or process any payment.',
  },
  promise: {
    eyebrow: 'Our promise',
    title: 'What we commit to, in plain language',
    description:
      'Useful tools should be accessible, affordable and transparent. These eight commitments govern how the platform is built.',
    items: [
      {
        title: 'Free tools stay accessible',
        body: 'Basic everyday tools work without registration or purchase.',
      },
      {
        title: 'Try before you pay',
        body: 'Verified accounts receive a small free AI allowance before buying anything.',
      },
      {
        title: 'No hidden charges',
        body: 'The credit cost is displayed before every paid action, and you decide whether to proceed.',
      },
      {
        title: 'Purchased credits never expire',
        body: 'Your balance waits for you. We do not remove purchased credits on a timer.',
      },
      {
        title: 'No charge for technical failures',
        body: 'If a paid run fails because of a qualifying technical error, the credits return automatically.',
      },
      {
        title: 'Your money deserves protection',
        body: 'Payments run through supported providers, and your transaction history is always available in your account.',
      },
      {
        title: 'Your privacy matters',
        body: 'We collect only what the service genuinely needs, and we protect it.',
      },
      {
        title: 'No forced subscriptions',
        body: 'Pay-as-you-go works on its own. A recurring plan is never required to use paid features.',
      },
    ],
    footnote:
      'Fair-use limits, service availability and legal conditions apply. Full terms, including refunds, are published before payments open.',
  },
  trust: {
    eyebrow: 'Trust and transparency',
    title: 'Money and data handled like they matter',
    description:
      'The platform is designed so a browser can never decide a balance, a price or a payment outcome.',
    points: [
      {
        title: 'Balances live on the server',
        body: 'Wallets and ledgers sit behind the API. Editing a request in your browser cannot add credits.',
        icon: 'server',
      },
      {
        title: 'Every deduction is recorded',
        body: 'Each charge writes an auditable ledger entry with an idempotency key, so a double submit cannot charge twice.',
        icon: 'ledger',
      },
      {
        title: 'Failures reverse themselves',
        body: 'A qualifying technical failure writes a compensating entry without waiting for a support ticket.',
        icon: 'refund',
      },
      {
        title: 'Payments are verified',
        body: 'Provider webhooks are signature-checked before a single credit is granted.',
        icon: 'shield',
      },
      {
        title: 'Data collection is minimal',
        body: 'We ask for what the service needs, and a retention and deletion policy is published before launch.',
        icon: 'privacy',
      },
    ],
  },
  faq: {
    eyebrow: 'Questions',
    title: 'The things people ask first',
    description: 'Short answers, without the sales gloss.',
    items: [
      {
        question: 'Do I need an account to use the free tools?',
        answer:
          'No. The calculators, converters and other everyday utilities are designed to work without signing up or paying.',
      },
      {
        question: 'What exactly is a credit?',
        answer:
          'A credit is a unit of paid AI usage. Every AI tool shows its cost before you run it. Free tools never consume credits.',
      },
      {
        question: 'Will my purchased credits expire?',
        answer:
          'No. Purchased credits stay in your wallet until you spend them. Free trial credits are separate and may expire, which is disclosed when they are granted.',
      },
      {
        question: 'What happens if a generation fails?',
        answer:
          'If the failure is on our side or the provider\u2019s, the credits are returned automatically and the run is marked in your usage history.',
      },
      {
        question: 'Is there a subscription?',
        answer:
          'Not at launch. The model is pay-as-you-go. Optional plans may be considered later only if real usage shows demand, and paid features will never require one.',
      },
    ],
  },
  finalCta: {
    title: 'Start with the tools that cost nothing',
    body: 'Free utilities open without an account. Add credits only when you want AI help with the writing.',
    cta: 'Browse the free tools',
    note: 'Free tools are live now. AI generation and payments are not available in this build.',
  },
};

/** Top navigation shown on marketing pages. All targets are on this page. */
export const HOMEPAGE_NAV = [
  { label: 'AI tools', href: '#ai-tools' },
  { label: 'Free tools', href: '#free-tools' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Our promise', href: '#promise' },
  { label: 'Questions', href: '#questions' },
] as const;

export const HOMEPAGE_ANNOUNCEMENT =
  'Free everyday tools are live now — AI tools and payments arrive in upcoming builds.';
