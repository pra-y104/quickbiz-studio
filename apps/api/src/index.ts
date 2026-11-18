import { createApp } from './app';

/**
 * Cloudflare Worker entry point. The fetch handler delegates to the Hono app,
 * which owns routing, validation, error handling and logging.
 */
const app = createApp();

export default app;
