#!/usr/bin/env python3
"""surgical-strip-v4.py — targeted byte reduction for handler.mjs

Targets confirmed by analysis of the 48.7MB file's gzip output:
Pattern A: SUPABASE_MIGRATIONS_MANIFEST dead-code chunk (130KB data payload)
Pattern B: SEO JSON blobs (2 x 196KB + 73KB template literals)
Pattern C: GLOBAL_OBJ.sentry_* property assignments (runtime artifacts)

3 exact regex/anchor patterns for post-build strip.
Run after every build: python3 scripts/surgical-strip-v4.py
"""
import re, sys, os, gzip

HARD_LIMIT = 9_476_736  # Cloudflare Workers gzip hard limit


def strip(content: str) -> tuple[str, dict]:
    stats = {}
    orig = content

    # ── A. SUPABASE_MIGRATIONS_MANIFEST data payload ─────────────────────
    # Turbopack chunks use uppercase V.s() for data registration.
    # The payload is a base64-encoded SQL migrations array — dead code on CF D1.
    # Strip the entire [...] data array, replace with empty [].
    idx = content.find('V.s(["SUPABASE_MIGRATIONS_MANIFEST"')
    if idx > 0:
        arr_start = content.index('[', idx)
        depth = 0
        for i in range(arr_start, min(arr_start + 200000, len(content))):
            if content[i] == '[':
                depth += 1
            elif content[i] == ']':
                depth -= 1
                if depth == 0:
                    arr_end = i
                    close = content.find(']);', arr_end)
                    if close > 0:
                        payload = content[idx:close + 3]
                        stats['supabase_data_payload'] = len(payload)
                        content = content[:idx] + 'V.s(["SUPABASE_MIGRATIONS_MANIFEST",0,[]])' + content[close + 3:]
                        break

    # ── B. SEO JSON blobs (template literals) ────────────────────────────
    # Format: JSON.parse(`{"100":"100","seo":{"home":{"title":"..."}}`)
    # These are full SEO metadata strings for all pages — dead code in SSR.
    # Anchor: the unique substring JSON.parse(`{"100":"100","seo": inside the
    # template literal — this is the start of every SEO blob.
    seo_saved = 0
    seo_count = 0
    keyword = 'JSON.parse(`{"100":"100","seo":'
    search_from = 0
    while True:
        i = content.find(keyword, search_from)
        if i < 0:
            break
        # Find closing backtick-paren: `)
        closer = content.find('`)', i)
        if closer < 0:
            search_from = i + len(keyword)
            continue
        blob = content[i:closer + 2]
        seo_saved += len(blob)
        seo_count += 1
        content = content[:i] + "JSON.parse('{}')" + content[closer + 2:]
        search_from = i + 20

    stats['seo_json_blobs'] = seo_count
    stats['seo_bytes_saved'] = seo_saved

    # ── C. GLOBAL_OBJ sentry property assignments ────────────────────────
    # Pattern: GLOBAL_OBJ.sentry_<prop> = <some_expr>;
    # These are Turbopack-chunk-local sentry config that's dead on CF Workers.
    p = re.compile(r'GLOBAL_OBJ\.sentry_\w+\s*=\s*[^;]+;')
    content, n = p.subn('', content)
    stats['sentry_prop_assignments'] = n

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
    gzip_bytes = len(gzip.compress(updated.encode('utf-8')))

    print("=== surgical-strip-v4 stats ===")
    for k, v in stats.items():
        if k not in ('bytes_saved', 'seo_bytes_saved'):
            print(f"  {k}: {v}")
    print(f"  source_bytes:    {src_bytes:,}")
    print(f"  gzip_bytes:      {gzip_bytes:,}")
    print(f"  hard_limit:      {HARD_LIMIT:,}")
    print(f"  bytes_saved:     {stats['bytes_saved']:,}")
    over = gzip_bytes - HARD_LIMIT
    if gzip_bytes < HARD_LIMIT:
        print(f"  ✅ UNDER LIMIT (safety margin: {HARD_LIMIT - gzip_bytes:,})")
    else:
        print(f"  ⚠ STILL {over:,} over limit")


if __name__ == '__main__':
    main()
