---
description: 📋 Config Lint — YAML/JSON/TOML Validation, Schema Check
argument-hint: [--fix] [--strict]
---

**Think harder** để config lint: <$ARGUMENTS>

**IMPORTANT:** Config files PHẢI valid syntax, schema-compliant.

## YAML Lint

```bash
# === Install yamllint ===
pip install yamllint

# === Lint YAML ===
yamllint config.yaml
yamllint -d relaxed config.yaml

# === Fix YAML ===
python -c "import yaml; yaml.safe_load(open('config.yaml'))"

# === CI/CD Check ===
yamllint -f github .
```

## JSON Lint

```bash
# === Validate JSON ===
jq . config.json > /dev/null
python -m json.tool config.json

# === Format JSON ===
jq . config.json > config.formatted.json
mv config.formatted.json config.json

# === Node.js ===
node -e "JSON.parse(require('fs').readFileSync('config.json'))"
```

## TOML Lint

```bash
# === Install toml-cli ===
npm install -g @iarna/toml-cli

# === Validate TOML ===
toml get config.toml someKey

# === Python ===
python -c "import toml; toml.load('config.toml')"
```

## Config Schema Validation

```json
// config-schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["app", "database"],
  "properties": {
    "app": {
      "type": "object",
      "required": ["name", "version"],
      "properties": {
        "name": { "type": "string" },
        "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" }
      }
    },
    "database": {
      "type": "object",
      "required": ["host", "port"],
      "properties": {
        "host": { "type": "string" },
        "port": { "type": "integer", "minimum": 1, "maximum": 65535 }
      }
    }
  }
}
```

## Related Commands

- `/env-validate` — Environment validation
- `/lint` — Code linting
- `/type-check` — Type checking
