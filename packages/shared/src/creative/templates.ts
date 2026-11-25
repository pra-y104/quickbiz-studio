/**
 * Original Creative Studio templates.
 *
 * Every template is a function that returns plain document nodes positioned in
 * document pixels for a named canvas preset. Nothing here is downloaded, traced
 * or derived from a third-party design pack: the compositions are built from
 * geometry and typography owned by this repository, which is why they can be
 * shipped under the project's own terms.
 *
 * Templates are data, not pictures. Opening one produces a normal editable
 * document: every headline, shape and colour can be changed.
 */

import type {
  CreativeNode,
  CreativePaint,
  CreativeShapeNode,
  CreativeTextNode,
  FontFamilyId,
} from './document';
import { createCreativeDocument, toDocPixels } from './document';
import { estimateTextHeight } from './text-metrics';
import { canvasFromPreset, getPreset, requirePreset } from './presets';

export type CreativeTemplateCategory =
  'flyer' | 'poster' | 'social' | 'story' | 'business-card' | 'invitation' | 'event' | 'banner';

/**
 * Where a template comes from and who may use it.
 *
 * Catalogue metadata is data, not code: packs can be added, versioned and retired
 * without rebuilding the application, which is the point of keeping it here.
 */
export type CreativeTemplateTier = 'free' | 'premium';
export type CreativeTemplateStatus = 'published' | 'retired';

export interface CreativeTemplate {
  readonly id: string;
  readonly name: string;
  readonly category: CreativeTemplateCategory;
  readonly presetId: string;
  readonly description: string;
  /** Publishing group, used to organise the gallery. */
  readonly pack?: string;
  /** Search terms beyond the name and description. */
  readonly tags?: readonly string[];
  /** Free templates are usable without a credit balance. */
  readonly tier?: CreativeTemplateTier;
  /** Retired templates are excluded from the public gallery. */
  readonly status?: CreativeTemplateStatus;
  readonly build: () => readonly CreativeNode[];
}

/** Default pack for the starter collection. */
export const DEFAULT_TEMPLATE_PACK = 'starter';

export function templatePack(template: CreativeTemplate): string {
  return template.pack ?? DEFAULT_TEMPLATE_PACK;
}

export function templateTier(template: CreativeTemplate): CreativeTemplateTier {
  return template.tier ?? 'free';
}

export function templateStatus(template: CreativeTemplate): CreativeTemplateStatus {
  return template.status ?? 'published';
}

/** Public templates only: retired entries never reach the gallery. */
export function listPublishedTemplates(): readonly CreativeTemplate[] {
  return CREATIVE_TEMPLATES.filter((template) => templateStatus(template) === 'published');
}

interface TemplatePalette {
  readonly background: string;
  readonly ink: string;
  readonly accent: string;
  readonly soft: string;
  readonly muted: string;
}

const PALETTES: readonly TemplatePalette[] = [
  {
    background: '#0E1526',
    ink: '#F5F7FC',
    accent: '#7C5CFF',
    soft: '#E9E3FF',
    muted: '#A5B1CA',
  },
  {
    background: '#F7F4EC',
    ink: '#1E1B16',
    accent: '#B4552D',
    soft: '#EADFD3',
    muted: '#6E6558',
  },
  {
    background: '#F4F1FF',
    ink: '#1F1345',
    accent: '#6741E8',
    soft: '#D5C9FF',
    muted: '#5A4B86',
  },
  {
    background: '#0B2B26',
    ink: '#F2FBF7',
    accent: '#2FBF8F',
    soft: '#CFF3E6',
    muted: '#9BC7BA',
  },
  {
    background: '#FFFFFF',
    ink: '#0B1222',
    accent: '#1F6FE0',
    soft: '#E7F1FF',
    muted: '#5C6A82',
  },
  {
    background: '#2A0F1E',
    ink: '#FDF3F7',
    accent: '#FF5C8A',
    soft: '#FFD9E4',
    muted: '#C9A2B2',
  },
  {
    background: '#101418',
    ink: '#F4F6F8',
    accent: '#F5C451',
    soft: '#3A3320',
    muted: '#A7B0B8',
  },
  {
    background: '#EDEFF3',
    ink: '#131722',
    accent: '#0F7A58',
    soft: '#D7E8E1',
    muted: '#5B6472',
  },
];

/** Palette lookup that satisfies the compiler and the empty-list case. */
function paletteAt(index: number): TemplatePalette {
  return PALETTES[index] ?? (PALETTES[0] as TemplatePalette);
}

function subjectAt<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (!item) throw new RangeError('Template subject list is empty');
  return item;
}

function solid(color: string): CreativePaint {
  return { type: 'solid', color };
}

interface Frame {
  readonly width: number;
  readonly height: number;
  readonly margin: number;
  readonly scale: number;
}

function frameFor(presetId: string): Frame {
  const preset = requirePreset(presetId);
  const canvas = canvasFromPreset(preset);
  const pixels = toDocPixels(canvas);
  const shortest = Math.min(pixels.width, pixels.height);
  return {
    width: pixels.width,
    height: pixels.height,
    margin: Math.round(shortest * 0.075),
    scale: shortest / 1080,
  };
}

interface TextOptions {
  readonly id: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly size: number;
  readonly color: string;
  readonly family?: FontFamilyId;
  readonly weight?: 400 | 500 | 600 | 700 | 800;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly align?: 'left' | 'center' | 'right';
  readonly lineHeight?: number;
  readonly letterSpacing?: number;
  readonly name?: string;
  readonly verticalAlign?: 'top' | 'middle' | 'bottom';
}

function text(options: TextOptions): CreativeTextNode {
  const lineHeight = options.lineHeight ?? 1.15;
  const height = Math.max(
    options.size,
    Math.round(
      estimateTextHeight({
        text: options.text,
        width: options.width,
        fontSize: options.size,
        fontFamily: options.family ?? 'sans',
        fontWeight: options.weight ?? 400,
        lineHeight,
        letterSpacing: options.letterSpacing ?? 0,
      }),
    ),
  );

  return {
    id: options.id,
    type: 'text',
    name: options.name ?? options.text.slice(0, 40),
    x: Math.round(options.x),
    y: Math.round(options.y),
    width: Math.round(options.width),
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    text: options.text,
    fontFamily: options.family ?? 'sans',
    fontSize: Math.round(options.size),
    fontWeight: options.weight ?? 400,
    italic: options.italic ?? false,
    underline: options.underline ?? false,
    align: options.align ?? 'left',
    lineHeight,
    letterSpacing: options.letterSpacing ?? 0,
    color: options.color,
    verticalAlign: options.verticalAlign ?? 'top',
  };
}

interface ShapeOptions {
  readonly id: string;
  readonly shape: CreativeShapeNode['shape'];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fill: string;
  readonly rotation?: number;
  readonly opacity?: number;
  readonly cornerRadius?: number;
  readonly stroke?: CreativeShapeNode['stroke'];
  readonly name?: string;
}

function shape(options: ShapeOptions): CreativeShapeNode {
  return {
    id: options.id,
    type: 'shape',
    name: options.name ?? options.shape,
    x: Math.round(options.x),
    y: Math.round(options.y),
    width: Math.round(options.width),
    height: Math.round(options.height),
    rotation: options.rotation ?? 0,
    opacity: options.opacity ?? 1,
    locked: false,
    hidden: false,
    shape: options.shape,
    fill: solid(options.fill),
    stroke: options.stroke ?? null,
    cornerRadius: options.cornerRadius ?? 0,
  };
}

/** Decorative geometry used across templates. Never overlaps live text areas. */
function ornament(
  id: string,
  variant: number,
  frame: Frame,
  palette: TemplatePalette,
): readonly CreativeNode[] {
  const { width: W, height: H, margin: M } = frame;

  switch (variant % 4) {
    case 0:
      return [
        shape({
          id: `${id}-disc`,
          shape: 'ellipse',
          x: W - M * 1.1,
          y: -H * 0.08,
          width: W * 0.5,
          height: W * 0.5,
          fill: palette.accent,
          opacity: 0.18,
          name: 'Accent disc',
        }),
        shape({
          id: `${id}-bar`,
          shape: 'rect',
          x: M,
          y: H * 0.5,
          width: M * 0.9,
          height: H * 0.32,
          fill: palette.accent,
          name: 'Accent bar',
        }),
      ];
    case 1:
      return [
        shape({
          id: `${id}-band`,
          shape: 'rect',
          x: 0,
          y: H * 0.62,
          width: W,
          height: H * 0.16,
          fill: palette.accent,
          opacity: 0.14,
          name: 'Colour band',
        }),
        shape({
          id: `${id}-ring`,
          shape: 'ellipse',
          x: W * 0.62,
          y: H * 0.08,
          width: W * 0.3,
          height: W * 0.3,
          fill: palette.soft,
          opacity: 0.5,
          name: 'Soft ring',
        }),
      ];
    case 2:
      return [
        shape({
          id: `${id}-frame`,
          shape: 'rect',
          x: M * 0.55,
          y: M * 0.55,
          width: W - M * 1.1,
          height: H - M * 1.1,
          fill: palette.background,
          opacity: 0,
          stroke: { color: palette.accent, width: Math.max(2, frame.scale * 3), style: 'solid' },
          name: 'Inset frame',
        }),
        shape({
          id: `${id}-chip`,
          shape: 'roundRect',
          x: W - M * 2.4,
          y: H - M * 1.9,
          width: M * 1.8,
          height: M * 1.2,
          fill: palette.accent,
          cornerRadius: frame.scale * 12,
          rotation: -8,
          name: 'Accent chip',
        }),
      ];
    default:
      return [
        shape({
          id: `${id}-tri`,
          shape: 'triangle',
          x: W * 0.55,
          y: -H * 0.05,
          width: W * 0.55,
          height: H * 0.3,
          fill: palette.accent,
          opacity: 0.16,
          name: 'Angle block',
        }),
        shape({
          id: `${id}-line`,
          shape: 'line',
          x: M,
          y: H * 0.86,
          width: W - M * 2,
          height: Math.max(2, frame.scale * 4),
          fill: palette.accent,
          name: 'Divider',
        }),
      ];
  }
}

interface CompositionOptions {
  readonly prefix: string;
  readonly frame: Frame;
  readonly palette: TemplatePalette;
  readonly variant: number;
  readonly eyebrow: string;
  readonly headline: string;
  readonly body: string;
  readonly footer: string;
  /** Fraction of canvas height where the headline block starts. */
  readonly headlineTop: number;
  readonly headlineScale: number;
  readonly align?: 'left' | 'center';
}

/**
 * Shared skeleton: ornament, eyebrow, headline, body and footer.
 *
 * Every template differs in palette, type scale and accent geometry, so the
 * result reads as a family rather than one layout recoloured.
 */
function compose(options: CompositionOptions): readonly CreativeNode[] {
  const { frame, palette } = options;
  const { width: W, margin: M } = frame;
  const align = options.align ?? 'left';
  const inset = align === 'center' ? M : M;
  const columnWidth = W - inset * 2;
  const headlineSize = frame.scale * options.headlineScale;
  const eyebrowSize = frame.scale * 22;
  const bodySize = frame.scale * 30;
  const footerSize = frame.scale * 24;

  const headline = text({
    id: `${options.prefix}-headline`,
    text: options.headline,
    x: inset,
    y: frame.height * options.headlineTop,
    width: columnWidth,
    size: headlineSize,
    color: palette.ink,
    weight: 800,
    family: options.variant % 3 === 1 ? 'serif' : 'sans',
    lineHeight: 1.06,
    letterSpacing: -headlineSize * 0.015,
    align,
    name: 'Headline',
  });

  const eyebrow = text({
    id: `${options.prefix}-eyebrow`,
    text: options.eyebrow.toUpperCase(),
    x: inset,
    y: headline.y - eyebrowSize * 2.6,
    width: columnWidth,
    size: eyebrowSize,
    color: palette.accent,
    weight: 700,
    letterSpacing: eyebrowSize * 0.18,
    align,
    name: 'Eyebrow',
  });

  const body = text({
    id: `${options.prefix}-body`,
    text: options.body,
    x: inset,
    y: headline.y + headline.height + bodySize * 1.4,
    width: Math.min(columnWidth, W * 0.62),
    size: bodySize,
    color: palette.muted,
    weight: 400,
    lineHeight: 1.5,
    align,
    name: 'Supporting copy',
  });

  const footer = text({
    id: `${options.prefix}-footer`,
    text: options.footer,
    x: inset,
    y: frame.height - M * 1.5 - footerSize,
    width: columnWidth,
    size: footerSize,
    color: palette.ink,
    weight: 600,
    letterSpacing: footerSize * 0.08,
    align,
    name: 'Footer',
  });

  return [
    ...ornament(options.prefix, options.variant, frame, palette),
    eyebrow,
    headline,
    body,
    footer,
  ];
}

function buildFlyer(variant: number): CreativeTemplate {
  const frame = frameFor('a4-portrait');
  const palette = paletteAt(variant);
  const subjects = [
    {
      eyebrow: 'Grand opening',
      headline: 'A new kind of neighbourhood bakery',
      body: 'Fresh bread, small-batch pastries and proper coffee, baked on site every morning from 6am.',
      footer: '14 Market Road  ·  Open daily 7am – 6pm',
    },
    {
      eyebrow: 'Seasonal menu',
      headline: 'Three courses, one long evening',
      body: 'A set menu built around the season, served family style. Booking essential, walk-ins welcome at the bar.',
      footer: 'Reservations  ·  +234 800 000 0000',
    },
    {
      eyebrow: 'Service update',
      headline: 'Same-day delivery now covers the whole city',
      body: 'Order before 2pm for delivery the same evening. Packaging is fully recyclable and returnable.',
      footer: 'Track every order from your dashboard',
    },
  ];
  const subject = subjectAt(subjects, variant);

  return {
    id: `flyer-${variant + 1}`,
    name: `Flyer ${variant + 1}`,
    category: 'flyer',
    presetId: 'a4-portrait',
    description: 'A single-message A4 flyer with a clear headline and footer call to action.',
    build: () => [
      ...compose({
        prefix: 'flyer',
        frame,
        palette,
        variant,
        eyebrow: subject.eyebrow,
        headline: subject.headline,
        body: subject.body,
        footer: subject.footer,
        headlineTop: 0.24,
        headlineScale: 118,
      }),
    ],
  };
}

function buildPoster(variant: number): CreativeTemplate {
  const presetId = variant === 1 ? 'a4-landscape' : 'a4-portrait';
  const frame = frameFor(presetId);
  const palette = paletteAt(variant + 2);
  const subjects = [
    {
      eyebrow: 'Free entry',
      headline: 'Design systems that survive contact with reality',
      body: 'A practical talk about tokens, constraints and the parts nobody puts in the case study.',
      footer: 'Thursday  ·  6pm  ·  Main auditorium',
    },
    {
      eyebrow: 'Market day',
      headline: 'Forty makers, one courtyard',
      body: 'Ceramics, textiles, prints and food from independent studios across the city.',
      footer: 'Saturday  ·  9am – 4pm  ·  Old Depot Yard',
    },
    {
      eyebrow: 'Now enrolling',
      headline: 'Learn the craft behind the picture',
      body: 'Eight evening sessions covering light, composition and editing with working photographers.',
      footer: 'Applications close at the end of the month',
    },
  ];
  const subject = subjectAt(subjects, variant);

  return {
    id: `poster-${variant + 1}`,
    name: `Poster ${variant + 1}`,
    category: 'poster',
    presetId,
    description: 'A bold typographic poster with one dominant message.',
    build: () => [
      ...compose({
        prefix: 'poster',
        frame,
        palette,
        variant,
        eyebrow: subject.eyebrow,
        headline: subject.headline,
        body: subject.body,
        footer: subject.footer,
        headlineTop: variant === 1 ? 0.3 : 0.22,
        headlineScale: variant === 1 ? 96 : 132,
      }),
    ],
  };
}

function buildSocial(variant: number): CreativeTemplate {
  const presetId = variant === 1 ? 'social-portrait' : 'social-square';
  const frame = frameFor(presetId);
  const palette = paletteAt(variant + 4);
  const subjects = [
    {
      eyebrow: 'New drop',
      headline: 'Meet the spring collection',
      body: 'Six pieces, made in small runs.',
      footer: 'Shop the collection',
    },
    {
      eyebrow: 'Tip',
      headline: 'The fastest way to lose a customer is a slow checkout',
      body: 'Three fixes you can ship this week.',
      footer: 'Read the breakdown',
    },
    {
      eyebrow: 'Behind the scenes',
      headline: 'How the studio actually spends a Tuesday',
      body: 'Sketching, printing, and a lot of coffee.',
      footer: 'Follow for part two',
    },
  ];
  const subject = subjectAt(subjects, variant);

  return {
    id: `social-${variant + 1}`,
    name: `Social post ${variant + 1}`,
    category: 'social',
    presetId,
    description: 'A feed-ready social graphic with a strong focal headline.',
    build: () => [
      ...compose({
        prefix: 'social',
        frame,
        palette,
        variant,
        eyebrow: subject.eyebrow,
        headline: subject.headline,
        body: subject.body,
        footer: subject.footer,
        headlineTop: variant === 1 ? 0.34 : 0.28,
        headlineScale: variant === 1 ? 84 : 78,
      }),
    ],
  };
}

function buildStory(variant: number): CreativeTemplate {
  const frame = frameFor('social-story');
  const palette = paletteAt(variant + 6);
  const subjects = [
    {
      eyebrow: 'Swipe up',
      headline: 'Two hours, one clear plan',
      body: 'Our workshop template, free this week.',
      footer: 'Link in bio',
    },
    {
      eyebrow: 'Day three',
      headline: 'The part nobody films',
      body: 'Packing orders until midnight.',
      footer: 'Tap for the full story',
    },
    {
      eyebrow: 'Last chance',
      headline: 'Early pricing ends tonight',
      body: 'Save before the doors open.',
      footer: 'Tap to claim',
    },
  ];
  const subject = subjectAt(subjects, variant);

  return {
    id: `story-${variant + 1}`,
    name: `Story ${variant + 1}`,
    category: 'story',
    presetId: 'social-story',
    description: 'A vertical story layout with generous type and a tap target.',
    build: () => [
      ...compose({
        prefix: 'story',
        frame,
        palette,
        variant,
        eyebrow: subject.eyebrow,
        headline: subject.headline,
        body: subject.body,
        footer: subject.footer,
        headlineTop: 0.3,
        headlineScale: 96,
      }),
      shape({
        id: 'story-cta',
        shape: 'roundRect',
        x: frame.margin,
        y: frame.height - frame.margin * 2.6,
        width: frame.width - frame.margin * 2,
        height: frame.scale * 92,
        fill: palette.accent,
        cornerRadius: frame.scale * 46,
        name: 'Tap target',
      }),
    ],
  };
}

function buildBusinessCard(variant: number): CreativeTemplate {
  const frame = frameFor('business-card');
  const palette = paletteAt(variant + 1);
  const people = [
    { name: 'Amara Nwosu', role: 'Founder', contact: 'amara@studio.example  ·  +234 800 000 0000' },
    {
      name: 'Tobi Adeyemi',
      role: 'Creative Director',
      contact: 'tobi@studio.example  ·  studio.example',
    },
    {
      name: 'Lerato Mokoena',
      role: 'Studio Manager',
      contact: 'lerato@studio.example  ·  +27 82 000 0000',
    },
  ];
  const person = subjectAt(people, variant);

  return {
    id: `card-${variant + 1}`,
    name: `Business card ${variant + 1}`,
    category: 'business-card',
    presetId: 'business-card',
    description: 'An 85 × 55 mm card with a clear name, role and contact line.',
    build: () => [
      shape({
        id: 'card-panel',
        shape: 'rect',
        x: 0,
        y: 0,
        width: frame.width * 0.34,
        height: frame.height,
        fill: palette.accent,
        name: 'Colour panel',
      }),
      text({
        id: 'card-name',
        text: person.name,
        x: frame.width * 0.42,
        y: frame.height * 0.3,
        width: frame.width * 0.5,
        size: frame.scale * 34,
        color: palette.ink,
        weight: 700,
        name: 'Name',
      }),
      text({
        id: 'card-role',
        text: person.role.toUpperCase(),
        x: frame.width * 0.42,
        y: frame.height * 0.3 + frame.scale * 44,
        width: frame.width * 0.5,
        size: frame.scale * 18,
        color: palette.accent,
        weight: 700,
        letterSpacing: frame.scale * 3,
        name: 'Role',
      }),
      text({
        id: 'card-contact',
        text: person.contact,
        x: frame.width * 0.42,
        y: frame.height * 0.72,
        width: frame.width * 0.5,
        size: frame.scale * 15,
        color: palette.muted,
        weight: 400,
        name: 'Contact',
      }),
      shape({
        id: 'card-mark',
        shape: 'ellipse',
        x: frame.width * 0.1,
        y: frame.height * 0.38,
        width: frame.scale * 60,
        height: frame.scale * 60,
        fill: palette.soft,
        name: 'Mark',
      }),
    ],
  };
}

function buildInvitation(variant: number): CreativeTemplate {
  const frame = frameFor('a5-portrait');
  const palette = paletteAt(variant + 3);
  const events = [
    {
      eyebrow: 'You are invited',
      headline: 'An evening to mark ten years',
      body: 'Join us for dinner, a short programme and a look back at how it started.',
      footer: 'Saturday  ·  7pm  ·  The Courtyard',
    },
    {
      eyebrow: 'Save the date',
      headline: 'A wedding in the garden',
      body: 'Ceremony at four, dinner at six, dancing until the lights go out.',
      footer: 'Kindly reply by the first of the month',
    },
    {
      eyebrow: 'Opening night',
      headline: 'The gallery opens its doors',
      body: 'A first look at the new space, with the artists in attendance.',
      footer: 'Friday  ·  6pm until late',
    },
  ];
  const event = subjectAt(events, variant);

  return {
    id: `invitation-${variant + 1}`,
    name: `Invitation ${variant + 1}`,
    category: 'invitation',
    presetId: 'a5-portrait',
    description: 'A calm A5 invitation with an editorial serif headline.',
    build: () => [
      ...compose({
        prefix: 'invite',
        frame,
        palette,
        variant,
        eyebrow: event.eyebrow,
        headline: event.headline,
        body: event.body,
        footer: event.footer,
        headlineTop: 0.3,
        headlineScale: 104,
      }),
    ],
  };
}

function buildEvent(variant: number): CreativeTemplate {
  const presetId = variant === 1 ? 'social-story' : variant === 2 ? 'a4-landscape' : 'a4-portrait';
  const frame = frameFor(presetId);
  const palette = paletteAt(variant + 5);
  const events = [
    {
      eyebrow: 'Conference',
      headline: 'Build small, ship often',
      body: 'A one-day conference for people who make products with tiny teams.',
      footer: 'Early tickets available now',
    },
    {
      eyebrow: 'Festival',
      headline: 'Three nights of live music',
      body: 'Two stages, twelve acts and food from six kitchens.',
      footer: 'Weekend passes on sale',
    },
    {
      eyebrow: 'Workshop',
      headline: 'Print your own poster',
      body: 'A hands-on session covering type, layout and two-colour printing.',
      footer: 'Materials included',
    },
  ];
  const event = subjectAt(events, variant);

  return {
    id: `event-${variant + 1}`,
    name: `Event ${variant + 1}`,
    category: 'event',
    presetId,
    description: 'A high-impact event announcement with date-led typography.',
    build: () => [
      ...compose({
        prefix: 'event',
        frame,
        palette,
        variant,
        eyebrow: event.eyebrow,
        headline: event.headline,
        body: event.body,
        footer: event.footer,
        headlineTop: 0.26,
        headlineScale: variant === 1 ? 88 : 122,
      }),
      shape({
        id: 'event-date-chip',
        shape: 'roundRect',
        x: frame.margin,
        y: frame.height - frame.margin * 3.1,
        width: frame.width * 0.32,
        height: frame.scale * 96,
        fill: palette.accent,
        cornerRadius: frame.scale * 14,
        name: 'Date chip',
      }),
    ],
  };
}

function buildBanner(variant: number): CreativeTemplate {
  const presetId = variant === 1 ? 'youtube-thumbnail' : 'banner-landscape';
  const frame = frameFor(presetId);
  const palette = paletteAt(variant + 7);
  const banners = [
    {
      eyebrow: 'New',
      headline: 'Everything you need to launch this month',
      body: 'Templates, checklists and a plan.',
      footer: 'Start free',
    },
    {
      eyebrow: 'Episode 12',
      headline: 'Why your pricing page is losing money',
      body: 'A teardown of five real pages.',
      footer: 'Watch now',
    },
    {
      eyebrow: 'Summer sale',
      headline: 'Up to forty percent off annual plans',
      body: 'Ends Sunday at midnight.',
      footer: 'Claim the offer',
    },
  ];
  const banner = subjectAt(banners, variant);
  const isThumbnail = variant === 1;

  return {
    id: `banner-${variant + 1}`,
    name: `Banner ${variant + 1}`,
    category: 'banner',
    presetId,
    description: isThumbnail
      ? 'A 16:9 video thumbnail built around one readable claim.'
      : 'A wide web banner with a compact message column.',
    build: () => {
      const nodes: CreativeNode[] = [
        ...ornament('banner', variant, frame, palette),
        text({
          id: 'banner-eyebrow',
          text: banner.eyebrow.toUpperCase(),
          x: frame.margin,
          y: frame.height * 0.2,
          width: frame.width * 0.5,
          size: frame.scale * 26,
          color: palette.accent,
          weight: 700,
          letterSpacing: frame.scale * 5,
          name: 'Eyebrow',
        }),
        text({
          id: 'banner-headline',
          text: banner.headline,
          x: frame.margin,
          y: frame.height * 0.32,
          width: isThumbnail ? frame.width * 0.62 : frame.width * 0.55,
          size: frame.scale * (isThumbnail ? 92 : 74),
          color: palette.ink,
          weight: 800,
          lineHeight: 1.08,
          letterSpacing: -frame.scale * 1.4,
          name: 'Headline',
        }),
        text({
          id: 'banner-body',
          text: banner.body,
          x: frame.margin,
          y: frame.height * 0.68,
          width: frame.width * 0.4,
          size: frame.scale * 30,
          color: palette.muted,
          name: 'Supporting copy',
        }),
        shape({
          id: 'banner-cta',
          shape: 'roundRect',
          x: frame.width - frame.margin - frame.width * 0.18,
          y: frame.height * 0.42,
          width: frame.width * 0.18,
          height: frame.scale * 74,
          fill: palette.accent,
          cornerRadius: frame.scale * 37,
          name: 'Call to action',
        }),
        text({
          id: 'banner-cta-label',
          text: banner.footer,
          x: frame.width - frame.margin - frame.width * 0.18,
          y: frame.height * 0.42 + frame.scale * 26,
          width: frame.width * 0.18,
          size: frame.scale * 26,
          color: '#FFFFFF',
          weight: 700,
          align: 'center',
          name: 'Call to action label',
        }),
      ];
      return nodes;
    },
  };
}

/**
 * Black Friday promotional templates.
 * Seasonal campaigns for the November sales period.
 */
function buildBlackFridayFlyer(): CreativeTemplate {
  const frame = frameFor('a4-portrait');
  const palette = paletteAt(9);
  return {
    id: 'bf-flyer-0',
    name: 'Black Friday flyer',
    category: 'flyer',
    presetId: 'a4-portrait',
    description: 'A4 Black Friday flyer with bold discount messaging.',
    build: () => [
      ...compose({
        prefix: 'bf-flyer',
        frame,
        palette,
        variant: 0,
        eyebrow: 'BLACK FRIDAY',
        headline: 'Everything must go',
        body: 'Up to 50% off everything in store and online. One day only — Friday 28 November.',
        footer: '14 Market Road  ·  9am – 9pm  ·  +234 800 000 0000',
        headlineTop: 0.24,
        headlineScale: 120,
      }),
    ],
  };
}

function buildBlackFridaySocial(): CreativeTemplate {
  const frame = frameFor('social-square');
  const palette = paletteAt(10);
  return {
    id: 'bf-social-0',
    name: 'Black Friday social post',
    category: 'social',
    presetId: 'social-square',
    description: 'Square Black Friday social post for Instagram and Facebook.',
    build: () => [
      ...compose({
        prefix: 'bf-social',
        frame,
        palette,
        variant: 0,
        eyebrow: 'BLACK FRIDAY',
        headline: '50% OFF EVERYTHING',
        body: 'One day only. Friday 28 November. Shop now before it is gone.',
        footer: 'Link in bio',
        headlineTop: 0.28,
        headlineScale: 100,
        align: 'center',
      }),
    ],
  };
}

/**
 * December holiday templates.
 * Seasonal campaigns for the December holidays.
 */
function buildDecemberPoster(): CreativeTemplate {
  const presetId = 'a4-landscape';
  const frame = frameFor(presetId);
  const palette = paletteAt(11);
  return {
    id: 'dec-poster-0',
    name: 'December holiday poster',
    category: 'poster',
    presetId,
    description: 'A4 landscape December holiday poster with festive messaging.',
    build: () => [
      ...compose({
        prefix: 'dec-poster',
        frame,
        palette,
        variant: 0,
        eyebrow: 'DECEMBER HOLIDAYS',
        headline: "Season's greetings",
        body: 'Thank you for shopping with us all year. Holiday hours from 20 December to 2 January.',
        footer: '14 Market Road  ·  +234 800 000 0000',
        headlineTop: 0.22,
        headlineScale: 90,
      }),
    ],
  };
}

function buildDecemberStory(): CreativeTemplate {
  const frame = frameFor('social-story');
  const palette = paletteAt(12);
  return {
    id: 'dec-story-0',
    name: 'December holiday story',
    category: 'story',
    presetId: 'social-story',
    description: 'Vertical December holiday story for WhatsApp and Instagram.',
    build: () => [
      ...compose({
        prefix: 'dec-story',
        frame,
        palette,
        variant: 0,
        eyebrow: 'DECEMBER',
        headline: 'Holiday hours',
        body: 'Open every day from 20 December to 2 January. See you soon!',
        footer: 'Tap for details',
        headlineTop: 0.3,
        headlineScale: 92,
      }),
    ],
  };
}

export const CREATIVE_TEMPLATES: readonly CreativeTemplate[] = [
  buildFlyer(0),
  buildFlyer(1),
  buildFlyer(2),
  buildPoster(0),
  buildPoster(1),
  buildPoster(2),
  buildSocial(0),
  buildSocial(1),
  buildSocial(2),
  buildStory(0),
  buildStory(1),
  buildStory(2),
  buildBusinessCard(0),
  buildBusinessCard(1),
  buildBusinessCard(2),
  buildInvitation(0),
  buildInvitation(1),
  buildInvitation(2),
  buildEvent(0),
  buildEvent(1),
  buildEvent(2),
  buildBanner(0),
  buildBanner(1),
  buildBanner(2),
  buildBlackFridayFlyer(),
  buildBlackFridaySocial(),
  buildDecemberPoster(),
  buildDecemberStory(),
];

export const CREATIVE_TEMPLATE_CATEGORIES: readonly CreativeTemplateCategory[] = [
  'flyer',
  'poster',
  'social',
  'story',
  'business-card',
  'invitation',
  'event',
  'banner',
];

export function getTemplate(id: string): CreativeTemplate | undefined {
  return CREATIVE_TEMPLATES.find((template) => template.id === id);
}

export function requireTemplate(id: string): CreativeTemplate {
  const template = getTemplate(id);
  if (!template) throw new RangeError(`Unknown creative template: ${id}`);
  return template;
}

export interface CreateDocumentFromTemplateOptions {
  readonly title?: string;
  readonly now?: Date;
}

/** Materialise a template as a fresh editable document. */
export function createDocumentFromTemplate(
  templateId: string,
  options: CreateDocumentFromTemplateOptions = {},
) {
  const template = requireTemplate(templateId);
  const preset = getPreset(template.presetId);
  if (!preset) throw new RangeError(`Template ${templateId} points at an unknown preset`);

  return createCreativeDocument({
    title: options.title ?? template.name,
    canvas: canvasFromPreset(preset),
    nodes: template.build(),
    now: options.now,
  });
}
