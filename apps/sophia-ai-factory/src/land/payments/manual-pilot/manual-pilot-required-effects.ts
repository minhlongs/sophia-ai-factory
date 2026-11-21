import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

// SQLite raises an integer-overflow SQL error for this exact integer, including
// in a SELECT. Unlike a sentinel write, a BEFORE trigger cannot silently ignore
// the assertion. D1 rolls back the entire batch on that error.
const sqlFailure = 'abs(-9223372036854775808)';

/** Place immediately after one required write, before another DML statement.
 * A losing/replayed claim has no matching token and must remain a no-op. */
export function requirePilotEffect(
  db: D1Database, orderId: string, token: string,
): D1PreparedStatement {
  return db.prepare(`SELECT CASE WHEN changes()=1 THEN 1 ELSE ${sqlFailure} END
    FROM manual_pilot_financial_state WHERE order_id=? AND attempt_token=?`)
    .bind(orderId, token);
}

/** A silently ignored final UPDATE must not commit a retained winning token. */
export function requirePilotClaimReleased(
  db: D1Database, orderId: string, token: string,
): D1PreparedStatement {
  return db.prepare(`SELECT ${sqlFailure} FROM manual_pilot_financial_state
    WHERE order_id=? AND attempt_token=?`).bind(orderId, token);
}
