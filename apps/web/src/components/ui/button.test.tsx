import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders its label and responds to clicks', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Generate</Button>);

    const button = screen.getByRole('button', { name: 'Generate' });
    expect(button).toHaveAttribute('type', 'button');

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('blocks interaction and announces busy state while loading', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Generating
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Generating' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('can render as a child element without losing styling', () => {
    render(
      <Button asChild variant="outline">
        <a href="/tools">Open tools</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Open tools' });
    expect(link).toHaveAttribute('href', '/tools');
    expect(link.className).toContain('border-border-strong');
  });
});
