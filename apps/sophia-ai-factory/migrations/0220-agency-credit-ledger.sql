CREATE TABLE agency_credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL REFERENCES agency(id),
  delta INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  reserved INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  job_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);
CREATE INDEX idx_credit_ledger_agency ON agency_credit_ledger(agency_id);
CREATE INDEX idx_credit_ledger_job ON agency_credit_ledger(job_id);
