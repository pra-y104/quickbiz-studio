/**
 * Production-facing AI module surface.
 *
 * Only provider-independent pieces are exported here. The deterministic test
 * double lives under `ai/testing/` and is deliberately absent from this barrel,
 * so application code cannot pick it up by accident.
 */

export * from './cost';
export * from './execution';
export * from './provider';
export * from './registry';
export * from './streaming';
