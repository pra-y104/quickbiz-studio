import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentMaker } from './document-maker';

let clickSpy: ReturnType<typeof vi.spyOn>;

function fillRequiredFields(): void {
  fireEvent.change(screen.getByLabelText(/Your business/), { target: { value: 'Acme Studio' } });
  fireEvent.change(screen.getByLabelText(/Bill to/), { target: { value: 'Ada Obi' } });
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Brand identity design' },
  });
  fireEvent.change(screen.getByLabelText('Unit price (NGN)'), { target: { value: '1000' } });
}

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:invoice'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DocumentMaker (invoice)', () => {
  it('shows the document identity fields', () => {
    render(
      <MemoryRouter>
        <DocumentMaker kind="invoice" />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Invoice number')).toHaveValue('INV-0001');
    expect(screen.getByLabelText('Payment due')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Invoice Maker');
  });

  it('recalculates totals as the line and adjustments change', () => {
    render(
      <MemoryRouter>
        <DocumentMaker kind="invoice" />
      </MemoryRouter>,
    );

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Discount'), { target: { value: 'percent' } });
    fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Tax (%)'), { target: { value: '7.5' } });
    fireEvent.change(screen.getByLabelText('Shipping (NGN)'), { target: { value: '100' } });

    // 1,000 - 10% = 900; +7.5% tax = 967.50; +100 shipping = 1,067.50
    expect(screen.getAllByText(/1,067\.50/).length).toBeGreaterThan(0);
  });

  it('adds and removes line items', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentMaker kind="invoice" />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Description')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add line' }));
    expect(screen.getAllByLabelText('Description')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Remove line 2' }));
    expect(screen.getAllByLabelText('Description')).toHaveLength(1);
  });

  it('blocks the download until the required fields are complete', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentMaker kind="invoice" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(screen.getByText('Finish the highlighted fields')).toBeInTheDocument();
    expect(
      screen.getAllByText('Add the name of the business sending this document.').length,
    ).toBeGreaterThan(0);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('generates and downloads a PDF when the document is valid', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentMaker kind="invoice" />
      </MemoryRouter>,
    );

    fillRequiredFields();
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(screen.getByText('PDF ready')).toBeInTheDocument();
    expect(screen.getByText(/invoice-INV-0001\.pdf/)).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const blob = (URL.createObjectURL as unknown as { mock: { calls: [Blob][] } }).mock
      .calls[0]?.[0];
    expect(blob?.type).toBe('application/pdf');
    expect(blob?.size).toBeGreaterThan(500);
  });

  it('flags a due date that precedes the issue date', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DocumentMaker kind="invoice" />
      </MemoryRouter>,
    );

    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('Payment due'), { target: { value: '2020-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(
      screen.getAllByText('This date cannot be before the issue date.').length,
    ).toBeGreaterThan(0);
    expect(clickSpy).not.toHaveBeenCalled();
  });
});

describe('DocumentMaker (quotation)', () => {
  it('renders quotation language and its own validity date', () => {
    render(
      <MemoryRouter>
        <DocumentMaker kind="quotation" />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Quotation number')).toHaveValue('QUO-0001');
    expect(screen.getByLabelText('Valid until')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Quotation Maker');
    expect(screen.getByText('Prepared for')).toBeInTheDocument();
  });
});
