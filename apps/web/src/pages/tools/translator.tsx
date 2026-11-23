import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ArrowLeft, Languages, Mic, Pause, Play, RotateCcw, Square, Volume2 } from 'lucide-react';
import { AI_LANGUAGES } from '@quickbiz/shared';
import { Container } from '../../components/ui/container';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { env } from '../../lib/env';
import { useAuth } from '../../lib/auth/auth-context';
import { useVoiceInput } from '../../lib/voice/use-voice-input';
import {
  cancelSpeech,
  getSynthesisApi,
  listVoices,
  pauseSpeech,
  resumeSpeech,
  speak,
  type SpeechVoice,
} from '../../lib/voice/speech-tts';

type PlaybackState = 'idle' | 'speaking' | 'paused';

/**
 * Translator.
 *
 * Voice input and playback work today and are genuinely useful on their own. AI
 * translation does not: `AI_PROVIDER` has no registered adapter in this build, so
 * the translate action is disabled and says so. Presenting a working microphone
 * next to an honest "translation unavailable" message is the only truthful option
 * until Stage 6 M2/M3 are approved.
 */
export function TranslatorPage() {
  const { t } = useTranslation();
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>('idle');
  const [voiceURI, setVoiceURI] = useState<string>('');
  const [rate, setRate] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);

  const { gateway, session } = useAuth();

  const synthesis = useMemo(() => getSynthesisApi(), []);
  const voices = useMemo<readonly SpeechVoice[]>(
    () => (synthesis ? listVoices(synthesis) : []),
    [synthesis],
  );

  const voice = useVoiceInput({
    lang: targetLanguage,
    onTranscript: (value) => setText(value),
  });

  const languageLabel = (code: string) =>
    AI_LANGUAGES.find((language) => language.code === code)?.label ?? code;

  const play = async (fromStart: boolean) => {
    if (!synthesis) {
      setNotice(t('translator.ttsUnsupported'));
      return;
    }
    if (fromStart) cancelSpeech(synthesis);

    const outcome = await speak(
      { text, lang: targetLanguage, rate, ...(voiceURI ? { voiceURI } : {}) },
      synthesis,
    );

    if (!outcome.ok) {
      setNotice(
        outcome.reason === 'empty' ? t('translator.nothingToRead') : t('translator.ttsFailed'),
      );
      setPlayback('idle');
      return;
    }
    setPlayback('idle');
  };

  const stop = () => {
    cancelSpeech(synthesis);
    setPlayback('idle');
  };

  const translate = async () => {
    if (text.trim().length === 0) {
      setNotice(t('translator.nothingToRead'));
      return;
    }
    setNotice(null);
    setTranslated(null);
    setTranslating(true);
    try {
      const token = session ? await gateway.getAccessToken() : null;
      const response = await fetch(`${env.apiBaseUrl.replace(/\/$/, '')}/api/v1/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, source: 'auto', target: targetLanguage }),
      });

      if (response.status === 503) {
        setNotice(t('translator.translateUnavailable'));
        return;
      }
      if (response.status === 401) {
        setNotice(t('translator.translateSignIn'));
        return;
      }
      if (!response.ok) {
        setNotice(t('translator.translateFailed'));
        return;
      }
      const payload = (await response.json()) as { data?: { translatedText?: string } };
      const value = payload.data?.translatedText;
      if (value) setTranslated(value);
      else setNotice(t('translator.translateFailed'));
    } catch {
      setNotice(t('translator.translateFailed'));
    } finally {
      setTranslating(false);
    }
  };

  const speakTranslation = async () => {
    if (!translated || !synthesis) {
      if (!synthesis) setNotice(t('translator.ttsUnsupported'));
      return;
    }
    const outcome = await speak(
      { text: translated, lang: targetLanguage, rate, ...(voiceURI ? { voiceURI } : {}) },
      synthesis,
    );
    if (!outcome.ok) setNotice(t('translator.ttsFailed'));
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <Container className="py-8 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Link
              to="/tools"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              {t('tools.back')}
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              <Languages className="size-7 text-primary" aria-hidden="true" />
              {t('translator.title')}
            </h1>
            <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
              {t('translator.intro')}
            </p>
          </div>
        </div>

        <Card className="mt-6 border-warning/40 bg-warning-soft p-4 text-sm text-ink">
          <p className="font-medium">{t('translator.unavailableTitle')}</p>
          <p className="mt-1 text-ink-muted">{t('translator.unavailableBody')}</p>
        </Card>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">{t('translator.sourceText')}</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, 5_000))}
                rows={8}
                placeholder={t('translator.placeholder')}
                className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-base text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/35 sm:text-sm"
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant={voice.status === 'listening' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  if (voice.status === 'listening') {
                    voice.stop();
                    return;
                  }
                  if (!consent) {
                    setNotice(t('translator.consentRequired'));
                    return;
                  }
                  voice.start();
                }}
                aria-pressed={voice.status === 'listening'}
              >
                {voice.status === 'listening' ? (
                  <Square className="size-4" aria-hidden="true" />
                ) : (
                  <Mic className="size-4" aria-hidden="true" />
                )}
                {voice.status === 'listening' ? t('translator.stop') : t('translator.dictate')}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void play(true)}
                disabled={text.trim().length === 0}
              >
                <Play className="size-4" aria-hidden="true" />
                {t('translator.play')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  pauseSpeech(synthesis);
                  setPlayback((state) => (state === 'speaking' ? 'paused' : state));
                }}
                disabled={playback === 'idle'}
              >
                <Pause className="size-4" aria-hidden="true" />
                {t('translator.pause')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resumeSpeech(synthesis);
                  setPlayback('speaking');
                }}
                disabled={playback !== 'paused'}
              >
                <Volume2 className="size-4" aria-hidden="true" />
                {t('translator.resume')}
              </Button>
              <Button variant="ghost" size="sm" onClick={stop} disabled={playback === 'idle'}>
                <RotateCcw className="size-4" aria-hidden="true" />
                {t('translator.replay')}
              </Button>
            </div>

            {voice.errorMessage ? (
              <p role="alert" className="mt-3 text-sm font-medium text-danger">
                {voice.errorMessage}
              </p>
            ) : null}

            {!voice.supported ? (
              <p className="mt-3 text-xs text-ink-subtle">{t('translator.sttUnsupported')}</p>
            ) : (
              <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-0.5 size-4"
                />
                <span>{t('translator.consent')}</span>
              </label>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">{t('translator.targetLanguage')}</span>
              <select
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                className="h-10 w-full rounded-lg border border-border-strong bg-surface px-2 text-sm text-ink"
              >
                {AI_LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">{t('translator.voice')}</span>
              <select
                value={voiceURI}
                onChange={(event) => setVoiceURI(event.target.value)}
                className="h-10 w-full rounded-lg border border-border-strong bg-surface px-2 text-sm text-ink"
                disabled={voices.length === 0}
              >
                <option value="">{t('translator.voiceAutomatic')}</option>
                {voices.map((option) => (
                  <option key={option.voiceURI} value={option.voiceURI}>
                    {option.name} ({option.lang})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between gap-3 text-sm text-ink">
              <span>{t('translator.rate')}</span>
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.1}
                value={rate}
                onChange={(event) => setRate(Number(event.target.value))}
                className="w-40"
              />
              <span className="w-10 text-right text-xs text-ink-subtle">{rate.toFixed(1)}×</span>
            </label>

            <p className="text-xs leading-relaxed text-ink-subtle">
              {t('translator.voiceNote', { language: languageLabel(targetLanguage) })}
            </p>

            <Button
              className="w-full"
              onClick={() => void translate()}
              loading={translating}
              disabled={text.trim().length === 0}
            >
              {t('translator.translate')}
            </Button>
            <p className="text-xs text-ink-subtle">{t('translator.translateHint')}</p>

            {translated ? (
              <div className="rounded-lg border border-border bg-surface-muted p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  {t('translator.translationResult')}
                </p>
                <p
                  className="mt-1 whitespace-pre-wrap text-sm text-ink"
                  dir={targetLanguage === 'ar' ? 'rtl' : 'ltr'}
                >
                  {translated}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void speakTranslation()}
                >
                  <Volume2 className="size-4" aria-hidden="true" />
                  {t('translator.listen')}
                </Button>
              </div>
            ) : null}

            {notice ? (
              <p role="status" className="text-xs font-medium text-ink">
                {notice}
              </p>
            ) : null}
          </Card>
        </div>
      </Container>
    </div>
  );
}
