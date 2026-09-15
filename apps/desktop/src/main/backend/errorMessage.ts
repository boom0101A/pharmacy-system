/**
 * Safely extracts a message from a rejected value of unknown shape.
 *
 * A bare `(err as Error).message` assumes every rejection is an `Error`
 * instance — but `Promise.reject()` can reject with anything, including
 * `null`/`undefined`. Casting and reading `.message` on those throws inside
 * the very catch block meant to report the original failure, turning a
 * clean "status: failed" into a second, unhandled rejection instead.
 */
export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
