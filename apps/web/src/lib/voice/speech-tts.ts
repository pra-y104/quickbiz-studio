/**
 * Text-to-speech.
 *
 * Wraps the browser's `speechSynthesis` so the interface never touches the raw API
 * and every failure becomes a short, safe message. Speech is generated on the
 * device by the operating system's voices; nothing is uploaded by this code.
 *
 * Support varies: some Android builds expose no voices, and some desktop browsers
 * require a user gesture before speaking. Every gap is reported rather than faked.
 */

export interface SpeechVoice {
  readonly voiceURI: string;
  readonly name: string;
  readonly lang: string;
  readonly default: boolean;
}

/** Voice descriptor as exposed by the platform. */
export interface PlatformVoice {
  readonly voiceURI: string;
  readonly name: string;
  readonly lang: string;
  readonly default: boolean;
  readonly localService?: boolean;
}

export interface SpeechSynthesisApi {
  readonly getVoices: () => readonly PlatformVoice[];
  readonly speak: (utterance: SpeechSynthesisUtterance) => void;
  readonly cancel: () => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly speaking: boolean;
  readonly pending: boolean;
  readonly paused: boolean;
}

export function getSynthesisApi(scope: unknown = globalThis): SpeechSynthesisApi | null {
  const candidate = (scope as { speechSynthesis?: SpeechSynthesisApi }).speechSynthesis;
  if (!candidate || typeof candidate.speak !== 'function') return null;
  return candidate;
}

export function listVoices(api: SpeechSynthesisApi): readonly SpeechVoice[] {
  return api
    .getVoices()
    .map((voice) => ({
      voiceURI: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
      default: voice.default,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface SpeakOptions {
  readonly text: string;
  readonly lang?: string;
  readonly rate?: number;
  readonly pitch?: number;
  readonly voiceURI?: string;
}

type UtteranceConstructor = new (text: string) => SpeechSynthesisUtterance;

/** The constructor is looked up defensively: some embedded webviews omit it. */
function getUtteranceConstructor(): UtteranceConstructor | null {
  const candidate = (globalThis as { SpeechSynthesisUtterance?: UtteranceConstructor })
    .SpeechSynthesisUtterance;
  return typeof candidate === 'function' ? candidate : null;
}

export type SpeakOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'unsupported' | 'empty' | 'failed' };

/**
 * Speak text once.
 *
 * Resolves when the utterance ends or fails. An empty string is refused, and a
 * missing API is reported as `unsupported` rather than silently doing nothing.
 */
export function speak(
  options: SpeakOptions,
  api: SpeechSynthesisApi | null,
): Promise<SpeakOutcome> {
  if (!api) return Promise.resolve({ ok: false, reason: 'unsupported' });

  const text = options.text.trim();
  if (text.length === 0) return Promise.resolve({ ok: false, reason: 'empty' });

  const Utterance = getUtteranceConstructor();
  if (!Utterance) return Promise.resolve({ ok: false, reason: 'unsupported' });

  return new Promise((resolve) => {
    const utterance = new Utterance(text);
    if (options.lang) utterance.lang = options.lang;
    if (options.rate !== undefined) utterance.rate = Math.min(Math.max(options.rate, 0.5), 2);
    if (options.pitch !== undefined) utterance.pitch = Math.min(Math.max(options.pitch, 0), 2);

    if (options.voiceURI) {
      const voice = api.getVoices().find((candidate) => candidate.voiceURI === options.voiceURI);
      // The platform voice object is accepted structurally.
      if (voice) utterance.voice = voice as unknown as SpeechSynthesisVoice;
    }

    const finish = (outcome: SpeakOutcome) => {
      utterance.onend = null;
      utterance.onerror = null;
      resolve(outcome);
    };

    utterance.onend = () => finish({ ok: true });
    utterance.onerror = () => finish({ ok: false, reason: 'failed' });

    try {
      api.speak(utterance);
    } catch {
      finish({ ok: false, reason: 'failed' });
    }
  });
}

export function cancelSpeech(api: SpeechSynthesisApi | null): void {
  if (!api) return;
  try {
    api.cancel();
  } catch {
    // Cancelling when nothing is queued is harmless; ignore.
  }
}

export function pauseSpeech(api: SpeechSynthesisApi | null): void {
  if (!api) return;
  try {
    if (api.speaking && !api.paused) api.pause();
  } catch {
    // Ignore: some engines expose pause without support.
  }
}

export function resumeSpeech(api: SpeechSynthesisApi | null): void {
  if (!api) return;
  try {
    if (api.paused) api.resume();
  } catch {
    // Ignore.
  }
}
