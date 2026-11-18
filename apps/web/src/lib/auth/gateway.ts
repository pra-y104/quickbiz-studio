import { isAuthConfigured } from '../env';
import { SupabaseAuthGateway } from './supabase-gateway';
import { UnconfiguredAuthGateway } from './unconfigured-gateway';
import type { AuthGateway } from './types';

let gateway: AuthGateway | null = null;

/**
 * Returns the single authentication gateway for this browser tab.
 *
 * The Supabase implementation is only constructed when the public environment
 * variables exist. Otherwise the unconfigured gateway is returned, which fails
 * honestly instead of simulating a signed-in user.
 */
export function getAuthGateway(): AuthGateway {
  if (!gateway) {
    gateway = isAuthConfigured ? new SupabaseAuthGateway() : new UnconfiguredAuthGateway();
  }
  return gateway;
}

/** Test seam: replace the gateway (for example with a fake in unit tests). */
export function setAuthGateway(next: AuthGateway | null): void {
  gateway = next;
}
