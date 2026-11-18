import type { Bindings } from '../config/env';
import type { AppConfig } from '../config/env';
import type { AuthClaims } from '../lib/auth-tokens';

/** Values attached to every request context by middleware. */
export interface AppVariables {
  requestId: string;
  config: AppConfig;
  startedAt: number;
  /** Present only after requireAuth has verified an access token. */
  auth?: AuthClaims;
}

export interface AppContext {
  Bindings: Bindings;
  Variables: AppVariables;
}
