/**
 * UUID validation — used to validate a session/user id BEFORE it reaches the RLS tenant scope.
 *
 * Every per-user query runs inside `withTenant(db, userId, …)`, which sets the
 * `app.current_user_id` GUC; the RLS policies cast that GUC to `uuid`. If a non-UUID string ever
 * reaches it (a stale/forged/legacy session token whose `uid` isn't a real user id), Postgres
 * throws `invalid input syntax for type uuid` and the whole page subtree 500s. Validating the id
 * up front lets the app treat a malformed session as signed-out instead of crashing.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True iff `value` is a canonical RFC-4122 UUID string (any version). */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
