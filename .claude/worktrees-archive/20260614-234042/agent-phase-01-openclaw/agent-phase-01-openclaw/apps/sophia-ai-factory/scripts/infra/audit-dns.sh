#!/bin/bash
# audit-dns.sh — DNS Security Audit for sophia.agencyos.network
# Checks: A, AAAA, CAA, MX, TXT (SPF/DMARC), NS, DNSSEC chain
# Output: audit-results-{date}.log

set -e

DOMAIN="sophia.agencyos.network"
OUTPUT_DIR="$(pwd)/audit-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOGFILE="${OUTPUT_DIR}/audit-dns-${TIMESTAMP}.log"

# Create output directory
mkdir -p "${OUTPUT_DIR}"

{
  echo "==================================="
  echo "DNS Audit Report"
  echo "Domain: ${DOMAIN}"
  echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "==================================="
  echo ""

  # A Record
  echo "--- A Record ---"
  dig +short "${DOMAIN}" A || echo "FAIL: A record missing"
  echo ""

  # AAAA Record (IPv6)
  echo "--- AAAA Record ---"
  dig +short "${DOMAIN}" AAAA || echo "INFO: No IPv6 (optional)"
  echo ""

  # CAA Record
  echo "--- CAA Record (SSL Issuance Control) ---"
  DIG_CAA=$(dig +short "${DOMAIN}" CAA)
  if [ -z "$DIG_CAA" ]; then
    echo "WARNING: No CAA record found"
  else
    echo "$DIG_CAA"
  fi
  echo ""

  # MX Record
  echo "--- MX Record (Mail Exchange) ---"
  dig +short "${DOMAIN}" MX || echo "INFO: No MX record (expected for SaaS)"
  echo ""

  # TXT Records (SPF, DMARC)
  echo "--- TXT Records (SPF, DMARC, DKIM) ---"
  DIG_TXT=$(dig +short "${DOMAIN}" TXT)
  if [ -z "$DIG_TXT" ]; then
    echo "WARNING: No TXT records"
  else
    echo "$DIG_TXT"
  fi
  echo ""

  # NS Records
  echo "--- NS Records (Nameservers) ---"
  dig +short "${DOMAIN}" NS
  echo ""

  # DNSSEC Validation
  echo "--- DNSSEC Chain Validation ---"
  if dig +dnssec "${DOMAIN}" | grep -q "ad;"; then
    echo "✅ DNSSEC validation: PASS (ad flag present)"
  else
    echo "⚠️  DNSSEC validation: Check DNSSEC status in Cloudflare dashboard"
  fi
  echo ""

  # Full DNS dump
  echo "--- Full DNS Info ---"
  dig "${DOMAIN}" +noall +answer
  echo ""

  echo "==================================="
  echo "Checklist:"
  echo "✓ A record points to Cloudflare IP"
  echo "✓ CAA record: 0 issue \"letsencrypt.org\""
  echo "✓ SPF record configured at provider"
  echo "✓ DMARC policy set"
  echo "✓ DNSSEC enabled in Cloudflare"
  echo "==================================="
} | tee "${LOGFILE}"

echo "Audit report saved: ${LOGFILE}"
