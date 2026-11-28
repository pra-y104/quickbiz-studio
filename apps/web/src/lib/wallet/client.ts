/**
 * Wallet read client.
 *
 * Reads the wallet and its entries from Supabase using the browser's own session
 * (Row Level Security guarantees a user only ever sees their own rows). Balances
 * are derived with the same pure ledger functions the API and tests use, so the
 * number shown here cannot disagree with the ledger rules.
 *
 * This module never writes money. Credits and debits are performed by the Worker
 * (service role) after a verified payment or an AI run, so a browser cannot mint
 * balance. When Supabase is not configured, every call reports unavailable and
 * the UI shows an honest notice instead of a fabricated balance.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  availableBalance,
  isWalletEntry,
  walletBalance,
  type WalletEntry,
  type WalletEntryKind,
} from '@quickbiz/shared';
import { env } from '../env';

export interface WalletView {
  readonly currency: string;
  readonly balanceMinor: number;
  readonly availableMinor: number;
  readonly entries: readonly WalletEntry[];
}

export class WalletUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletUnavailableError';
  }
}

/**
 * The wallet backend (migration 0004) has not been applied yet, so the
 * `wallets`/`wallet_entries` tables do not exist. This is a known, honest state
 * — not a load failure — and the UI explains it instead of implying the
 * customer's wallet is broken.
 */
export class WalletNotProvisionedError extends WalletUnavailableError {
  constructor() {
    super(
      'The wallet service is not set up for this account yet. Balances and top-ups will appear here once the payment system is enabled.',
    );
    this.name = 'WalletNotProvisionedError';
  }
}

interface PostgrestErrorLike {
  readonly code?: string;
  readonly message?: string;
}

/**
 * Detect the "table does not exist" error PostgREST returns before the wallet
 * migration is applied. We match on the documented Postgres/PostgREST codes and
 * message text rather than a single string so a future wording change does not
 * silently turn this back into a generic failure.
 */
function isMissingRelation(error: PostgrestErrorLike): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === '404') return true;
  const message = (error.message ?? '').toLowerCase();
  return message.includes('does not exist') || message.includes('could not find the table');
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new WalletUnavailableError('Wallet is not available until sign-in is configured.');
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}

interface WalletRow {
  id: string;
  currency: string;
}

interface EntryRow {
  id: string;
  wallet_id: string;
  kind: string;
  amount_minor: number;
  currency: string;
  reference: string;
  created_at: string;
}

function toEntry(row: EntryRow): WalletEntry | null {
  const candidate = {
    id: row.id,
    walletId: row.wallet_id,
    kind: row.kind as WalletEntryKind,
    amountMinor: row.amount_minor,
    currency: row.currency,
    reference: row.reference,
    createdAt: row.created_at,
  };
  return isWalletEntry(candidate) ? candidate : null;
}

/** Fetch the signed-in user's wallet with derived balances, or null when none exists. */
export async function fetchWallet(): Promise<WalletView | null> {
  const supabase = getClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new WalletUnavailableError('Sign in to view your wallet.');
  }

  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('id, currency')
    .maybeSingle<WalletRow>();
  if (walletError) {
    if (isMissingRelation(walletError)) throw new WalletNotProvisionedError();
    throw new WalletUnavailableError('Could not load the wallet.');
  }
  if (!wallet) return null;

  const { data: entries, error: entriesError } = await supabase
    .from('wallet_entries')
    .select('id, wallet_id, kind, amount_minor, currency, reference, created_at')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false });
  if (entriesError) {
    if (isMissingRelation(entriesError)) throw new WalletNotProvisionedError();
    throw new WalletUnavailableError('Could not load wallet history.');
  }

  const parsed = (entries ?? [])
    .map((row) => toEntry(row as EntryRow))
    .filter((entry): entry is WalletEntry => entry !== null);

  return {
    currency: wallet.currency,
    balanceMinor: walletBalance(parsed),
    availableMinor: availableBalance(parsed),
    entries: parsed,
  };
}
