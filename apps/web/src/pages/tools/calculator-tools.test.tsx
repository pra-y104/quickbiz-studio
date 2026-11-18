import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CalculatorPage } from './calculator';
import { DateCalculatorPage } from './date-calculator';
import { PercentageCalculatorPage } from './percentage-calculator';
import { UnitConverterPage } from './unit-converter';

function renderPage(page: ReactNode) {
  return render(<MemoryRouter>{page}</MemoryRouter>);
}

function resultPanel(): HTMLElement {
  const section = screen.getByText('Result').closest('section');
  if (!section) throw new Error('Result panel is missing');
  return section as HTMLElement;
}

describe('CalculatorPage', () => {
  it('evaluates a typed expression with correct precedence', async () => {
    const user = userEvent.setup();
    renderPage(<CalculatorPage />);

    const input = screen.getByLabelText('Calculation');
    await user.type(input, '2+3*4');

    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('works from the keypad and records a result', async () => {
    const user = userEvent.setup();
    renderPage(<CalculatorPage />);

    await user.click(screen.getByRole('button', { name: 'Insert 7' }));
    await user.click(screen.getByRole('button', { name: 'Insert +' }));
    await user.click(screen.getByRole('button', { name: 'Insert 3' }));
    await user.click(screen.getByRole('button', { name: 'Equals' }));

    expect(screen.getByLabelText('Calculation')).toHaveValue('10');
    expect(screen.getByText('Recent results')).toBeInTheDocument();
  });

  it('explains division by zero instead of showing Infinity', async () => {
    const user = userEvent.setup();
    renderPage(<CalculatorPage />);

    await user.type(screen.getByLabelText('Calculation'), '5/0');
    await user.click(screen.getByRole('button', { name: 'Equals' }));

    expect(screen.getByText('Division by zero is not defined.')).toBeInTheDocument();
  });

  it('clears the display with the C key', async () => {
    const user = userEvent.setup();
    renderPage(<CalculatorPage />);

    const input = screen.getByLabelText('Calculation');
    await user.type(input, '123');
    await user.click(screen.getByRole('button', { name: 'Insert C' }));

    expect(input).toHaveValue('');
  });
});

describe('PercentageCalculatorPage', () => {
  it('calculates a share of a value', () => {
    renderPage(<PercentageCalculatorPage />);
    expect(within(resultPanel()).getByText('30')).toBeInTheDocument();
    expect(screen.getByText('15% of 200 is 30.')).toBeInTheDocument();
  });

  it('switches to "one value as a percentage"', async () => {
    const user = userEvent.setup();
    renderPage(<PercentageCalculatorPage />);

    await user.click(screen.getByLabelText('One value as a %'));

    expect(screen.getByLabelText('Part')).toHaveValue('15');
    expect(screen.getByLabelText('Whole')).toHaveValue('200');
    expect(within(resultPanel()).getByText('7.5%')).toBeInTheDocument();
  });

  it('reports an increase and its direction', async () => {
    const user = userEvent.setup();
    renderPage(<PercentageCalculatorPage />);

    await user.click(screen.getByLabelText('Increase or decrease'));
    fireEvent.change(screen.getByLabelText('Starting value'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('New value'), { target: { value: '250' } });

    expect(within(resultPanel()).getByText('25%')).toBeInTheDocument();
    expect(screen.getByText(/Increase of 50, from 200 to 250\./)).toBeInTheDocument();
  });

  it('explains a zero base instead of dividing by zero', async () => {
    const user = userEvent.setup();
    renderPage(<PercentageCalculatorPage />);

    await user.click(screen.getByLabelText('Increase or decrease'));
    fireEvent.change(screen.getByLabelText('Starting value'), { target: { value: '0' } });

    expect(screen.getByText('Not defined')).toBeInTheDocument();
  });
});

describe('UnitConverterPage', () => {
  it('converts metres to feet', () => {
    renderPage(<UnitConverterPage />);
    expect(screen.getByText('3.280839895 ft')).toBeInTheDocument();
  });

  it('swaps the units in both directions', async () => {
    const user = userEvent.setup();
    renderPage(<UnitConverterPage />);

    await user.click(screen.getByRole('button', { name: 'Swap the two units' }));

    expect(screen.getByText('0.3048 m')).toBeInTheDocument();
  });

  it('converts temperature affinely', async () => {
    const user = userEvent.setup();
    renderPage(<UnitConverterPage />);

    await user.click(screen.getByLabelText('Temperature'));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '100' } });

    expect(screen.getByText('212 °F')).toBeInTheDocument();
  });

  it('rejects a temperature below absolute zero', async () => {
    const user = userEvent.setup();
    renderPage(<UnitConverterPage />);

    await user.click(screen.getByLabelText('Temperature'));
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '-500' } });

    expect(screen.getByText('Below absolute zero')).toBeInTheDocument();
  });

  it('reports an invalid amount without throwing', () => {
    renderPage(<UnitConverterPage />);
    const amount = screen.getByLabelText('Amount');
    fireEvent.change(amount, { target: { value: 'abc' } });

    expect(screen.getByText('Enter a number, for example 12.5.')).toBeInTheDocument();
    expect(amount).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('DateCalculatorPage', () => {
  it('counts the days between two dates', () => {
    renderPage(<DateCalculatorPage />);

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-03-01' } });

    expect(screen.getByText('59 days')).toBeInTheDocument();
    expect(screen.getByText(/2 months between/)).toBeInTheDocument();
  });

  it('adds calendar time to a date', async () => {
    const user = userEvent.setup();
    renderPage(<DateCalculatorPage />);

    await user.click(screen.getByLabelText('Add time'));
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-18' } });
    fireEvent.change(screen.getByLabelText('Years'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Months'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Days'), { target: { value: '3' } });

    expect(screen.getByText('2028-01-21')).toBeInTheDocument();
  });

  it('subtracts time with the quick buttons', async () => {
    const user = userEvent.setup();
    renderPage(<DateCalculatorPage />);

    await user.click(screen.getByLabelText('Subtract time'));
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-12-01' } });
    await user.click(screen.getByRole('button', { name: '30 days' }));

    expect(screen.getByText('2026-11-01')).toBeInTheDocument();
  });

  it('rejects an impossible date', () => {
    renderPage(<DateCalculatorPage />);
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '' } });

    expect(screen.getByText('Choose a valid start date.')).toBeInTheDocument();
  });

  it('shows weekday counts for a working week', () => {
    renderPage(<DateCalculatorPage />);

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-16' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-20' } });

    const tile = screen.getByText('Weekdays').parentElement;
    expect(tile).not.toBeNull();
    expect(within(tile as HTMLElement).getByText('4')).toBeInTheDocument();
  });
});
