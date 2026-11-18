import { analyseText, formatMinutes } from '@quickbiz/shared';
import { Eraser } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CopyButton } from '../../components/tools/copy-button';
import { StatGrid, StatTile } from '../../components/tools/stat-tile';
import { ToolPage } from '../../components/tools/tool-page';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';

const PLACEHOLDER =
  'Paste or type your text here. Everything stays on this device, so it is safe for drafts, cover letters and client copy.';

export function WordCounterPage() {
  const [text, setText] = useState('');

  const stats = useMemo(() => analyseText(text), [text]);
  const hasText = text.trim().length > 0;

  const summary = useMemo(
    () =>
      [
        `Words: ${stats.words}`,
        `Characters: ${stats.characters}`,
        `Characters without spaces: ${stats.charactersNoSpaces}`,
        `Sentences: ${stats.sentences}`,
        `Paragraphs: ${stats.paragraphs}`,
        `Lines: ${stats.lines}`,
        `Unique words: ${stats.uniqueWords}`,
        `Reading time: ${formatMinutes(stats.readingMinutes)}`,
        `Speaking time: ${formatMinutes(stats.speakingMinutes)}`,
      ].join('\n'),
    [stats],
  );

  return (
    <ToolPage slug="word-counter">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle>Your text</CardTitle>
              <CardDescription>
                Counts update as you type. Reading time assumes 200 words a minute, speaking 130.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setText('')}
              disabled={!hasText}
            >
              <Eraser className="size-3.5" aria-hidden="true" />
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Label htmlFor="word-counter-text" className="sr-only">
            Text to analyse
          </Label>
          <Textarea
            id="word-counter-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={14}
            placeholder={PLACEHOLDER}
            className="min-h-[18rem] font-normal"
            spellCheck
          />
          <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-subtle">
            <span>
              {hasText ? `${stats.characters} characters in the editor.` : 'No text yet.'}
            </span>
            <CopyButton value={summary} label="Copy summary" disabled={!hasText} />
          </p>
        </CardContent>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Counts</CardTitle>
            <CardDescription>
              {hasText ? 'Live totals for the text in the editor.' : 'Add text to see totals.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatGrid className="sm:grid-cols-2">
              <StatTile label="Words" value={stats.words} emphasis />
              <StatTile label="Characters" value={stats.characters} emphasis />
              <StatTile label="No spaces" value={stats.charactersNoSpaces} />
              <StatTile label="Sentences" value={stats.sentences} />
              <StatTile label="Paragraphs" value={stats.paragraphs} />
              <StatTile label="Lines" value={stats.lines} />
              <StatTile label="Unique words" value={stats.uniqueWords} />
              <StatTile label="Average word" value={stats.averageWordLength} hint="letters" />
            </StatGrid>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Time to read and speak</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-muted">Reading</span>
              <span className="font-mono text-sm font-medium tabular-nums text-ink">
                {formatMinutes(stats.readingMinutes)}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink-muted">Speaking aloud</span>
              <span className="font-mono text-sm font-medium tabular-nums text-ink">
                {formatMinutes(stats.speakingMinutes)}
              </span>
            </div>
            {stats.longestWord ? (
              <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
                <span className="text-sm text-ink-muted">Longest word</span>
                <span className="truncate text-sm font-medium text-ink">{stats.longestWord}</span>
              </div>
            ) : null}
            <p className="pt-1 text-xs leading-relaxed text-ink-subtle">
              Estimates, not promises: dense technical text reads more slowly, and punctuation such
              as “e.g.” can split a sentence in two.
            </p>
          </CardContent>
        </Card>
      </aside>
    </ToolPage>
  );
}
