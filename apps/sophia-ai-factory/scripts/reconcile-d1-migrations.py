#!/usr/bin/env python3
"""
Reconcile d1_migrations tracking table with actual applied migrations.

READ-ONLY AUDIT MODE:
Inspects and reports differences between filesystem migration files and d1_migrations ledger.
AUTOMATIC WRITES DISABLED:
Speculative ledger backfills based on prefix comparisons (prefix <= max_tracked) are unsafe
and can cause ghost-ledger drift. This tool operates strictly in read-only audit mode.
"""

import subprocess
import json
import sys
from pathlib import Path

# Resolve migrations directory relative to this script
SCRIPT_DIR = Path(__file__).resolve().parent
MIGRATIONS_DIR = SCRIPT_DIR.parent / "migrations"
DB_NAME = "sophia-raas-db"

def run_wrangler_command(sql: str) -> str:
    """Execute a SQL command via wrangler d1 and return stdout as string."""
    cmd = [
        "npx", "wrangler", "d1", "execute", DB_NAME,
        "--remote", "--command", sql
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Wrangler command failed (exit code {result.returncode}): {result.stderr.strip()}")
    return result.stdout

def get_filesystem_migrations():
    """Get sorted list of migration files from filesystem."""
    path = Path(MIGRATIONS_DIR)
    if not path.exists():
        print(f"FATAL: migrations directory not found at {path}", file=sys.stderr)
        sys.exit(1)
    files = sorted([f.name for f in path.glob("*.sql") if f.name[0].isdigit() and "_archive" not in str(f)])
    return files

def get_database_migrations():
    """Get sorted list of migrations from d1_migrations table."""
    try:
        stdout = run_wrangler_command("SELECT name FROM d1_migrations ORDER BY name;")
    except Exception as e:
        print(f"FATAL: Database query failed while reading d1_migrations ledger: {e}", file=sys.stderr)
        print("Status is UNKNOWN. Aborting audit without reporting pending migrations.", file=sys.stderr)
        sys.exit(1)

    lines = stdout.split('\n')

    json_start = None
    json_end = None
    for i, line in enumerate(lines):
        if line.strip().startswith('['):
            if json_start is None:
                json_start = i
        if line.strip() == ']':
            json_end = i

    if json_start is None or json_end is None:
        print("FATAL: Failed to locate valid JSON output from wrangler command.", file=sys.stderr)
        print("Raw output:\n" + stdout, file=sys.stderr)
        print("Status is UNKNOWN. Aborting audit without reporting pending migrations.", file=sys.stderr)
        sys.exit(1)

    json_lines = lines[json_start:json_end+1]
    json_str = '\n'.join(json_lines)

    try:
        data = json.loads(json_str)
        # Handle wrangler output format: [{"results": [...]}]
        if isinstance(data, list) and len(data) > 0 and 'results' in data[0]:
            migrations = [row['name'] for row in data[0]['results']]
        else:
            migrations = []
        return sorted(migrations)
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        print(f"FATAL: Error parsing JSON from wrangler output: {e}", file=sys.stderr)
        print("Status is UNKNOWN. Aborting audit without reporting pending migrations.", file=sys.stderr)
        sys.exit(1)

def check_table_exists():
    """Check if d1_migrations table exists."""
    try:
        stdout = run_wrangler_command(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations';"
        )
    except Exception as e:
        print(f"FATAL: Database query failed while checking d1_migrations table existence: {e}", file=sys.stderr)
        print("Status is UNKNOWN. Aborting audit.", file=sys.stderr)
        sys.exit(1)
    return '"name":"d1_migrations"' in stdout or 'd1_migrations' in stdout

def analyze_discrepancies(fs_migrations, db_migrations):
    """
    Audit differences between filesystem and ledger without writing anything.
    """
    fs_set = set(fs_migrations)
    db_set = set(db_migrations)
    untracked = fs_set - db_set

    if not untracked:
        return [], []

    def get_prefix(name):
        import re
        match = re.match(r'^(\d+)', name)
        return int(match.group(1)) if match else 999999

    sorted_untracked = sorted(untracked, key=get_prefix)

    max_tracked = 0
    for name in db_migrations:
        import re
        match = re.match(r'^(\d+)', name)
        if match:
            max_tracked = max(max_tracked, int(match.group(1)))

    print(f"\nMax tracked migration number: {max_tracked}")
    print(f"Untracked migrations in filesystem: {len(untracked)}")

    gap_migrations = []
    future_migrations = []

    for name in sorted_untracked:
        prefix = get_prefix(name)
        if prefix <= max_tracked:
            gap_migrations.append(name)
        else:
            future_migrations.append(name)

    print(f"Untracked with prefix <= max_tracked (gap/drift risk): {len(gap_migrations)}")
    print(f"Untracked with prefix > max_tracked (pending execution): {len(future_migrations)}")

    return gap_migrations, future_migrations

def main():
    print("=" * 80)
    print("D1 MIGRATIONS TRACKING AUDIT (READ-ONLY)")
    print("=" * 80)

    # Check table exists
    if not check_table_exists():
        print("ALERT: d1_migrations table does not exist in target database.")
        print("Exiting audit without modifying database.")
        sys.exit(1)

    fs_migrations = get_filesystem_migrations()
    db_migrations = get_database_migrations()

    print(f"\nFilesystem migrations: {len(fs_migrations)}")
    print(f"Database tracked migrations: {len(db_migrations)}")

    fs_set = set(fs_migrations)
    db_set = set(db_migrations)

    in_db_not_fs = sorted(db_set - fs_set)
    in_fs_not_db = sorted(fs_set - db_set)
    in_both = sorted(fs_set & db_set)

    print(f"\nIn sync: {len(in_both)}")
    print(f"DB only (orphaned in ledger): {len(in_db_not_fs)}")
    print(f"FS only (untracked in ledger): {len(in_fs_not_db)}")

    if in_db_not_fs:
        print("\nOrphaned tracking entries (recorded in ledger but file missing):")
        for m in in_db_not_fs:
            print(f"  - {m}")

    if in_fs_not_db:
        gap_migrations, future_migrations = analyze_discrepancies(fs_migrations, db_migrations)
        if gap_migrations:
            print("\nWARNING: Gap migrations detected (filesystem file has prefix <= max_tracked but missing in ledger):")
            for m in gap_migrations:
                print(f"  - {m}")
            print("  -> DO NOT automatically backfill ledger without verifying physical schema objects!")

        if future_migrations:
            print("\nPending migrations (filesystem file has prefix > max_tracked):")
            for m in future_migrations:
                print(f"  - {m}")

    print("\n" + "=" * 80)
    print("AUDIT SUMMARY (NO CHANGES APPLIED)")
    print("=" * 80)
    print(f"Total filesystem migrations: {len(fs_migrations)}")
    print(f"Total tracked migrations: {len(db_migrations)}")
    print(f"In sync: {len(in_both)}")
    print(f"Orphaned (DB only): {len(in_db_not_fs)}")
    print(f"Untracked (FS only): {len(in_fs_not_db)}")
    print("\nAutomatic backfill is DISABLED. Operator must verify physical schema state.")

if __name__ == "__main__":
    main()
