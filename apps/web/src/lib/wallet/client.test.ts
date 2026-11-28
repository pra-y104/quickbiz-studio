import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The wallet client must distinguish "the wallet migration is not applied yet"
 * (a known, honest state) from a genuine load failure. We mock the Supabase
 * client so the test does not need a real database or network.
 */

const maybeSingle = vi.fn();
const order = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const getUser = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({ select }),
  }),
}));

// The env module reads import.meta.env; give it truthy values so getClient()
// does not short-circuit to "not configured".
vi.mock('../env', () => ({
  env: { supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon-key' },
}));

import { fetchWallet, WalletNotProvisionedError, WalletUnavailableError } from './client';

describe('fetchWallet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    select.mockReturnValue({ maybeSingle, order, eq });
    maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('reports a not-provisioned wallet when the wallets table is missing', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'relation "public.wallets" does not exist' },
    });

    await expect(fetchWallet()).rejects.toBeInstanceOf(WalletNotProvisionedError);
  });

  it('reports a generic unavailable error for other failures', async () => {
    maybeSingle.mockResolvedValue({
      data: null,
      error: { code: 'XX000', message: 'internal error' },
    });

    await expect(fetchWallet()).rejects.toBeInstanceOf(WalletUnavailableError);
    await expect(fetchWallet()).rejects.not.toBeInstanceOf(WalletNotProvisionedError);
  });

  it('returns null when no wallet row exists yet', async () => {
    await expect(fetchWallet()).resolves.toBeNull();
  });
});
