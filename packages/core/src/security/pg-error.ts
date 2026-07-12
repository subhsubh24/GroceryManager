/**
 * Postgres error classifiers — pure, driver-shape-only (no `postgres`/drizzle import), so a call
 * site can react to a specific DB failure WITHOUT leaking a raw error to the user or coupling to the
 * driver. Mirrors the other keyless classifiers in this folder (captcha-guard, token-enc-guard).
 *
 * The `postgres` (postgres.js) driver throws a `PostgresError` carrying the SQLSTATE `code`. We match
 * on the code alone rather than the class name so a wrapped/re-thrown error is still recognized.
 */

/** SQLSTATE 23505 — unique_violation (a row collided with a UNIQUE / PRIMARY KEY constraint). */
export const UNIQUE_VIOLATION = "23505";

/**
 * Is `err` a Postgres unique-constraint violation (SQLSTATE 23505)? Used to turn a lost check-then-
 * insert race into a friendly, expected outcome instead of an unhandled 500 — e.g. two concurrent
 * signups for the same username both pass the pre-insert existence check, then one loses to the
 * `users.username` UNIQUE constraint. Shape-only: true iff `err` is an object whose `code` === 23505.
 */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}
