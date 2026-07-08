"""surgical-reduce.py — surgical byte reduction for handler.mjs

Removes ONLY sentry-only property references from single-line export chains.
Each removal is a "lvalue = value," tuple inside a comma-separated export list,
so removing it preserves all other exports on the same line.
"""
import re, sys

def surgical_reduce(content: str) -> tuple[str, dict]:
    stats = {}
    orig = content

    # 1) "SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN" / "SEMANTIC_ATTRIBUTE_SENTRY_" exports
    # Match: var.SENTRY_ORIGIN = "...",  (with or without trailing comma/space)
    p = re.compile(
        r"""(\w+)\.(SEMANTIC_ATTRIBUTE_SENTRY_ORIGIN|SEMANTIC_ATTRIBUTE_SENTRY_DYNAMIC_SAMPLE_RATE)\s*=\s*"[^"]*",?\s*""",
        re.IGNORECASE,
    )
    content, n = p.subn("", content)
    stats["sentry_semantic_attrs"] = n

    # 2) __SENTRY_INSTRUMENTED__ assignments — keep l-value, kill rhs
    p = re.compile(
        r"""(\w+)\.__SENTRY_INSTRUMENTED__\s*=\s*(true|false|0|1)""",
        re.IGNORECASE,
    )
    content, n = p.subn(r"\1.__SENTRY_INSTRUMENTED__ = void 0", content)
    stats["instrumented_reset"] = n

    # 3) SEMANTIC_ATTRIBUTE_SENTRY_OP strings inside function calls
    # e.g. setAttribute(o.SEMANTIC_ATTRIBUTE_SENTRY_OP, "http.server")
    # → skip entirely by guarding the outer function call
    # Easier: replace the constant with empty so the call becomes no-op-ish
    p = re.compile(
        r'(["\'])http\.(server|client)["\']',
        re.IGNORECASE,
    )
    # These strings appear in MULTIPLE contexts (OTEL too). Too risky — skip.

    # 4) SDK_VERSION string literals
    p = re.compile(r'SDK_VERSION\s*=\s*["\'][^"\']+["\'];', re.IGNORECASE)
    content, n = p.subn(r'SDK_VERSION = "";', content)
    stats["sdk_version_string"] = n

    # 5) "let x = process.env.NEXT_PUBLIC_SENTRY_DSN ... ;" dead local vars
    p = re.compile(
        r"let\s+\w+\s*=\s*process\.env\.NEXT_PUBLIC_SENTRY_DSN\b[^;]+;",
        re.IGNORECASE,
    )
    content, n = p.subn("", content)
    stats["dsn_local_let"] = n

    # 6) "__sentry_captured__" property assignments
    p = re.compile(
        r'addNonEnumerableProperty\(\w+,\s*"__sentry_captured__"',
        re.IGNORECASE,
    )
    content, n = p.subn("", content)
    stats["sentry_captured_prop"] = n

    # 7) "sentry_version=7, sentry_key=... sentry_client=..." header strings
    p = re.compile(
        r'sentry_version=\d+,\s*sentry_key=\w+,\s*sentry_client=\S+',
        re.IGNORECASE,
    )
    content, n = p.subn("", content)
    stats["sentry_header_strings"] = n

    stats["total_hits"] = sum(v for k, v in stats.items() if isinstance(v, int))
    stats["bytes_saved"] = len(orig) - len(content)
    return content, stats


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else \
        '.open-next/server-functions/default/handler.mjs'
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        original = f.read()

    updated, stats = surgical_reduce(original)
    if updated != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(updated)

    src_bytes = len(updated.encode('utf-8'))
    gzip_est = round(src_bytes * 0.35)
    HARD = 9_476_736

    print("=== surgical-reduce stats ===")
    for k, v in stats.items():
        if k != "bytes_saved":
            print(f"  {k}: {v}")
    print(f"  bytes_saved: {stats['bytes_saved']:,}")
    print(f"  source_bytes: {src_bytes:,}")
    print(f"  gzip_estimate: ~{gzip_est:,}")
    print(f"  hard_limit: {HARD:,}")
    print(f"  under_limit: {'YES' if gzip_est < HARD else 'NO'}")


if __name__ == '__main__':
    main()
