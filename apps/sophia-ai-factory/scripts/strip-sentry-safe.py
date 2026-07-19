"""Post-build: strip exactly the phantom-import.mjs stub entries from handler.mjs.

The phantom-import.mjs exports 3 sentry-related properties consumed by Turbopack:
- `format`   (JSON.stringify wrapper)
- `flatten`  (array flattener)
- `maybeDevice` (boolean: false)

These appear inside `Object.defineProperties(inst, { ... })` blocks as
entries like:
    { value: <fnRef>, enumerable: false },
This script walks the file, finds those blocks, and removes ONLY the 3
sentinel properties by name — leaving all other entries intact.
No line-level scan, no whole-entry nuke, no bracket math.
"""
import re, sys, os

ENTRY_RE = re.compile(
    r'(Object\.defineProperties\()(\s*inst\s*,\s*\{)',
    re.DOTALL,
)

def strip_entries(content: str) -> str:
    """Return `content` with sentinel entries excised from every match."""
    target_keys = {'format', 'flatten', 'maybeDevice'}

    def replacer(m: re.Match) -> str:
        opening = m.group(1) + m.group(2)   # "Object.defineProperties(inst, {"
        rest = m.group(0)[len(opening):]
        # Walk through the rest looking for individual property entries:
        #   key: { value: ..., enumerable: false },\n
        #   key: value,   (bare static)
        # Block ends when we hit },) or });  — outermost pair.
        #
        # Use a simple state-machine: track `{` depth, find entries.
        depth = 0
        out: list[str] = []
        i = 0
        while i < len(rest):
            ch = rest[i]
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
            if depth <= 0 and ch == '}':
                out.append(ch)
                i += 1
                break
            # Try to match a property entry of the form:
            #   __key:\s*\{\s*value:\s*  or
            #   __key:\s*
            prop_match = re.match(
                r'([a-zA-Z_$][\w$]*)\s*:', rest[i:]
            )
            if prop_match and prop_match.group(1) in target_keys:
                # Skip this entry until we reach the next top-level key or }
                key = prop_match.group(1)
                # The entry token: key : ... (value-block or bare value)
                next_brace = rest.find('}', i)
                next_comma = rest.find(',', i)
                # Entry ends at next top-level } (i.e., brace depth returns
                # to the level of this property's op brace).  Simpler: walk
                # until the FIRST top-level '}' that also has a following ,
                # OR the first very-low-level '}' — here we rely on the
                # outer-depth reducer below to re-close the block.
                # Easier: advance past the whole value expression.
                val_start = i + prop_match.end()
                # If value is an object literal, match its braces
                v = rest[val_start:].lstrip()
                if v.startswith('{'):
                    d = 1
                    j = 1
                    while j < len(v) and d > 0:
                        if v[j] == '{':
                            d += 1
                        elif v[j] == '}':
                            d -= 1
                        j += 1
                    i = val_start + j
                elif v.startswith('['):
                    d = 1
                    j = 1
                    while j < len(v) and d > 0:
                        if v[j] == '[':
                            d += 1
                        elif v[j] == ']':
                            d -= 1
                        j += 1
                    i = val_start + j
                else:
                    # Bare value — advance to next comma at same depth
                    j = val_start
                    d = 0
                    while j < len(rest):
                        if rest[j] == '(' or rest[j] == '[' or rest[j] == '{':
                            d += 1
                        elif rest[j] == ')' or rest[j] == ']' or rest[j] == '}':
                            d = max(0, d - 1)
                        elif rest[j] == ',' and d == 0:
                            i = j + 1
                            break
                        j += 1
                    else:
                        i = j
                continue   # don't append — we removed this entry
            # Not a target — keep
            out.append(ch)
            i += 1
        out.append('}')   # block closer
        return opening + ''.join(out)

    return ENTRY_RE.sub(replacer, content)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else \
        '.open-next/server-functions/default/handler.mjs'
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        original = f.read()
    updated = strip_entries(original)
    changed = updated != original
    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(updated)
    src_bytes = len(updated.encode('utf-8'))
    gzip_est = src_bytes * 0.35  # rough upper-bound on gzip ratio
    under = 'YES' if gzip_est < 9_476_736 else 'NO'
    print(f'changed={changed}')
    print(f'source_bytes={src_bytes:,}')
    print(f'gzip_estimate={gzip_est:,.0f}')
    print(f'under_limit={under}')

if __name__ == '__main__':
    main()
