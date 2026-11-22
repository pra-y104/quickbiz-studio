import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelSpeech,
  getSynthesisApi,
  listVoices,
  pauseSpeech,
  resumeSpeech,
  speak,
  type PlatformVoice,
} from '../speech-tts';
import {
  getRecognitionConstructor,
  isSpeechInputSupported,
  startRecognition,
  SpeechInputError,
} from '../speech-stt';

/** jsdom has no speech API, so the test installs a minimal one. */
class FakeUtterance {
  text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  voice: unknown = null;
  onend: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

function installUtterance() {
  (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = FakeUtterance;
}

function voice(overrides: Partial<PlatformVoice> = {}): PlatformVoice {
  return { voiceURI: 'v1', name: 'Test Voice', lang: 'en', default: true, ...overrides };
}

/** Mutable so tests can drive engine state. */
function synthesisApi() {
  const api = {
    getVoices: () => [voice()],
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    speaking: false,
    pending: false,
    paused: false,
  };
  return api;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('speech synthesis', () => {
  it('reports no API when the browser has none', async () => {
    installUtterance();
    expect(getSynthesisApi({})).toBeNull();
    await expect(speak({ text: 'hello' }, null)).resolves.toEqual({
      ok: false,
      reason: 'unsupported',
    });
  });

  it('refuses empty text', async () => {
    installUtterance();
    const api = synthesisApi();
    await expect(speak({ text: '   ' }, api)).resolves.toEqual({ ok: false, reason: 'empty' });
    expect(api.speak).not.toHaveBeenCalled();
  });

  it('speaks and resolves when the utterance ends', async () => {
    installUtterance();
    const api = synthesisApi();
    const pending = speak({ text: 'hello', lang: 'en', rate: 1.2, voiceURI: 'v1' }, api);

    const utterance = vi.mocked(api.speak).mock.calls[0]?.[0] as SpeechSynthesisUtterance;
    expect(utterance.text).toBe('hello');
    expect(utterance.lang).toBe('en');
    expect(utterance.rate).toBe(1.2);

    utterance.onend?.(new Event('end') as never);
    await expect(pending).resolves.toEqual({ ok: true });
  });

  it('reports a failed utterance', async () => {
    installUtterance();
    const api = synthesisApi();
    const pending = speak({ text: 'hello' }, api);
    const utterance = vi.mocked(api.speak).mock.calls[0]?.[0] as SpeechSynthesisUtterance;
    utterance.onerror?.(new Event('error') as never);
    await expect(pending).resolves.toEqual({ ok: false, reason: 'failed' });
  });

  it('clamps the speaking rate into a safe range', async () => {
    installUtterance();
    const api = synthesisApi();
    void speak({ text: 'hello', rate: 99 }, api);
    const utterance = vi.mocked(api.speak).mock.calls[0]?.[0] as SpeechSynthesisUtterance;
    expect(utterance.rate).toBe(2);
  });

  it('pause and resume are guarded', () => {
    const api = synthesisApi();
    pauseSpeech(api);
    expect(api.pause).not.toHaveBeenCalled();

    api.speaking = true;
    pauseSpeech(api);
    expect(api.pause).toHaveBeenCalledTimes(1);

    api.paused = true;
    resumeSpeech(api);
    expect(api.resume).toHaveBeenCalledTimes(1);
  });

  it('cancel is always safe', () => {
    const api = synthesisApi();
    expect(() => {
      cancelSpeech(api);
      cancelSpeech(null);
    }).not.toThrow();
  });

  it('lists voices sorted by name', () => {
    const api = synthesisApi();
    api.getVoices = () => [voice({ name: 'Zulu' }), voice({ name: 'Alpha' })];
    expect(listVoices(api).map((entry) => entry.name)).toEqual(['Alpha', 'Zulu']);
  });
});

describe('speech recognition', () => {
  class FakeRecognition {
    static last: FakeRecognition | null = null;
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onresult: ((event: unknown) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    onstart: (() => void) | null = null;
    started = false;

    constructor() {
      FakeRecognition.last = this;
    }

    start() {
      this.started = true;
    }
    stop() {}
    abort() {}
  }

  it('reports unsupported when no constructor exists', () => {
    expect(isSpeechInputSupported({})).toBe(false);
    expect(getRecognitionConstructor({})).toBeNull();
    expect(
      startRecognition({
        lang: 'en',
        Constructor: undefined,
        onTranscript: () => {},
        onError: () => {},
        onEnd: () => {},
      }),
    ).toBeNull();
  });

  it('starts with the requested language and interim results', () => {
    const onTranscript = vi.fn();
    const session = startRecognition({
      lang: 'yo',
      Constructor: FakeRecognition as never,
      onTranscript,
      onError: () => {},
      onEnd: () => {},
    });

    expect(session).not.toBeNull();
    const recognition = FakeRecognition.last!;
    expect(recognition.lang).toBe('yo');
    expect(recognition.interimResults).toBe(true);
    expect(recognition.started).toBe(true);
  });

  it('forwards transcripts', () => {
    const onTranscript = vi.fn();
    startRecognition({
      lang: 'en',
      Constructor: FakeRecognition as never,
      onTranscript,
      onError: () => {},
      onEnd: () => {},
    });

    FakeRecognition.last!.onresult?.({
      resultIndex: 0,
      results: { length: 1, 0: { isFinal: true, length: 1, 0: { transcript: 'hello' } } },
    });

    expect(onTranscript).toHaveBeenCalledWith('hello', true);
  });

  it('maps permission errors', () => {
    const onError = vi.fn();
    startRecognition({
      lang: 'en',
      Constructor: FakeRecognition as never,
      onTranscript: () => {},
      onError,
      onEnd: () => {},
    });

    FakeRecognition.last!.onerror?.({ error: 'not-allowed' });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(SpeechInputError);
    expect((onError.mock.calls[0]?.[0] as SpeechInputError).code).toBe('denied');
  });

  it('does not treat an aborted session as a user-visible error', () => {
    const onError = vi.fn();
    startRecognition({
      lang: 'en',
      Constructor: FakeRecognition as never,
      onTranscript: () => {},
      onError,
      onEnd: () => {},
    });

    FakeRecognition.last!.onerror?.({ error: 'aborted' });
    expect((onError.mock.calls[0]?.[0] as SpeechInputError).code).toBe('busy');
  });
});
