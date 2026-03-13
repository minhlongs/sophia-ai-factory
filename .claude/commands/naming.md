---
description: 🏷️ Company & Product Naming — Generate, validate, and secure a startup name
argument-hint: [industry or product description]
---

**Think harder** để brainstorm tên startup cho: $ARGUMENTS

## Naming Frameworks

### 1. Metaphor Names
```
Concept → Natural metaphor → Brand
Fast delivery → Cheetah, Bolt, Flash
Security → Shield, Fortress, Vault
Growth → Sprout, Bloom, Ascend
```

### 2. Portmanteau (Blend)
```
Instagram = Instant + Telegram
Pinterest = Pin + Interest  
Groupon = Group + Coupon
Netflix = Net + Flicks
```

### 3. Acronym / Short Form
```
AWS = Amazon Web Services
JIRA = Japanese name for Godzilla (Gojira)
```

### 4. Invented Words
```
Spotify, Hulu, Zapier, Figma
Pattern: 2-3 syllables, easy to spell, memorable
```

## Validation Checklist

```bash
# 1. Domain check
whois <name>.com 2>/dev/null | grep -E "No match|AVAILABLE" && echo "✅ .com available" || echo "❌ .com taken"
whois <name>.io 2>/dev/null | grep -E "No match|AVAILABLE" && echo "✅ .io available" || echo "❌ .io taken"

# 2. Social handles
# Check: twitter.com/<name>, github.com/<name>, instagram.com/<name>

# 3. Trademark (US)
# Search: https://tmsearch.uspto.gov/
```

## Scoring Matrix

| Criteria | Weight | Score (1-5) |
|----------|--------|-------------|
| Easy to spell | 20% | |
| Easy to pronounce | 15% | |
| Memorable | 20% | |
| Domain available | 15% | |
| No trademark conflict | 15% | |
| Relevant to product | 10% | |
| Works internationally | 5% | |

## Process

1. **Brainstorm 20+ names** using frameworks above
2. **Score top 10** with the matrix
3. **Validate top 3**: domain, social handles, trademark
4. **Test with 5 people**: can they spell it after hearing it once?
5. **Secure**: register domain + social handles for winner

## Tools & Resources

- [Panabee](https://panabee.com/) — Name + domain search
- [NameMesh](https://www.namemesh.com/) — Domain name generator
- [Namechk](https://namechk.com/) — Social handle checker
- [BrandBucket](https://www.brandbucket.com/) — Premium names marketplace
- [Squadhelp](https://www.squadhelp.com/) — Crowdsourced naming

## Related Commands
- `/landing-page` — Build your brand page
- `/cofounder` — Find your co-founder
- `/mvp-validate` — Validate your idea
