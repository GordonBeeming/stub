// Structured logging. Every line is a single-line JSON object so Cloudflare's
// Log dashboard can filter by `evt`, and `wrangler tail --format pretty`
// renders it cleanly. Keep fields short and stable — dashboards watch for
// specific names.

type LogLevel = 'info' | 'warn' | 'error';

interface LogFields {
  evt: string;
  [k: string]: unknown;
}

export function log(level: LogLevel, fields: LogFields): void {
  // Always stdout via console.log — wrangler's local dev stream swallows
  // console.error and the Cloudflare dashboard filters on the `lvl` field
  // anyway. One stream keeps observability consistent across environments.
  const line = JSON.stringify({ lvl: level, ts: Date.now(), ...fields });
  console.log(line);
}

export const logInfo = (fields: LogFields): void => log('info', fields);
export const logWarn = (fields: LogFields): void => log('warn', fields);
export const logError = (fields: LogFields): void => log('error', fields);
