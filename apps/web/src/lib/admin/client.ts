/**
 * Admin API client.
 *
 * Every call goes to the admin API, which enforces admin authorization on the
 * server from a verified token plus a server-side allow-list. This client never
 * decides access itself and never invents data: sections without a backing data
 * source return `{ available: false, reason }`, which the UI renders honestly.
 */

import { createApiClient, type ApiClient } from '../api-client';
import { env } from '../env';

let api: ApiClient | null = null;

/** Lazily build the client so tests can inject their own. */
export function getAdminClient(): ApiClient {
  if (!api) {
    api = createApiClient({ baseUrl: env.apiBaseUrl });
  }
  return api;
}

/** Override for tests. */
export function setAdminClient(client: ApiClient): void {
  api = client;
}

export interface AdminSectionState {
  readonly available: boolean;
  readonly reason?: string;
}

export interface AdminPlatform {
  readonly name: string;
  readonly tagline: string;
  readonly apiVersion: string;
  readonly version: string;
  readonly environment: string;
}

export interface AdminOverview {
  readonly platform: AdminPlatform;
  readonly tools: {
    readonly total: number;
    readonly live: number;
    readonly ai: number;
    readonly utility: number;
  };
  readonly ai: {
    readonly configured: boolean;
    readonly reason: string;
    readonly configuredProviders: number;
  };
  readonly sections: Record<string, AdminSectionState>;
}

export interface AdminIdentity {
  readonly userId: string;
  readonly email: string | null;
  readonly sessionId: string | null;
  readonly expiresAt: string;
}

export interface AdminAiProvider {
  readonly id: string;
  readonly label: string;
  readonly model: string;
}

export interface AdminAiTool {
  readonly slug: string;
  readonly name: string;
  readonly status: string;
  readonly creditCost: number | null;
}

export interface AdminAiStatus {
  readonly available: true;
  readonly configured: boolean;
  readonly reason: string;
  readonly requestedProvider: string | null;
  readonly model: string | null;
  readonly providers: readonly AdminAiProvider[];
  readonly tools: readonly AdminAiTool[];
}

export interface AdminTool {
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  readonly category: string;
  readonly kind: string;
  readonly status: string;
  readonly requiresAuth: boolean;
  readonly creditCost: number | null;
}

export interface AdminTools {
  readonly available: true;
  readonly total: number;
  readonly tools: readonly AdminTool[];
}

export interface AdminSettings {
  readonly available: true;
  readonly editable: false;
  readonly note: string;
  readonly values: {
    readonly environment: string;
    readonly appVersion: string;
    readonly aiRequireVerifiedEmail: boolean;
    readonly rateLimitEnabled: boolean;
    readonly rateLimitWindowSeconds: number;
    readonly rateLimitMaxRequests: number;
    readonly corsAllowedOrigins: number;
  };
}

export function getAdminOverview(token: string | null): Promise<AdminOverview> {
  return getAdminClient().get<AdminOverview>('/api/v1/admin', { token });
}

export function getAdminIdentity(token: string | null): Promise<AdminIdentity> {
  return getAdminClient().get<AdminIdentity>('/api/v1/admin/me', { token });
}

export function getAdminAiStatus(token: string | null): Promise<AdminAiStatus> {
  return getAdminClient().get<AdminAiStatus>('/api/v1/admin/ai-status', { token });
}

export function getAdminTools(token: string | null): Promise<AdminTools> {
  return getAdminClient().get<AdminTools>('/api/v1/admin/tools', { token });
}

export function getAdminSettings(token: string | null): Promise<AdminSettings> {
  return getAdminClient().get<AdminSettings>('/api/v1/admin/settings', { token });
}

/** Sections without a backing data source in this build. */
export function getAdminSection(
  token: string | null,
  section: 'users' | 'wallets' | 'payments' | 'referrals' | 'audit-logs',
): Promise<AdminSectionState> {
  return getAdminClient().get<AdminSectionState>(`/api/v1/admin/${section}`, { token });
}
