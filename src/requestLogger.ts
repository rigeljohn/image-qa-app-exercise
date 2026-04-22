/**
 * RequestLogger — structured JSON logger.
 * Emits log entries to stdout. Never logs the value of GEMINI_API_KEY.
 */

/**
 * Scrub the GEMINI_API_KEY value from a serialised string so it never
 * appears in log output.
 */
function scrubApiKey(text: string): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return text;
  // Replace every occurrence of the key value with a redacted placeholder
  return text.split(apiKey).join('[REDACTED]');
}

/**
 * Emit a structured JSON log entry to stdout.
 *
 * @param level   - Severity level: 'info', 'warn', or 'error'.
 * @param message - Human-readable log message.
 * @param meta    - Optional additional fields (e.g. requestId, statusCode).
 */
export function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: object,
): void {
  const requestId =
    meta && 'requestId' in meta
      ? (meta as Record<string, unknown>).requestId
      : 'unknown';

  const entry: Record<string, unknown> = {
    requestId,
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  // Serialise and scrub any accidental API key leakage
  const serialised = scrubApiKey(JSON.stringify(entry));
  process.stdout.write(serialised + '\n');
}
