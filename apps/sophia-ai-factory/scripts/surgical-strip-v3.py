#!/usr/bin/env python3
"""surgical-strip-v3.py — targeted byte reduction for handler.mjs

Targets confirmed by analysis of the 48.7MB file's gzip output (9.26MB, 228KB over limit):
  Pattern A: SUPABASE_MIGRATIONS_MANIFEST dead-code chunk (33KB gzip)
  Pattern B: encoding table JSON.parse blobs (~150KB+ gzip compressed)
  Pattern C: sentry source-map Debug ID lines (runtime artifacts)
"""
import re, sys, os

HARD_LIMIT = 9_476_736  # Cloudflare Workers gzip hard limit


def strip(content: str) -> tuple[str, dict]:
    stats = {}
    orig = content

    # ── A. SUPABASE_MIGRATIONS_MANIFEST dead chunk ────────────────────────
    # Sophia uses Cloudflare D1; this Supabase-specific manifest is dead code.
    # The chunk is: }, NUM, (e,a,p) => { a.exports = JSON.parse('...migrations array...');
    # Pattern: from b.s(["SUPABASE_MIGRATIONS_MANIFEST" chunk head to end of that chunk,
    # OR simpler: strip the JSON.parse assignment line that provides the manifest.
    #
    # Two forms exist:
    #  (1) a.s(["SUPABASE_MIGRATIONS_MANIFEST", ...]) [data-chunk style]
    #  (2) B.SUPABASE_MIGRATIONS_MANIFEST.map(...) [runtime access]
    # Strip the entire chunk that owns the data.
    p = re.compile(
        r'\},\s*\d+,\s*\([a-z],\s*[a-z],\s*[a-z]\)\s*=>\s*\{'
        r'\s*[a-z]\.exports\s*=\s*JSON\.parse\([^)]{50,}\)\s*;?\s*\}',
    )
    content, n = p.subn('', content)
    stats['supabase_migrations_chunk'] = n

    # Also strip any a.s(["SUPABASE_MIGRATIONS_MANIFEST", 0, [ chunk-head style
    p = re.compile(
        r'[a-z]\.s\(\["SUPABASE_MIGRATIONS_MANIFEST",\s*0,\s*\[',
    )
    content, n = p.subn('', content)
    stats['supabase_manifest_registration'] = n

    # Strip runtime reference: ...SUPABASE_MIGRATIONS_MANIFEST.map(...  and  SUPABASE_MIGRATIONS_MANIFEST.length
    p = re.compile(r'\.SUPABASE_MIGRATIONS_MANIFEST\b')
    content, n = p.subn('.SUPABASE_MIGRATIONS_MANIFEST_REMOVED', content)
    stats['supabase_manifest_refs'] = n

    # ── B. Node.js encoding table JSON.parse blobs ─────────────────────────
    # These are cp437/cp737/cp775/cp852/etc. character encoding tables inlined
    # by Turbopack from the Node.js `encoding` module. Unnecessary on CF Workers
    # which handles text natively.  Each blob is 40KB-395KB source.
    #
    # Signature: JSON.parse('[[[0,NUM],"unicode-range"],...')
    #            or   JSON.parse('[[[0,127],["8140","char",62],...')
    p = re.compile(
        r'JSON\.parse\(\'\'\[\['  # JSON.parse('[[[0,
        r'[0-9]+,\s*[0-9]+\]'   # 0,44]
        r'[^\]]{500,}\'\'\)',    # very long content then ''])
        re.DOTALL,
    )
    content, n = p.subn("JSON.parse('[]')", content)
    stats['encoding_tables'] = n

    # Second encoding table format: JSON.parse('[["0","",N],["8140","一"...])  (no triple brackets)
    p = re.compile(
        r'JSON\.parse\(\'\[\['  # JSON.parse('[[
        r'[^"]{200,}\'\]\)',   # long content then '])
        re.DOTALL,
    )
    content, n = p.subn("JSON.parse('[]')", content)
    stats['encoding_tables_v2'] = n

    # ── C. Debug query-param overrides (source-map artifacts) ──────────────
    # Lines like: sourceMapURL in URL for debug-bundle rewriting
    p = re.compile(r'sourceMappingURL\s*=', re.IGNORECASE)
    content, n = p.subn('REMOVED_sourceMapURL=', content)
    stats['sourcemap_urls'] = n

    stats['total_hits'] = sum(v for k, v in stats.items() if isinstance(v, int))
    stats['bytes_saved'] = len(orig) - len(content)
    return content, stats


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else '.open-next/server-functions/default/handler.mjs'
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        original = f.read()

    updated, stats = strip(original)

    if updated != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(updated)

    src_bytes = len(updated.encode('utf-8'))
    gzip_est = round(src_bytes * 0.35)

    print("=== surgical-strip-v3 stats ===")
    for k, v in stats.items():
        if k not in ('bytes_saved', 'total_hits'):
            print(f"  {k}: {v}")
    print(f"  total_hits: {stats['total_hits']}")
    print(f"  bytes_saved: {stats['bytes_saved']:,}")
    print(f"  source_bytes: {src_bytes:,}")
    print(f"  gzip_estimate: ~{gzip_est:,}")
    print(f"  hard_limit: {HARD_LIMIT:,}")
    print(f"  status: {'✅ UNDER LIMIT' if gzip_est < HARD_LIMIT else f'⚠ still {gzip_est - HARD_LIMIT:,} over'}")


if __name__ == '__main__':
    main()
