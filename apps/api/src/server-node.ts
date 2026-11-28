import { serve } from '@hono/node-server';
import { createApp } from './app';
import type { Bindings } from './config/env';

/**
 * Node.js entry point for non-Workers hosts (Render).
 *
 * The Hono application is runtime-agnostic. This adapter feeds a Node HTTP
 * server with the same fetch handler the Worker uses, passing the process
 * environment as the bindings object. No application logic changes between
 * hosts; only this thin entry differs.
 *
 * Run with: pnpm --filter @quickbiz/api exec tsx src/server-node.ts
 */
const app = createApp();

const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
const env = (proc?.env ?? {}) as unknown as Bindings;
const port = Number(proc?.env?.PORT ?? 8787);

serve(
  {
    fetch: (request: Request) => app.fetch(request, env),
    port,
  },
  (info) => {
    console.log(`quickbiz-studio-api listening on port ${info.port}`);
  },
);
