import type { D1Database } from '@cloudflare/workers-types';

const ACTIVE_PILOT_GRANT = `g.user_id=? AND e.user_id=g.user_id AND e.org_id=g.org_id
  AND e.revoked_at IS NULL AND julianday(e.starts_at)<=julianday(?)
  AND julianday(e.ends_at)>julianday(?) AND julianday(g.expires_at)>julianday(?)`;

/** Source balance is separate from purchased credits; never infer provenance
 * from the shared wallet total. Only active, unrevoked grants are spendable. */
export async function getManualPilotCreditBalance(db: D1Database, userId: string, orgId?: string): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.prepare(`SELECT COALESCE(SUM(g.granted-g.consumed-g.revoked),0) AS remaining
    FROM manual_pilot_credit_grants g JOIN manual_pilot_entitlements e USING(order_id)
    WHERE ${ACTIVE_PILOT_GRANT}
      AND ((? IS NULL AND (SELECT COUNT(DISTINCT org_id) FROM org_members WHERE user_id=g.user_id)=1) OR g.org_id=?)
          AND EXISTS(SELECT 1 FROM org_members m WHERE m.org_id=g.org_id AND m.user_id=g.user_id)`)
    .bind(userId,now,now,now,orgId??null,orgId??null).first<{remaining:number}>();
  return result?.remaining ?? 0;
}

/** Invalid JSON deliberately fails the statement and rolls back the batch.
 * A SELECT assertion cannot itself be bypassed by a table's RAISE(IGNORE) trigger. */
export function assertPilotDebitEffect(
  db: D1Database, attempt: string, condition: string, bindings: (string | number | null)[] = [],
) {
  return db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM manual_pilot_credit_debits WHERE id=?)
    AND NOT(${condition}) THEN json('missing required MCU debit effect') ELSE 1 END AS required_effect`)
    .bind(attempt, ...bindings);
}

/** Atomic allocation statements; caller must include the wallet debit and
 * shared transaction ledger in the SAME batch. Fresh attempt IDs are mandatory. */
export function pilotCreditAllocationStatements(
  db: D1Database, userId: string, amount: number, attempt: string, now: string, orgId?: string,
  missionId?: string,
) {
  // Only a server-bound organization can fund a trusted mission debit.
  const scope = missionId ? 'g.org_id=?' : `((? IS NULL AND
    (SELECT COUNT(DISTINCT org_id) FROM org_members WHERE user_id=g.user_id)=1) OR g.org_id=?)`;
  const scopeArgs = missionId ? [orgId ?? null] : [orgId ?? null, orgId ?? null];
  const missionGuard = missionId ? `AND EXISTS(SELECT 1 FROM engine_missions
    WHERE id=? AND user_id=? AND status='running')
    AND NOT EXISTS(SELECT 1 FROM mcu_mission_debits WHERE mission_id=?)` : '';
  return [
    db.prepare(`INSERT INTO manual_pilot_credit_debits(id,user_id,amount,created_at)
      SELECT ?,?,?,? WHERE ? <=
        COALESCE((SELECT credits_remaining FROM user_mcu_balance WHERE user_id=?),0) +
        COALESCE((SELECT SUM(g.granted-g.consumed-g.revoked) FROM manual_pilot_credit_grants g
          JOIN manual_pilot_entitlements e USING(order_id) WHERE ${ACTIVE_PILOT_GRANT}
          AND ${scope}
          AND EXISTS(SELECT 1 FROM org_members m WHERE m.user_id=g.user_id AND m.org_id=g.org_id)),0)
        ${missionGuard}`)
      .bind(attempt,userId,amount,now,amount,userId,userId,now,now,now,...scopeArgs,
        ...(missionId ? [missionId,userId,missionId] : [])),
    db.prepare(`INSERT INTO manual_pilot_credit_allocations(debit_id,order_id,amount)
      SELECT ?,order_id,MIN(remaining,MAX(0,?-prior)) FROM (
        SELECT g.order_id,g.granted-g.consumed-g.revoked AS remaining,
          COALESCE(SUM(g.granted-g.consumed-g.revoked) OVER
            (ORDER BY g.expires_at,g.order_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS prior
        FROM manual_pilot_credit_grants g JOIN manual_pilot_entitlements e USING(order_id)
        WHERE ${ACTIVE_PILOT_GRANT}
          AND ${scope}
          AND EXISTS(SELECT 1 FROM org_members m WHERE m.user_id=g.user_id AND m.org_id=g.org_id)
      ) WHERE remaining>0 AND prior<? AND EXISTS(SELECT 1 FROM manual_pilot_credit_debits WHERE id=?)`)
      .bind(attempt,amount,userId,now,now,now,...scopeArgs,amount,attempt),
    assertPilotDebitEffect(db, attempt, `ABS(
      COALESCE((SELECT SUM(amount) FROM manual_pilot_credit_allocations WHERE debit_id=?),0) -
      MIN(?,COALESCE((SELECT SUM(g.granted-g.consumed-g.revoked) FROM manual_pilot_credit_grants g
        JOIN manual_pilot_entitlements e USING(order_id) WHERE ${ACTIVE_PILOT_GRANT} AND ${scope}
        AND EXISTS(SELECT 1 FROM org_members m WHERE m.user_id=g.user_id AND m.org_id=g.org_id)),0))
      )<0.000000001`, [attempt,amount,userId,now,now,now,...scopeArgs]),
    db.prepare(`UPDATE manual_pilot_credit_grants SET consumed=consumed+
      (SELECT amount FROM manual_pilot_credit_allocations WHERE debit_id=? AND order_id=manual_pilot_credit_grants.order_id)
      WHERE order_id IN(SELECT order_id FROM manual_pilot_credit_allocations WHERE debit_id=?)`)
      .bind(attempt,attempt),
    assertPilotDebitEffect(db, attempt, `changes()=(SELECT COUNT(*)
      FROM manual_pilot_credit_allocations WHERE debit_id=?)`, [attempt]),
  ];
}
