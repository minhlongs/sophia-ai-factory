#!/usr/bin/env bash
# Sophia Factory — PII Scrubber (stdin → stdout)
#
# Strips secrets/PII before journal entries hit the repo.
# Pattern set aligned with Red Team #14 + agent-self-review summarizer.
#
# Usage:
#   echo "sk-abc123...xyz" | scripts/agent-journal/scrub-pii.sh
#   cat raw.md | scripts/agent-journal/scrub-pii.sh > clean.md

set -euo pipefail

# sed -E (BSD/macOS + GNU): extended regex, in-pipe substitution
# Order matters: longer patterns first so JWT not partially matched as Bearer.
# Stack-specific keys (NOWPayments live, GitHub, AWS, ElevenLabs) per Sophia BYOK
# threat model — leakage = direct revenue/account-takeover risk.
sed -E \
  -e 's/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/[REDACTED-JWT]/g' \
  -e 's/sk-[A-Za-z0-9_-]{20,}/[REDACTED-API-KEY]/g' \
  -e 's/(ghp|gho|ghs|ghr|github_pat)_[A-Za-z0-9_]{36,}/[REDACTED-GH-TOKEN]/g' \
  -e 's/AKIA[0-9A-Z]{16}/[REDACTED-AWS-KEY]/g' \
  -e 's/[A-Z0-9]{7}-[A-Z0-9]{7}-[A-Z0-9]{7}-[A-Z0-9]{7}/[REDACTED-NOWPAY-KEY]/g' \
  -e 's/(11labs_)[A-Za-z0-9]{24,}/[REDACTED-ELEVENLABS-KEY]/g' \
  -e 's/([Bb]earer|BEARER)[[:space:]]+[A-Za-z0-9._-]{16,}/\1 [REDACTED-TOKEN]/g' \
  -e 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[REDACTED-EMAIL]/g' \
  -e 's/(\+?84|0)[3-9][0-9]{8}/[REDACTED-PHONE-VN]/g' \
  -e 's/(npay-|wpc-|whsec_)[A-Za-z0-9_-]{16,}/[REDACTED-WEBHOOK-SECRET]/g'
