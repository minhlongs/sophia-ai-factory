#!/usr/bin/env bash
################################################################################
# Sophia AI Factory — R2 to S3/B2 Mirror
# Lists objects from R2 sophia-backups and mirrors them to an off-site S3 or B2
# destination. Idempotent via local state file.
#
# Required env vars:
#   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
#   DEST_PROVIDER=s3|b2
#   S3_BUCKET (for s3) or B2_BUCKET (for b2)
# Optional:
#   SOURCE_BUCKET=sophia-backups, MIRROR_PREFIX=d1-, DRY_RUN=1, STATE_FILE=...
################################################################################

set -euo pipefail

cd "$(dirname "$0")/../.."

SOURCE_BUCKET="${SOURCE_BUCKET:-sophia-backups}"
MIRROR_PREFIX="${MIRROR_PREFIX:-d1-}"
DEST_PROVIDER="${DEST_PROVIDER:-s3}"
DRY_RUN="${DRY_RUN:-0}"
STATE_FILE="${STATE_FILE:-backups/mirror-state.jsonl}"
LOG_FILE="${LOG_FILE:-backups/mirror-$(date -u +%Y%m%d-%H%M%S).log}"
mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$STATE_FILE")"

log() {
  printf '[%s] [%s] %s\n' "$(date -u +'%Y-%m-%d %H:%M:%S')" "$1" "$2" | tee -a "$LOG_FILE"
}

require_env() {
  local name="$1" value="${!name:-}"
  if [[ -z "$value" ]]; then
    log "ERROR" "$name is required"
    exit 1
  fi
}

preflight() {
  command -v node >/dev/null 2>&1 || { log "ERROR" "node is required"; exit 1; }
  command -v npx >/dev/null 2>&1 || { log "ERROR" "npx is required"; exit 1; }
  command -v aws >/dev/null 2>&1 || { log "ERROR" "aws CLI is required"; exit 1; }
  command -v curl >/dev/null 2>&1 || { log "ERROR" "curl is required"; exit 1; }

  require_env CLOUDFLARE_ACCOUNT_ID
  require_env CLOUDFLARE_API_TOKEN

  if [[ "$DEST_PROVIDER" == "s3" ]]; then
    require_env S3_BUCKET
    log "INFO" "Destination: s3://${S3_BUCKET}/${MIRROR_PREFIX} (region: ${S3_REGION:-us-east-1})"
  elif [[ "$DEST_PROVIDER" == "b2" ]]; then
    require_env B2_BUCKET
    log "INFO" "Destination: b2://${B2_BUCKET}/${MIRROR_PREFIX} (endpoint: ${B2_ENDPOINT:-https://s3.us-west-002.backblazeb2.com})"
  else
    log "ERROR" "DEST_PROVIDER must be 's3' or 'b2'"
    exit 1
  fi

  log "INFO" "Source: r2://${SOURCE_BUCKET}/${MIRROR_PREFIX}*"
  log "INFO" "Dry run: ${DRY_RUN}"
}

list_source_objects() {
  node <<'NODE'
const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, SOURCE_BUCKET, MIRROR_PREFIX } = process.env;
(async () => {
  let cursor = '';
  for (;;) {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${SOURCE_BUCKET}/objects`);
    url.searchParams.set('prefix', MIRROR_PREFIX || '');
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` } });
    const body = await res.json();
    if (!body.success) throw new Error(JSON.stringify(body));

    for (const obj of body.result.objects || []) {
      console.log(`${obj.key}\t${obj.size}\t${obj.etag || ''}`);
    }
    if (!body.result.truncated) break;
    cursor = body.result.cursor;
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
NODE
}

state_has() {
  local key="$1" size="$2"
  [[ ! -f "$STATE_FILE" ]] && return 1
  awk -F '\t' -v k="$key" -v s="$size" '$1 == k && $2 == s { found = 1 } END { exit found ? 0 : 1 }' "$STATE_FILE"
}

copy_object() {
  local key="$1" size="$2"
  local tmp_file
  tmp_file=$(mktemp /tmp/r2-mirror-XXXXXX)

  if ! npx wrangler r2 object get "${SOURCE_BUCKET}/${key}" --remote --file "$tmp_file" >/dev/null 2>&1; then
    log "ERROR" "Failed to download ${key} from R2"
    rm -f "$tmp_file"
    return 1
  fi

  if [[ "$DEST_PROVIDER" == "s3" ]]; then
    if ! aws s3 cp "$tmp_file" "s3://${S3_BUCKET}/${key}" --region "${S3_REGION:-us-east-1}" >/dev/null 2>&1; then
      log "ERROR" "Failed to upload ${key} to S3"
      rm -f "$tmp_file"
      return 1
    fi
  else
    if ! aws --endpoint-url "${B2_ENDPOINT:-https://s3.us-west-002.backblazeb2.com}" s3 cp "$tmp_file" "s3://${B2_BUCKET}/${key}" >/dev/null 2>&1; then
      log "ERROR" "Failed to upload ${key} to B2"
      rm -f "$tmp_file"
      return 1
    fi
  fi

  rm -f "$tmp_file"
  printf '%s\t%s\t%s\t%s\n' "$key" "$size" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" >> "$STATE_FILE"
  return 0
}

main() {
  preflight

  local copied=0 skipped=0 failed=0 total=0
  local start_ts
  start_ts=$(date +%s)

  local objects_file
  objects_file=$(mktemp /tmp/r2-mirror-objects-XXXXXX)
  trap 'rm -f "$objects_file"' EXIT

  log "INFO" "Listing source objects..."
  list_source_objects > "$objects_file"
  while IFS=$'\t' read -r key size etag; do
    [[ -z "${key:-}" ]] && continue
    total=$((total + 1))

    if state_has "$key" "$size"; then
      log "INFO" "SKIP ${key} (${size} bytes)"
      skipped=$((skipped + 1))
      continue
    fi

    if [[ "$DRY_RUN" == "1" ]]; then
      log "INFO" "DRY-RUN ${key} (${size} bytes)"
      copied=$((copied + 1))
      continue
    fi

    if copy_object "$key" "$size"; then
      log "INFO" "COPIED ${key} (${size} bytes)"
      copied=$((copied + 1))
    else
      log "ERROR" "FAILED ${key} (${size} bytes)"
      failed=$((failed + 1))
    fi
  done < "$objects_file"

  local elapsed=$(( $(date +%s) - start_ts ))
  log "INFO" "Total=${total} Copied=${copied} Skipped=${skipped} Failed=${failed} Elapsed=${elapsed}s"

  if (( failed > 0 )); then
    log "ERROR" "Mirror completed with failures"
    exit 1
  fi

  log "INFO" "Mirror complete"
}

main "$@"
