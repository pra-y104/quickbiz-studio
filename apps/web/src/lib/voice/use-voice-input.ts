import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getRecognitionConstructor,
  isSpeechInputSupported,
  startRecognition,
  type RecognitionSession,
  type SpeechInputError,
} from './speech-stt';

export type VoiceInputStatus = 'idle' | 'listening' | 'unsupported' | 'denied' | 'error';

export interface VoiceInputState {
  readonly supported: boolean;
  readonly status: VoiceInputStatus;
  readonly transcript: string;
  readonly errorMessage: string | null;
  readonly start: () => void;
  readonly stop: () => void;
  readonly reset: () => void;
  readonly setTranscript: (value: string) => void;
}

const MESSAGES: Readonly<Record<string, string>> = {
  denied: 'Microphone access was denied. Allow it in your browser settings and try again.',
  'no-speech': 'No speech was detected. Try again and speak clearly.',
  'audio-capture': 'No microphone was found on this device.',
  network: 'The browser’s speech service could not be reached.',
  language: 'This browser does not support speech recognition in that language.',
  busy: 'Speech recognition was interrupted.',
  unknown: 'Speech recognition failed.',
};

function messageFor(error: SpeechInputError): string {
  return MESSAGES[error.code] ?? MESSAGES.unknown!;
}

/**
 * Microphone input with an editable transcript.
 *
 * The hook owns no audio: the browser converts speech to text and this hook only
 * accumulates that text. Callers must obtain explicit consent before `start()`,
 * because Chrome may send audio to the browser vendor for processing.
 */
export function useVoiceInput(options: {
  readonly lang: string;
  readonly onTranscript?: (text: string) => void;
  readonly scope?: unknown;
}): VoiceInputState {
  const { lang, onTranscript, scope } = options;
  const supported = isSpeechInputSupported(scope);
  const [status, setStatus] = useState<VoiceInputStatus>(supported ? 'idle' : 'unsupported');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sessionRef = useRef<RecognitionSession | null>(null);
  const transcriptRef = useRef('');

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current?.abort();
      sessionRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setStatus('unsupported');
      setErrorMessage(
        'Speech recognition is not available in this browser. You can type your text instead.',
      );
      return;
    }

    setErrorMessage(null);
    setStatus('listening');
    transcriptRef.current = '';

    const session = startRecognition({
      lang,
      Constructor: getRecognitionConstructor(scope) ?? undefined,
      onTranscript: (text) => {
        transcriptRef.current = text;
        setTranscript(text);
        onTranscript?.(text);
      },
      onError: (error) => {
        if (error.code === 'busy') return;
        setStatus(error.code === 'denied' ? 'denied' : 'error');
        setErrorMessage(messageFor(error));
      },
      onEnd: () => {
        setStatus((current) => (current === 'listening' ? 'idle' : current));
      },
    });

    if (!session) {
      setStatus('unsupported');
      setErrorMessage('Speech recognition could not start in this browser.');
      return;
    }

    sessionRef.current = session;
  }, [lang, onTranscript, scope, supported]);

  const reset = useCallback(() => {
    transcriptRef.current = '';
    setTranscript('');
    setErrorMessage(null);
    setStatus(supported ? 'idle' : 'unsupported');
  }, [supported]);

  return {
    supported,
    status,
    transcript,
    errorMessage,
    start,
    stop,
    reset,
    setTranscript: (value: string) => {
      transcriptRef.current = value;
      setTranscript(value);
    },
  };
}
