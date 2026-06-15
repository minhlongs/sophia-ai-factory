import json, re

with open('messages/en.json') as f: en = json.load(f)
with open('messages/vi.json') as f: vi = json.load(f)

def find_untranslated(d_en, d_vi, prefix=''):
    result = []
    for k, v in d_vi.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            result.extend(find_untranslated(d_en.get(k, {}), v, full_key))
        else:
            # Check if vi value equals en value (case-sensitive exact match)
            en_val = d_en.get(k, '')
            if v == en_val and v.strip():
                result.append((full_key, v))
    return result

untranslated = find_untranslated(en, vi)
print(f'Total untranslated: {len(untranslated)}')
for k, v in untranslated:
    print(f'{k}|{v}')
