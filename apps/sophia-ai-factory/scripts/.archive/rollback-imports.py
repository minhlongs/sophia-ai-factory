import os, re, glob

root = "/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src"
keep_rules = {
    "@/land/templates/presets",
    "@/land/templates/campaign-templates",
    "@/land/features",
}
changed = 0
errors = 0

for path in glob.glob(f"{root}/**/*.ts", recursive=True) + glob.glob(f"{root}/**/*.tsx", recursive=True):
    try:
        with open(path, 'r') as f:
            content = f.read()
        # Match: from '@/seed/...', '@/tree/...', '@/forest/...', '@/land/...'
        def replacer(m):
            full = m.group(0)
            rest = m.group(1)
            candidate = f"@/lib/{rest}"
            if candidate in keep_rules or full in keep_rules:
                return full
            return f"@/lib/{rest}"
        new_content = re.sub(r"from '@/\((?:seed|tree|forest|land)\)/([^']*)'", replacer, content)
        if new_content != content:
            with open(path, 'w') as f:
                f.write(new_content)
            changed += 1
    except Exception as e:
        errors += 1
        print(f"ERROR {path}: {e}")

print(f"Changed: {changed} files, Errors: {errors}")
