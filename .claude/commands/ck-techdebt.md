# /techdebt - Technical Debt Scanner

Scan and clean duplicated or messy code at session end.

## Usage

```
/techdebt [path]
```

## What It Does

1. **Scan for tech debt:**
   - TODO/FIXME comments
   - console.log statements
   - @ts-ignore directives
   - any types
   - Duplicated code patterns

2. **Report findings:**

   ```
   ## Tech Debt Report
   - [ ] 5 TODO comments found
   - [ ] 3 console.log remaining
   - [ ] 2 any types
   ```

3. **Auto-fix safe issues:**
   - Remove console.log
   - Replace simple any types
   - Update imports

## Commands

```bash
# Full scan
/techdebt src/

# Scan specific component
/techdebt src/components/

# Fix mode
/techdebt src/ --fix
```

## Verification

```bash
grep -r "console\." src --include="*.ts" --include="*.tsx" | wc -l
grep -r "TODO\|FIXME" src | wc -l
grep -r ": any" src --include="*.ts" --include="*.tsx" | wc -l
```

## Best Practice

Run at end of every session before committing:

```
/techdebt src/ --fix && git add -A && git commit
```
