/**
 * Username — the login handle for credentials accounts. It REPLACES email as the identifier the user
 * types to sign up / sign in; email is now only the optional Gmail-linkage attribute (set when a user
 * connects Gmail, never collected at signup). These helpers normalize the handle to a canonical
 * lowercase form and guard its shape BEFORE any DB lookup, so the unique-username constraint, the
 * signup duplicate-check, and the credentials lookup all key off the SAME normalized value.
 *
 * Pure + no I/O — cheap to unit-test and reused on signup, signin, and the credentials authorize.
 */

/** Canonical stored/queried form: trimmed + lowercased, so lookups are case-insensitive. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Shape check for a username (validate the NORMALIZED value): 3–20 chars of `[a-z0-9._]`, must start
 * and end with a letter or digit (no leading/trailing dot or underscore), and no run of two
 * separators in a row. A cheap gate before the parameterized lookup — never a substitute for it.
 */
export function isValidUsername(username: string): boolean {
  if (username.length < 3 || username.length > 20) return false;
  if (!/^[a-z0-9._]+$/.test(username)) return false;
  if (/^[._]|[._]$/.test(username)) return false; // no leading/trailing separator
  if (/[._]{2,}/.test(username)) return false; // no consecutive separators
  return true;
}
