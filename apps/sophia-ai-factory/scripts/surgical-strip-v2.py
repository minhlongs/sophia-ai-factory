#!/usr/bin/env python3
"""surgical-strip-v2.py — targeted byte reduction for handler.mjs

Three exact patterns that match the confirmed bloat from the analysis:
  1. withSentryConfig = function(...) { ... } bodies (3 copies)
  2. require-in-the-middle-* / import-in-the-middle-* complete module blocks
  3. SUPABASE_MIGRATIONS_MANIFEST assignment line

Each pattern removes a significant chunk of dead code from the SSR handler.
"""
import re, sys, os

HARD_LIMIT = 9_476_736  # Cloudflare Workers gzip hard limit


def strip(content: str) -> tuple[str, dict]:
    stats = {}
    orig = content
    src_len = len(content)

    # ── 1. withSentryConfig wrapper bodies ──────────────────────────────────
    # These are complete Turbopack chunks that wrap Sentry sub-module init.
    # Pattern: },CHUNK_ID,(a,b,c)=>{var ...SENTRY_GLOBAL_OBJ...}; ... };
    # We match from the first opening of the wrapper to its closing },
    # identified by the presence of withSentryConfig and GLOBAL_OBJ.
    #
    # Format in handler.mjs:  },NUM,(a,b,c)=>{ ... body ... };
    p = re.compile(
        r'\},\d+,\([a-z],\s*[a-z],\s*[a-z]\)=>\{(?P<body>.*?__SENTRY_INSTRUMENTED__.*?)\};',
        re.DOTALL | re.IGNORECASE,
    )
    content, n = p.subn('}', content)
    stats['withSentryConfig_bodies'] = n

    # ── 2. require-in-the-middle / import-in-the-middle hook modules ────────
    # These are the ESM/CJS hook interposition modules Sentry v8 installs.
    # Named: require-in-the-middle-2ca7b9c2766f317e
    #        import-in-the-middle-ac114f323ad7e863
    # Pattern: the full chunk body with the long hashed name.
    p = re.compile(
        r',\d+,\(\)=>\{(?P<hook>.*?'
        r'(?:require-in-the-middle|import-in-the-middle)'
        r'-[0-9a-f]+.*?addModule.*?)\};',
        re.DOTALL | re.IGNORECASE,
    )
    content, n = p.subn('}', content)
    stats['instrumentation_hooks'] = n

    # ── 3. SUPABASE_MIGRATIONS_MANIFEST ─────────────────────────────────────
    # Sophia uses Cloudflare D1, not Supabase. This is dead code.
    # Pattern: GOD(["...,SUPABASE_MIGRATIONS_MANIFEST...], or similar
    p = re.compile(
        r'SUPABASE_MIGRATIONS_MANIFEST\s*=\s*\[.*?\];',
        re.DOTALL | re.IGNORECASE,
    )
    content, n = p.subn('', content)
    stats['supabase_migrations_manifest'] = n

    # ── 4. Sentry SDK_VERSION string literals ───────────────────────────────
    # Already exists in surgical-reduce.py, included here for self-containment.
    p = re.compile(r'SDK_VERSION\s*=\s*["\'][^"\']+["\'];', re.IGNORECASE)
    content, n = p.subn(r'SDK_VERSION = "";', content)
    stats['sdk_version_string'] = n

    # ── 5. GLOBAL_OBJ.sentry_* property assignments (literal strings) ──────
    # Example: GLOBAL_OBJ._sentryBasePath = "..."
    p = re.compile(
        r'GLOBAL_OBJ\.(?:_sentry\w+|sentry_version|sentry_key|sentry_client)\s*=\s*["\'][^"\']*["\']',
        re.IGNORECASE,
    )
    content, n = p.subn('', content)
    stats['global_obj_sentry_props'] = n

    # ── 6. addNonEnumerableProperty(inst, "__sentry_captured__") calls ──────
    p = re.compile(
        r'addNonEnumerableProperty\(\w+,\s*"__sentry_captured__"',
        re.IGNORECASE,
    )
    content, n = p.subn('', content)
    stats['sentry_captured_prop'] = n

    # ── 7. sentry_version=7, sentry_key=... header string ──────────────────
    p = re.compile(
        r'sentry_version=\d+,\s*sentry_key=\w+,\s*sentry_client=\S+',
        re.IGNORECASE,
    )
    content, n = p.subn('', content)
    stats['sentry_header_strings'] = n

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

    print("=== surgical-strip-v2 stats ===")
    for k, v in stats.items():
        if k not in ('bytes_saved', 'total_hits'):
            print(f" {k}: {v}")
    print(f" total_hits: {stats['total_hits']}")
    print(f" bytes_saved: {stats['bytes_saved']:,}")
    print(f" source_bytes: {src_bytes:,}")
    print(f" gzip_estimate: ~{gzip_est:,}")
    print(f" hard_limit: {HARD_LIMIT:,}")
    print(f" under_limit: {'YES ✓' if gzip_est < HARD_LIMIT else 'NO ⚠'}")


if __name__ == '__main__':
    main()
