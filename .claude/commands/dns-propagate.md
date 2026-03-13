---
description: 🌐 DNS Propagate — DNS Check, Global Propagation, Record Validation
argument-hint: [--type=A|MX|TXT|CNAME] [--domain=example.com]
---

**Think harder** để dns propagate: <$ARGUMENTS>

**IMPORTANT:** DNS changes PHẢI verify propagation global, TTL optimization.

## DNS Check Commands

```bash
# === Query DNS Record ===
dig example.com A
dig example.com MX
dig example.com TXT
dig example.com CNAME
dig example.com NS

# === Short Format ===
nslookup example.com
host example.com

# === All Records ===
dig example.com ANY

# === Reverse DNS ===
dig -x 8.8.8.8

# === Check from Multiple Servers ===
dig @8.8.8.8 example.com
dig @1.1.1.1 example.com
dig @208.67.222.222 example.com
```

## DNS Propagation Check

```bash
#!/bin/bash
# scripts/check-dns-propagation.sh

DOMAIN=$1
TYPE=${2:-A}
RECORDS="8.8.8.8 1.1.1.1 208.67.222.222 9.9.9.9"

echo "Checking DNS propagation for $DOMAIN ($TYPE)..."
for server in $RECORDS; do
  RESULT=$(dig @$server +short $DOMAIN $TYPE)
  echo "  $server: $RESULT"
done
```

## Common DNS Records

```
; A Records
@       IN  A       192.0.2.1
www     IN  A       192.0.2.1

; CNAME
blog    IN  CNAME   example.com

; MX Records
@       IN  MX  10  mail1.example.com
@       IN  MX  20  mail2.example.com

; TXT Records (SPF)
@       IN  TXT     "v=spf1 include:_spf.google.com ~all"

; TXT Records (DKIM)
default._domainkey  IN  TXT  "v=DKIM1; k=rsa; p=MIGfMA0..."

; TXT Records (DMARC)
_dmarc  IN  TXT     "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"

; NS Records
@       IN  NS      ns1.cloudflare.com
@       IN  NS      ns2.cloudflare.com
```

## Related Commands

- `/ssl-check` — SSL certificate validation
- `/deploy` — Deploy application
- `/environment-sync` — Environment sync
