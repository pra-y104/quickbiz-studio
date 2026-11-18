/**
 * Structured JSON logging. Cloudflare Workers writes console output to
 * Workers Logs, where JSON lines are searchable per request.
 *
 * Rule: never log secrets, tokens, full user input or full AI output.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type Fields = Record<string, unknown>;

const REDACTED_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'api_key',
  'token',
  'password',
  'secret',
  'service_role_key',
]);

function sanitize(fields: Fields): Fields {
  const clean: Fields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      clean[key] = '[redacted]';
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

function emit(level: LogLevel, event: string, fields: Fields): void {
  const line = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitize(fields),
  });

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (event: string, fields: Fields = {}) => emit('debug', event, fields),
  info: (event: string, fields: Fields = {}) => emit('info', event, fields),
  warn: (event: string, fields: Fields = {}) => emit('warn', event, fields),
  error: (event: string, fields: Fields = {}) => emit('error', event, fields),
};
