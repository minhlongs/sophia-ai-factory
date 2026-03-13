---
description: 🔒 SSL Check — Certificate Validation, Expiry Alerts, Chain Verification
argument-hint: [--domain=example.com] [--warn-days=30]
---

**Think harder** để ssl check: <$ARGUMENTS>

**IMPORTANT:** SSL certificates PHẢI auto-renew, monitor expiry 30 days trước.

## SSL Check Commands

```bash
# === Check Certificate Info ===
echo | openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates

# === Check Expiry Date ===
echo | openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -enddate

# === Check Full Chain ===
echo | openssl s_client -connect example.com:443 -showcerts 2>/dev/null

# === Verify Certificate ===
openssl verify -CAfile ca-bundle.crt server.crt

# === Check SSL Labs Rating ===
curl "https://api.ssllabs.com/api/v3/analyze?host=example.com"
```

## Certificate Expiry Script

```bash
#!/bin/bash
# scripts/check-ssl-expiry.sh

DOMAIN=$1
WARN_DAYS=${2:-30}

END_DATE=$(echo | openssl s_client -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
END_EPOCH=$(date -d "$END_DATE" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($END_EPOCH - $NOW_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt $WARN_DAYS ]; then
  echo "⚠️  WARNING: SSL certificate expires in $DAYS_LEFT days"
  exit 1
else
  echo "✅ SSL certificate valid for $DAYS_LEFT days"
  exit 0
fi
```

## Auto-Renew with Let's Encrypt

```bash
# === Install Certbot ===
apt-get install certbot python3-certbot-nginx

# === Obtain Certificate ===
certbot --nginx -d example.com -d www.example.com

# === Auto-renew (cron) ===
# crontab -e
0 3 * * * certbot renew --quiet --deploy-hook "systemctl reload nginx"

# === Dry Run Test ===
certbot renew --dry-run
```

## Related Commands

- `/dns-propagate` — DNS propagation check
- `/security-audit` — Security audit
- `/monitor` — System monitoring
