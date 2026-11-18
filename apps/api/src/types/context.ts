import type { Bindings } from '../config/env';
import type { AppConfig } from '../config/env';

/** Values attached to every request context by middleware. */
export interface AppVariables {
  requestId: string;
  config: AppConfig;
  startedAt: number;
}

export interface AppContext {
  Bindings: Bindings;
  Variables: AppVariables;
}
