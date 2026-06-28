#!/usr/bin/env python3
"""
Audit d1_migrations table vs filesystem migrations directory.
Compares what's in the database vs what's on disk.
"""

import subprocess
import json
import sys
from pathlib import Path

MIGRATIONS_DIR = "/Users/macbook/projects/worktrees/sophia-ai-factory-code-review-check/apps/sophia-ai-factory/migrations"
DB_NAME = "sophia-raas-db"

def get_filesystem_migrations():
    """Get sorted list of migration files from filesystem."""
    path = Path(MIGRATIONS_DIR)
    files = sorted([f.name for f in path.glob("*.sql")])
    return files

def get_database_migrations():
    """Get sorted list of migrations from d1_migrations table."""
    cmd = [
        "npx", "wrangler", "d1", "execute", DB_NAME,
        "--remote", "--command",
        "SELECT name FROM d1_migrations ORDER BY name;"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)

    # Extract JSON from output (skip wrangler banner lines)
    lines = result.stdout.split('\n')
    # Find the JSON array start and end
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
        migrations = [row['name'] for row in data[0]['results']]
        return sorted(migrations)
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        print(f"Error parsing JSON: {e}", file=sys.stderr)
        return []

def find_duplicates(items):
    """Find items with duplicate numeric prefixes."""
    prefix_counts = {}
    for item in items:
        # Extract numeric prefix (digits at start, may include underscores/dashes after)
        import re
        match = re.match(r'^(\d+)', item)
        if match:
            prefix = match.group(1)
            prefix_counts.setdefault(prefix, []).append(item)
    duplicates = {prefix: items for prefix, items in prefix_counts.items() if len(items) > 1}
    return duplicates

def main():
    fs_migrations = get_filesystem_migrations()
    db_migrations = get_database_migrations()

    fs_set = set(fs_migrations)
    db_set = set(db_migrations)

    in_db_not_fs = sorted(db_set - fs_set)
    in_fs_not_db = sorted(fs_set - db_set)
    in_both = sorted(fs_set & db_set)

    fs_duplicates = find_duplicates(fs_migrations)
    db_duplicates = find_duplicates(db_migrations)

    print("=" * 80)
    print("D1_MIGRATIONS AUDIT REPORT")
    print("=" * 80)
    print()
    print(f"Database: {DB_NAME}")
    print(f"Migrations directory: {MIGRATIONS_DIR}")
    print()

    print("SUMMARY")
    print("-" * 40)
    print(f"Filesystem migrations: {len(fs_migrations)}")
    print(f"Database migrations:   {len(db_migrations)}")
    print(f"In sync (both):        {len(in_both)}")
    print(f"DB only (orphaned):   {len(in_db_not_fs)}")
    print(f"FS only (unapplied):  {len(in_fs_not_db)}")
    print()

    if in_db_not_fs:
        print("IN DATABASE BUT NOT IN FILESYSTEM (MISSING FILES)")
        print("-" * 40)
        for m in in_db_not_fs:
            print(f"  ❌ {m}")
        print()

    if in_fs_not_db:
        print("IN FILESYSTEM BUT NOT IN DATABASE (UNAPPLIED)")
        print("-" * 40)
        for m in in_fs_not_db:
            print(f"  📁 {m}")
        print()

    if fs_duplicates:
        print("FILESYSTEM DUPLICATE PREFIXES")
        print("-" * 40)
        for prefix, files in sorted(fs_duplicates.items()):
            print(f"  {prefix}: {len(files)} files")
            for f in files:
                print(f"    - {f}")
        print()

    if db_duplicates:
        print("DATABASE DUPLICATE PREFIXES")
        print("-" * 40)
        for prefix, files in sorted(db_duplicates.items()):
            print(f"  {prefix}: {len(files)} entries")
            for f in files:
                print(f"    - {f}")
        print()

    # Save reports
    report_dir = Path("/tmp/migration_audit_report")
    report_dir.mkdir(exist_ok=True)

    (report_dir / "fs_migrations.txt").write_text('\n'.join(fs_migrations))
    (report_dir / "db_migrations.txt").write_text('\n'.join(db_migrations))
    (report_dir / "in_db_not_fs.txt").write_text('\n'.join(in_db_not_fs))
    (report_dir / "in_fs_not_db.txt").write_text('\n'.join(in_fs_not_db))
    (report_dir / "in_both.txt").write_text('\n'.join(in_both))

    print(f"Detailed lists saved to: {report_dir}")
    print()

    # Issues summary
    issues = []
    if in_db_not_fs:
        issues.append(f"Missing {len(in_db_not_fs)} migration files that exist in database")
    if in_fs_not_db:
        issues.append(f"Unapplied {len(in_fs_not_db)} migration files not in database")
    if fs_duplicates or db_duplicates:
        issues.append(f"Duplicate migration prefixes detected")

    if issues:
        print("ISSUES REQUIRING ATTENTION:")
        print("-" * 40)
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
    else:
        print("NO ISSUES: Database and filesystem are in sync!")
    print()

    return 0 if not (in_db_not_fs or in_fs_not_db or fs_duplicates or db_duplicates) else 1

if __name__ == "__main__":
    sys.exit(main())
