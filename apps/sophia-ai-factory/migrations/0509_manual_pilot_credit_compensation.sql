-- Trusted mission charges are distinct from customer-supplied mission_id/reason.
-- No historical debit is backfilled: its source cannot be proved from those fields.
CREATE TABLE mcu_mission_debits (
  mission_id TEXT PRIMARY KEY REFERENCES engine_missions(id),
  debit_id TEXT NOT NULL UNIQUE REFERENCES manual_pilot_credit_debits(id),
  org_id TEXT
);
CREATE TRIGGER mcu_mission_debit_binding BEFORE INSERT ON mcu_mission_debits BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM engine_missions m JOIN manual_pilot_credit_debits d ON d.id=NEW.debit_id
    JOIN mcu_transactions t ON t.id=d.id AND t.user_id=d.user_id AND t.mission_id=m.id AND t.delta=-d.amount
    WHERE m.id=NEW.mission_id AND m.user_id=d.user_id AND m.status='running'
  ) OR EXISTS (
    SELECT 1 FROM manual_pilot_credit_allocations a JOIN manual_pilot_credit_grants g USING(order_id)
    JOIN manual_pilot_credit_debits d ON d.id=a.debit_id
    WHERE a.debit_id=NEW.debit_id AND (g.user_id<>d.user_id OR g.org_id IS NOT NEW.org_id)
  ) THEN RAISE(ABORT,'mission debit binding mismatch') END;
END;
CREATE TRIGGER mcu_mission_debits_no_update BEFORE UPDATE ON mcu_mission_debits BEGIN
  SELECT RAISE(ABORT,'mission debits are immutable');
END;
CREATE TRIGGER mcu_mission_debits_no_delete BEFORE DELETE ON mcu_mission_debits BEGIN
  SELECT RAISE(ABORT,'mission debits are immutable');
END;

-- Source eligibility is evaluated using the database clock during the write.
CREATE VIEW mcu_mission_pilot_sources AS
SELECT l.debit_id,a.order_id,a.amount,
  CASE WHEN g.user_id=d.user_id AND e.user_id=d.user_id AND e.org_id=g.org_id
    AND l.org_id=g.org_id AND e.revoked_at IS NULL
    AND julianday(e.starts_at)<=julianday('now') AND julianday(e.ends_at)>julianday('now')
    AND julianday(g.expires_at)>julianday('now') THEN 1 ELSE 0 END AS eligible
FROM mcu_mission_debits l JOIN manual_pilot_credit_debits d ON d.id=l.debit_id
JOIN manual_pilot_credit_allocations a ON a.debit_id=d.id
LEFT JOIN manual_pilot_credit_grants g ON g.order_id=a.order_id
LEFT JOIN manual_pilot_entitlements e ON e.order_id=a.order_id;

CREATE VIEW mcu_mission_compensation_sources AS
SELECT l.mission_id,l.debit_id,l.org_id,d.user_id,d.amount,
  MAX(0,d.amount-COALESCE(SUM(a.amount),0)) AS purchased,
  COALESCE(SUM(CASE WHEN a.eligible=1 THEN a.amount ELSE 0 END),0) AS pilot_restored,
  COALESCE(SUM(CASE WHEN a.eligible=0 THEN a.amount ELSE 0 END),0) AS pilot_withheld
FROM mcu_mission_debits l JOIN manual_pilot_credit_debits d ON d.id=l.debit_id
LEFT JOIN mcu_mission_pilot_sources a ON a.debit_id=d.id GROUP BY l.mission_id;

CREATE TABLE mcu_mission_compensations (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL UNIQUE REFERENCES engine_missions(id),
  debit_id TEXT UNIQUE REFERENCES manual_pilot_credit_debits(id),
  user_id TEXT NOT NULL,
  org_id TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('compensated','legacy_unproven','no_debit')),
  amount REAL NOT NULL CHECK(amount>=0),
  purchased REAL NOT NULL CHECK(purchased>=0),
  pilot_restored REAL NOT NULL CHECK(pilot_restored>=0),
  pilot_withheld REAL NOT NULL CHECK(pilot_withheld>=0),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  CHECK(ABS(amount-(purchased+pilot_restored+pilot_withheld))<0.000000001),
  CHECK((outcome IN ('legacy_unproven','no_debit') AND debit_id IS NULL AND org_id IS NULL
      AND amount=0 AND purchased=0 AND pilot_restored=0 AND pilot_withheld=0)
    OR (outcome='compensated' AND debit_id IS NOT NULL AND amount>0))
);
CREATE TRIGGER mcu_mission_compensation_binding BEFORE INSERT ON mcu_mission_compensations BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM engine_missions WHERE id=NEW.mission_id
    AND user_id=NEW.user_id AND status IN ('pending','running'))
    THEN RAISE(ABORT,'mission is not compensable') END;
  SELECT CASE WHEN NEW.outcome='compensated' AND NOT EXISTS (
    SELECT 1 FROM mcu_mission_compensation_sources s WHERE s.mission_id=NEW.mission_id
      AND s.debit_id=NEW.debit_id AND s.user_id=NEW.user_id AND s.org_id IS NEW.org_id
      AND s.amount=NEW.amount AND s.purchased=NEW.purchased AND s.pilot_restored=NEW.pilot_restored
      AND s.pilot_withheld=NEW.pilot_withheld
  ) THEN RAISE(ABORT,'compensation source mismatch') END;
  SELECT CASE WHEN NEW.outcome<>'compensated' AND EXISTS (
    SELECT 1 FROM mcu_mission_debits WHERE mission_id=NEW.mission_id
  ) THEN RAISE(ABORT,'trusted debit cannot be treated as legacy') END;
END;

-- One insert atomically claims, restores eligible sources, appends the ledger and
-- terminates the mission. A failure anywhere rolls back the claim and all effects.
CREATE TRIGGER mcu_mission_compensation_apply AFTER INSERT ON mcu_mission_compensations BEGIN
  UPDATE manual_pilot_credit_grants SET consumed=consumed-(
    SELECT a.amount FROM manual_pilot_credit_allocations a
    WHERE a.debit_id=NEW.debit_id AND a.order_id=manual_pilot_credit_grants.order_id
  ) WHERE order_id IN (
    SELECT s.order_id FROM mcu_mission_pilot_sources s WHERE s.debit_id=NEW.debit_id AND s.eligible=1
  );
  SELECT CASE WHEN changes()<>(SELECT COUNT(*) FROM mcu_mission_pilot_sources
    WHERE debit_id=NEW.debit_id AND eligible=1) THEN RAISE(ABORT,'compensation grant missing') END;
  UPDATE user_mcu_balance SET credits_remaining=credits_remaining+NEW.purchased,
    credits_total_used=MAX(0,credits_total_used-NEW.purchased-NEW.pilot_restored),
    updated_at=strftime('%s','now')
    WHERE user_id=NEW.user_id AND NEW.outcome='compensated'
      AND credits_total_used+0.000000001>=NEW.purchased+NEW.pilot_restored;
  SELECT CASE WHEN NEW.outcome='compensated' AND changes()<>1
    THEN RAISE(ABORT,'compensation balance missing or inconsistent') END;
  INSERT INTO mcu_transactions(user_id,delta,reason,mission_id,metadata)
    SELECT NEW.user_id,NEW.purchased+NEW.pilot_restored,'reaper_refund',NEW.mission_id,
      json_object('compensation_id',NEW.id,'debit_id',NEW.debit_id,'org_id',NEW.org_id,
        'purchased',NEW.purchased,'pilot_restored',NEW.pilot_restored,'pilot_withheld',NEW.pilot_withheld)
    WHERE NEW.outcome='compensated';
  SELECT CASE WHEN NEW.outcome='compensated' AND changes()<>1
    THEN RAISE(ABORT,'compensation ledger missing') END;
  UPDATE engine_missions SET status='failed',
    error=CASE WHEN NEW.outcome='legacy_unproven' THEN 'timeout_reaper_unreconciled' ELSE 'timeout_reaper' END,
    updated_at=NEW.created_at,completed_at=NEW.created_at WHERE id=NEW.mission_id;
  SELECT CASE WHEN changes()<>1 THEN RAISE(ABORT,'compensated mission missing') END;
END;
CREATE TRIGGER mcu_mission_compensations_no_update BEFORE UPDATE ON mcu_mission_compensations BEGIN
  SELECT RAISE(ABORT,'mission compensations are immutable');
END;
CREATE TRIGGER mcu_mission_compensations_no_delete BEFORE DELETE ON mcu_mission_compensations BEGIN
  SELECT RAISE(ABORT,'mission compensations are immutable');
END;
-- Retain the exact original allocation even after compensation or grant expiry.
CREATE TRIGGER mcu_mission_original_debit_no_update BEFORE UPDATE ON manual_pilot_credit_debits
WHEN EXISTS(SELECT 1 FROM mcu_mission_debits WHERE debit_id=OLD.id) BEGIN
  SELECT RAISE(ABORT,'trusted original debit is immutable');
END;
CREATE TRIGGER mcu_mission_original_debit_no_delete BEFORE DELETE ON manual_pilot_credit_debits
WHEN EXISTS(SELECT 1 FROM mcu_mission_debits WHERE debit_id=OLD.id) BEGIN
  SELECT RAISE(ABORT,'trusted original debit is immutable');
END;
CREATE TRIGGER mcu_mission_allocation_no_insert BEFORE INSERT ON manual_pilot_credit_allocations
WHEN EXISTS(SELECT 1 FROM mcu_mission_debits WHERE debit_id=NEW.debit_id) BEGIN
  SELECT RAISE(ABORT,'trusted original allocations are immutable');
END;
CREATE TRIGGER mcu_mission_allocation_no_update BEFORE UPDATE ON manual_pilot_credit_allocations
WHEN EXISTS(SELECT 1 FROM mcu_mission_debits WHERE debit_id IN (OLD.debit_id,NEW.debit_id)) BEGIN
  SELECT RAISE(ABORT,'trusted original allocations are immutable');
END;
CREATE TRIGGER mcu_mission_allocation_no_delete BEFORE DELETE ON manual_pilot_credit_allocations
WHEN EXISTS(SELECT 1 FROM mcu_mission_debits WHERE debit_id=OLD.debit_id) BEGIN
  SELECT RAISE(ABORT,'trusted original allocations are immutable');
END;
