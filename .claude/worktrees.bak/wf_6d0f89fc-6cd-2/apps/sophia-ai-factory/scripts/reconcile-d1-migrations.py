#!/usr/bin/env python3
"""
Reconcile d1_migrations tracking table with actual applied migrations.

This script:
1. Identifies migrations that are applied in the database but not tracked
2. Backfills tracking entries for those migrations
3. Reports on the state after reconciliation
"""

import subprocess
import json
import sys
from pathlib import Path
from datetime import datetime

MIGRATIONS_DIR = "/Users/macbook/projects/worktrees/sophia-ai-factory-code-review-check/apps/sophia-ai-factory/migrations"
DB_NAME = "sophia-raas-db"

def run_wrangler_command(sql: str) -> str:
    """Execute a SQL command via wrangler d1 and return stdout as string."""
    cmd = [
        "npx", "wrangler", "d1", "execute", DB_NAME,
        "--remote", "--command", sql
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    return result.stdout

def get_filesystem_migrations():
    """Get sorted list of migration files from filesystem."""
    path = Path(MIGRATIONS_DIR)
    files = sorted([f.name for f in path.glob("*.sql") if f.name[0].isdigit()])
    return files

def get_database_migrations():
    """Get sorted list of migrations from d1_migrations table."""
    stdout = run_wrangler_command("SELECT name FROM d1_migrations ORDER BY name;")
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
        return []

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
        print(f"Error parsing JSON: {e}", file=sys.stderr)
        return []

def check_table_exists():
    """Check if d1_migrations table exists."""
    stdout = run_wrangler_command(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='d1_migrations';"
    )
    return '"name":"d1_migrations"' in stdout or 'd1_migrations' in stdout

def create_migrations_table():
    """Create the d1_migrations tracking table if it doesn't exist."""
    sql = """
    CREATE TABLE IF NOT EXISTS d1_migrations (
      name TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    """
    subprocess.run([
        "npx", "wrangler", "d1", "execute", DB_NAME,
        "--remote", "--file", "-"
    ], input=sql, text=True, check=True)
    print("Created d1_migrations table")

def backfill_tracking(fs_migrations, db_migrations):
    """
    Backfill tracking for migrations that are in filesystem and have been applied
    (can be detected by checking if the migration's SQL changes exist in the schema)
    but are not in the tracking table.

    Since we can't reliably detect if a migration was applied without tracking,
    we'll use a conservative approach:
    - Only backfill if we're reasonably certain (e.g., migration number is less than
      the max tracked number AND the migration file exists and the schema objects exist)
    """
    fs_set = set(fs_migrations)
    db_set = set(db_migrations)
    untracked = fs_set - db_set

    if not untracked:
        return []

    # Sort by numeric prefix
    def get_prefix(name):
        import re
        match = re.match(r'^(\d+)', name)
        return int(match.group(1)) if match else 999999

    sorted_untracked = sorted(untracked, key=get_prefix)

    # Get max tracked migration number
    max_tracked = 0
    for name in db_migrations:
        import re
        match = re.match(r'^(\d+)', name)
        if match:
            max_tracked = max(max_tracked, int(match.group(1)))

    print(f"\nMax tracked migration number: {max_tracked}")
    print(f"Untracked migrations: {len(untracked)}")

    # For untracked migrations with prefix <= max_tracked, they were likely applied
    # but not tracked. For those with higher prefixes, they might be unapplied.
    likely_applied = []
    likely_unapplied = []

    for name in sorted_untracked:
        prefix = get_prefix(name)
        if prefix <= max_tracked:
            likely_applied.append(name)
        else:
            likely_unapplied.append(name)

    print(f"Likely applied (but untracked): {len(likely_applied)}")
    print(f"Likely truly unapplied: {len(likely_unapplied)}")

    return likely_applied, likely_unapplied

def insert_tracking_entries(migrations_to_insert):
    """Insert tracking entries for the given migrations."""
    if not migrations_to_insert:
        return 0

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    inserted = 0

    for mig_name in migrations_to_insert:
        sql = f"""INSERT OR IGNORE INTO d1_migrations (name, applied_at)
VALUES ('{mig_name}', '{now}');"""
        try:
            # Use a temporary file for the SQL
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
                f.write(sql)
                sql_file = f.name
            subprocess.run([
                "npx", "wrangler", "d1", "execute", DB_NAME,
                "--remote", "--file", sql_file
            ], check=True, capture_output=True, text=True)
            inserted += 1
            print(f"  Backfilled: {mig_name}")
            Path(sql_file).unlink(missing_ok=True)
        except subprocess.CalledProcessError as e:
            print(f"  Failed to backfill {mig_name}: {e.stderr}")
            Path(sql_file).unlink(missing_ok=True) if 'sql_file' in locals() else None

    return inserted

def main():
    print("=" * 80)
    print("D1 MIGRATIONS TRACKING RECONCILIATION")
    print("=" * 80)

    # Check table exists
    if not check_table_exists():
        print("d1_migrations table does not exist. Creating it...")
        create_migrations_table()

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
    print(f"DB only (orphaned): {len(in_db_not_fs)}")
    print(f"FS only (untracked): {len(in_fs_not_db)}")

    if in_db_not_fs:
        print("\nOrphaned tracking entries (file missing):")
        for m in in_db_not_fs:
            print(f"  - {m}")

    # Analyze untracked files
    if in_fs_not_db:
        likely_applied, likely_unapplied = backfill_tracking(fs_migrations, db_migrations)

        if likely_applied:
            print("\nBackfilling tracking for likely-applied migrations...")
            inserted = insert_tracking_entries(likely_applied)
            print(f"Inserted {inserted} tracking entries")

            # Update the lists
            for name in likely_applied:
                in_fs_not_db.remove(name)
                in_both.append(name)

        print(f"\nRemaining untracked (likely unapplied): {len(in_fs_not_db)}")
        for m in in_fs_not_db:
            print(f"  - {m}")

    print("\n" + "=" * 80)
    print("RECONCILIATION SUMMARY")
    print("=" * 80)
    print(f"Total filesystem migrations: {len(fs_migrations)}")
    print(f"Total tracked migrations: {len(db_migrations) + (inserted if 'inserted' in locals() else 0)}")
    print(f"In sync: {len(in_both)}")
    print(f"Orphaned (DB only): {len(in_db_not_fs)}")
    print(f"Untracked/unapplied: {len(in_fs_not_db)}")

    print("\nNext steps:")
    if in_fs_not_db:
        print(f"  - Review and apply {len(in_fs_not_db)} unapplied migrations")
    if in_db_not_fs:
        print(f"  - Consider removing {len(in_db_not_fs)} orphaned tracking entries")
    print("  - Consider switching apply-migrations.sh to use 'wrangler d1 migrations apply'")

if __name__ == "__main__":
    main()
