"""Analyze sentry references in handler.mjs to find strip targets."""
import re

c = open(".open-next/server-functions/default/handler.mjs").read()

# 1) Total counts
total = len(re.findall(r"sentry", c, re.IGNORECASE))
print(f"Total 'sentry' hits: {total:,}")

# 2) Find all "withSentryConfig = function" full spans (these are complete fn bodies)
entries = []
for m in re.finditer(r"\b\w\.withSentryConfig\s*=\s*function", c):
    # find matching "};"
    end = c.find("};", m.start())
    entry = c[m.start():end+2]
    entries.append((m.start(), end+2, len(entry), entry[:80]))
print(f"\nwithSentryConfig function bodies: {len(entries)}")
for start, end, size, preview in entries:
    print(f"  pos={start:>12,} bytes={size:>6,}  {preview!r}")

# 3) Check for initHub patterns
init_hub = list(re.finditer(r"initHub\s*\(", c, re.IGNORECASE))
print(f"\ninitHub calls: {len(init_hub)}")

# 4) Check for GLOBAL_OBJ.onerror assignments
onerror = list(re.findall(r"GLOBAL_OBJ\.onerror\s*=", c, re.IGNORECASE))
print(f"GLOBAL_OBJ.onerror = : {len(onerror)}")

# 5) Check for _SENTRY_INSTRUMENTED
instrumented = list(re.findall(r"__SENTRY_INSTRUMENTED__", c))
print(f"__SENTRY_INSTRUMENTED__: {len(instrumented)}")

# 6) Check for SDK_VERSION or getSentryRelease
sdk_ver = list(re.findall(r"SDK_VERSION", c))
print(f"SDK_VERSION refs: {len(sdk_ver)}")

# 7) Find the largest "sentry-dense" blocks (>5KB contiguous with sentry every 100 chars)
blocks = []
pos = 0
WINDOW = 50000
STEP = 10000
while pos < len(c) - WINDOW:
    w = c[pos:pos+WINDOW]
    n = len(re.findall(r"sentry", w, re.IGNORECASE))
    if n > 20:
        # find sub-region
        best_sub = None
        for sub_pos in range(pos, pos+WINDOW-10000, 5000):
            sub_w = c[sub_pos:sub_pos+10000]
            sub_n = len(re.findall(r"sentry", sub_w, re.IGNORECASE))
            if best_sub is None or sub_n > best_sub[0]:
                best_sub = (sub_n, sub_pos)
        if best_sub and best_sub[0] > 10:
            sn, sp = best_sub
            # find exact boundary
            s_start = sp
            while s_start > pos and len(re.findall(r"sentry", c[s_start:s_start+5000], re.IGNORECASE)) > 2:
                s_start -= 1000
            s_end = sp + 10000
            while s_end < pos + WINDOW and len(re.findall(r"sentry", c[s_end-5000:s_end], re.IGNORECASE)) > 2:
                s_end += 1000
            size = s_end - s_start
            blocks.append((size, s_start, c[s_start:s_start+100]))
    pos += STEP

blocks.sort(reverse=True)
print(f"\nTop 10 largest sentry-dense blocks:")
for size, pos, preview in blocks[:10]:
    print(f"  pos={pos:>12,} size={size:>8,}  sample: {preview}")

# 8) What routes/files reference sentry?
sentry_routes = re.findall(r'/api/dev/sentry[^"<>\s]*', c)
print(f"\nSentry route refs: {len(sentry_routes)}")
for r in set(sentry_routes):
    print(f"  {r}")
