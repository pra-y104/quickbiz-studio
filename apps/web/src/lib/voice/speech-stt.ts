/**
 * Speech-to-text.
 *
 * Wraps the browser's speech recognition API. Two facts drive the design:
 *
 * 1. Support is uneven — Chrome on Android and desktop generally works, Firefox
 *    does not, iOS support is partial. Absence is reported, never faked.
 * 2. In Chrome the audio is processed by the browser vendor's service, not by
 *    QuickBiz. The interface must say so before recording starts, because that is
 *    a real privacy consequence of using the feature.
 *
 * This module never records or stores audio itself; it only receives text.
 */

export interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type SpeechErrorCode =
  | 'unsupported'
  | 'denied'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'language'
  | 'busy'
  | 'unknown';

export class SpeechInputError extends Error {
  readonly code: SpeechErrorCode;

  constructor(code: SpeechErrorCode, message: string) {
    super(message);
    this.name = 'SpeechInputError';
    this.code = code;
  }
}

/** Look for the standard or the vendor-prefixed constructor. */
export function getRecognitionConstructor(
  scope: unknown = globalThis,
): SpeechRecognitionConstructor | null {
  const candidate = scope as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export function isSpeechInputSupported(scope: unknown = globalThis): boolean {
  return getRecognitionConstructor(scope) !== null;
}

function mapError(code: string): SpeechErrorCode {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied';
    case 'no-speech':
      return 'no-speech';
    case 'audio-capture':
      return 'audio-capture';
    case 'network':
      return 'network';
    case 'language-not-supported':
      return 'language';
    case 'aborted':
      return 'busy';
    default:
      return 'unknown';
  }
}

export interface RecognitionSession {
  readonly stop: () => void;
  readonly abort: () => void;
}

export interface StartRecognitionOptions {
  readonly lang: string;
  /** Called with the committed text so far. */
  readonly onTranscript: (text: string, isFinal: boolean) => void;
  readonly onError: (error: SpeechInputError) => void;
  readonly onEnd: () => void;
  readonly Constructor?: SpeechRecognitionConstructor;
}

/**
 * Start one recognition session.
 *
 * Returns `null` when the browser has no speech recognition, so the caller can
 * show a fallback instead of a dead microphone button.
 */
export function startRecognition(options: StartRecognitionOptions): RecognitionSession | null {
  const Constructor = options.Constructor ?? getRecognitionConstructor();
  if (!Constructor) return null;

  const recognition = new Constructor();
  recognition.lang = options.lang;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let text = '';
    let isFinal = false;

    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (!result) continue;
      text += result[0]?.transcript ?? '';
      if (result.isFinal) isFinal = true;
    }

    options.onTranscript(text.trim(), isFinal);
  };

  recognition.onerror = (event) => {
    options.onError(new SpeechInputError(mapError(event.error), event.error));
  };

  recognition.onend = () => options.onEnd();

  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }
    },
    abort: () => {
      try {
        recognition.abort();
      } catch {
        // Already aborted.
      }
    },
  };
}
