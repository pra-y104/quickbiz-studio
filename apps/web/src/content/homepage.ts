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
  readonly icon: 'server' | 'ledger' | 'unavailable' | 'shield' | 'privacy';
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
    eyebrow: 'Free everyday tools, with AI writing on the way',
    titleLead: 'Do the work.',
    titleAccent: 'Skip the subscription.',
    subtitle:
      'Build invoices, convert units, run the numbers and clean up text in one calm workspace. The free tools work instantly with no account, and nothing you type leaves your device. AI writing tools are in development and will show their cost before every run.',
    primaryCta: 'Browse the tools',
    secondaryCta: 'See what is available',
    reassurance: 'No account needed  ·  Nothing uploaded  ·  Free tools stay free',
    audienceLabel: 'Built for',
    audiences: [
      'Business owners',
      'Freelancers',
      'Students',
      'Job seekers',
      'Creators',
      'Small teams',
    ],
    previewCaption: 'Example of the planned AI Writer screen, using sample content.',
  },
  aiTools: {
    eyebrow: 'AI tools',
    title: 'Writing that clears your desk',
    description:
      'Eight focused assistants for the work people actually get asked to do — letters, adverts, product copy, translations, business plans and social captions.',
    note: 'These AI tools are planned and are not available in this build. Each will show its cost before a run and will only use content you choose to submit.',
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
      'The product is built around the task. Free tools need no account, and nothing you type leaves your device.',
    steps: [
      {
        title: 'Choose the tool',
        body: 'Pick the job you need done. Free utilities open instantly; AI tools are grouped by the kind of writing they produce.',
        icon: 'search',
      },
      {
        title: 'Free means free',
        body: 'Every free utility runs on your device with no account and no allowance. When AI tools open, their cost will be shown before a run.',
        icon: 'receipt',
      },
      {
        title: 'Keep what you make',
        body: 'Copy or download the result as a file. Free tools never upload your work to a server.',
        icon: 'archive',
      },
    ],
  },
  pricing: {
    eyebrow: 'Pricing',
    title: 'Pay for the work, not the calendar',
    description:
      'The free tools cost nothing, now and in future. Paid AI usage is planned as pay-as-you-go, with the cost of a run shown before it starts.',
    plans: [
      {
        name: 'Free tools',
        price: 'Free',
        priceNote: 'always',
        features: [
          'Calculators, converters and text utilities',
          'Invoice and quotation builders',
          'No account required',
          'Unlimited use, no allowance to run out of',
        ],
      },
      {
        name: 'AI writing tools',
        price: 'Planned',
        priceNote: 'not available yet',
        features: [
          'Eight writing assistants in development',
          'Cost shown before each run',
          'No subscription required',
          'Availability announced before launch',
        ],
      },
      {
        name: 'Pay as you go',
        price: 'Planned',
        priceNote: 'pricing published before launch',
        features: [
          'Credit packs when AI tools open',
          'Pay only for what you use',
          'No forced subscription',
          'Local prices in naira and US dollars',
        ],
      },
    ],
    footnote:
      'AI tools and payments are not available in this build. Prices will be published before either opens.',
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
        title: 'Nothing is charged without a shown price',
        body: 'When paid AI tools open, the cost of a run will appear before you confirm it.',
      },
      {
        title: 'No hidden charges',
        body: 'There will be no auto-renewal and no charge you did not agree to at that moment.',
      },
      {
        title: 'Clear status, not big claims',
        body: 'Planned features are labelled as planned. Nothing on this site claims a capability it does not have.',
      },
      {
        title: 'Free tools carry no conditions',
        body: 'No account, no card and no allowance is needed for any free utility.',
      },
      {
        title: 'No advertising trackers',
        body: 'This site runs no advertising networks and no third-party analytics in the pages you browse.',
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
      'Terms of service, a privacy policy and a refund policy are published before accounts, AI tools or payments open.',
  },
  trust: {
    eyebrow: 'Trust and transparency',
    title: 'Your data, handled carefully',
    description:
      'The free tools run on your device, and the server-side controls are built before anything valuable is stored.',
    points: [
      {
        title: 'Free tools run on your device',
        body: 'Calculators, converters and the invoice builders never upload what you type.',
        icon: 'server',
      },
      {
        title: 'Access tokens verified on the server',
        body: 'Every protected request is checked against the identity provider; a user id in the request body is ignored.',
        icon: 'ledger',
      },
      {
        title: 'AI and service keys stay server-side',
        body: 'AI and service keys are worker secrets and never reach your browser. Only the public Supabase project configuration is exposed, and access to your data is still enforced on the server.',
        icon: 'shield',
      },
      {
        title: 'Payments are not connected',
        body: 'No card details are collected and no payment is taken in this build. Wallets and checkout arrive with their own review.',
        icon: 'unavailable',
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
          'A credit is the unit paid AI usage will be measured in once AI tools open. AI tools are not available in this build, and no free tool consumes anything.',
      },
      {
        question: 'Can I buy credits today?',
        answer:
          'No. Payments are not connected in this build. Pricing will be published before AI tools and checkout open.',
      },
      {
        question: 'Are my designs saved online?',
        answer:
          'Not yet. Creative Studio projects are stored in this browser on this device. Cloud saving is planned and will ship with a privacy policy.',
      },
      {
        question: 'Is there a subscription?',
        answer:
          'No. The plan is pay-as-you-go when AI tools open, and a recurring plan will not be required to use them.',
      },
    ],
  },
  finalCta: {
    title: 'Start with the tools that cost nothing',
    body: 'Free utilities open without an account, with no sign-up and nothing to install. AI writing tools are on the way and will show their cost before a run.',
    cta: 'Browse the free tools',
    note: 'Free tools are live now. AI generation and payments are not available in this build.',
  },
};

/** Top navigation shown on marketing pages. All targets are on this page. */
export const HOMEPAGE_NAV = [
  { label: 'Free tools', href: '#free-tools' },
  { label: 'AI tools', href: '#ai-tools' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Our promise', href: '#promise' },
  { label: 'Questions', href: '#questions' },
] as const;

export const HOMEPAGE_ANNOUNCEMENT =
  'Free everyday tools are live now — AI tools and payments arrive in upcoming builds.';
