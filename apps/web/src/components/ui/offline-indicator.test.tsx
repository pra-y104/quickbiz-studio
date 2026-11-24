import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { OfflineIndicator } from './offline-indicator';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('OfflineIndicator', () => {
  it('renders nothing when online', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    render(<OfflineIndicator />);
    expect(screen.queryByText(/You are offline/i)).not.toBeInTheDocument();
  });

  it('shows offline banner when offline', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<OfflineIndicator />);
    expect(screen.getByText(/You are offline/i)).toBeInTheDocument();
    expect(screen.getByText(/keep working/i)).toBeInTheDocument();
  });
});
