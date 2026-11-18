import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { listToolsByKind } from '@quickbiz/shared';
import { router } from '../../app/router';
import { TextFormatterPage } from './text-formatter';
import { ToolsPage } from './index';
import { WordCounterPage } from './word-counter';

function renderPage(page: ReactNode) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

function statsTile(label: string): HTMLElement {
  const tile = screen.getByText(label).parentElement;
  if (!tile) throw new Error(`Tile ${label} is missing`);
  return tile;
}

describe('ToolsPage', () => {
  it('lists every live tool and counts them', () => {
    renderPage(<ToolsPage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Eight tools that already work.',
    );
    expect(screen.getByText('8 of 8 tools')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Invoice Maker' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Word Counter' })).toBeInTheDocument();
  });

  it('links a live tool to its route', () => {
    renderPage(<ToolsPage />);

    const calculator = screen
      .getAllByRole('link')
      .find((link) => link.getAttribute('href') === '/tools/calculator');

    expect(calculator).toBeDefined();
  });

  it('filters by search text', async () => {
    const user = userEvent.setup();
    renderPage(<ToolsPage />);

    await user.type(screen.getByLabelText('Find a tool'), 'invoice');

    expect(screen.getByText('1 of 8 tools')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Invoice Maker' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 3, name: 'Unit Converter' }),
    ).not.toBeInTheDocument();
  });

  it('filters by category and clears the filters', async () => {
    const user = userEvent.setup();
    renderPage(<ToolsPage />);

    await user.click(screen.getByRole('button', { name: 'Calculators' }));
    expect(screen.getByText('4 of 8 tools')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('8 of 8 tools')).toBeInTheDocument();
  });

  it('explains an empty search result', async () => {
    const user = userEvent.setup();
    renderPage(<ToolsPage />);

    await user.type(screen.getByLabelText('Find a tool'), 'spaceship');

    expect(screen.getByText('No tool matches that search')).toBeInTheDocument();
  });

  it('registers a route for every live tool in the catalogue', () => {
    const paths = new Set(router.routes.map((route) => route.path));
    expect(paths.has('/tools')).toBe(true);

    for (const tool of listToolsByKind('utility')) {
      if (tool.status !== 'live') continue;
      expect(paths.has(`/tools/${tool.slug}`)).toBe(true);
    }
  });
});

describe('WordCounterPage', () => {
  it('counts words, characters and sentences as the user types', async () => {
    const user = userEvent.setup();
    renderPage(<WordCounterPage />);

    await user.type(screen.getByLabelText('Text to analyse'), 'Hello world. Hello again.');

    expect(within(statsTile('Words')).getByText('4')).toBeInTheDocument();
    expect(within(statsTile('Sentences')).getByText('2')).toBeInTheDocument();
    expect(within(statsTile('Unique words')).getByText('3')).toBeInTheDocument();
    expect(within(statsTile('Characters')).getByText('25')).toBeInTheDocument();
  });

  it('reports zero for an empty editor and clears back to that state', async () => {
    const user = userEvent.setup();
    renderPage(<WordCounterPage />);

    expect(within(statsTile('Words')).getByText('0')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Text to analyse'), 'one two');
    expect(within(statsTile('Words')).getByText('2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(within(statsTile('Words')).getByText('0')).toBeInTheDocument();
  });

  it('estimates reading and speaking time', async () => {
    const user = userEvent.setup();
    renderPage(<WordCounterPage />);

    await user.type(screen.getByLabelText('Text to analyse'), 'one two three four');
    expect(screen.getByText('Reading').parentElement).toHaveTextContent('1 sec');

    // Speaking 4 words at 130 words a minute rounds to 2 seconds.
    expect(screen.getByText('Speaking aloud').parentElement).toHaveTextContent('2 sec');
  });
});

describe('TextFormatterPage', () => {
  it('applies a case conversion to the preview', async () => {
    const user = userEvent.setup();
    renderPage(<TextFormatterPage />);

    await user.type(screen.getByLabelText('Text to format'), 'hello world');
    await user.click(screen.getByLabelText('UPPERCASE'));

    expect(screen.getByLabelText('Formatted text')).toHaveValue('HELLO WORLD');
  });

  it('stacks transformations in catalogue order', async () => {
    const user = userEvent.setup();
    renderPage(<TextFormatterPage />);

    const input = screen.getByLabelText('Text to format');
    fireEvent.change(input, { target: { value: '  b  \n  a  ' } });

    await user.click(screen.getByLabelText('Sort A-Z'));
    await user.click(screen.getByLabelText('Trim each line'));

    expect(screen.getByLabelText('Formatted text')).toHaveValue('a\nb');
  });

  it('does not offer a copy of unchanged text', async () => {
    const user = userEvent.setup();
    renderPage(<TextFormatterPage />);

    await user.type(screen.getByLabelText('Text to format'), 'already fine');
    expect(screen.getByRole('button', { name: 'Copy result' })).toBeDisabled();

    await user.click(screen.getByLabelText('UPPERCASE'));
    expect(screen.getByRole('button', { name: 'Copy result' })).toBeEnabled();
  });

  it('clears the text and the selection together', async () => {
    const user = userEvent.setup();
    renderPage(<TextFormatterPage />);

    await user.type(screen.getByLabelText('Text to format'), 'text');
    await user.click(screen.getByLabelText('UPPERCASE'));
    await user.click(screen.getByRole('button', { name: 'Clear everything' }));

    expect(screen.getByLabelText('Text to format')).toHaveValue('');
    expect(screen.getByLabelText('UPPERCASE')).not.toBeChecked();
  });

  it('strips HTML from pasted markup', async () => {
    const user = userEvent.setup();
    renderPage(<TextFormatterPage />);

    fireEvent.change(screen.getByLabelText('Text to format'), {
      target: { value: '<p>Hello <strong>there</strong></p>' },
    });
    await user.click(screen.getByLabelText('Strip HTML'));

    expect(screen.getByLabelText('Formatted text')).toHaveValue('Hello there');
  });
});
