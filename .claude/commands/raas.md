---
description: 🤖 AGI RaaS Command Router — chọn đúng command cho từng tình huống
argument-hint: [action-or-description]
---

**Think** để route AGI RaaS action: <action>$ARGUMENTS</action>

## Routing Matrix

Phân tích `$ARGUMENTS` và route đến command phù hợp:

| Pattern | Route | Mô tả |
|---------|-------|--------|
| bootstrap, khởi tạo, setup | `/raas:bootstrap` | Bootstrap RaaS service mới |
| bootstrap + parallel/nhanh | `/raas:bootstrap:parallel` | Bootstrap song song (fastest) |
| deploy, triển khai, ship | `/raas:deploy` | Deploy RaaS services to production |
| mission, task, dispatch | `/raas:mission` | Dispatch AGI mission qua Tôm Hùm |
| status, health, check | `/raas:status` | Health check toàn bộ RaaS stack |
| billing, pricing, MCU | `/raas:billing` | Billing integration (Polar.sh + MCU metering) |
| (unclear) | Ask user | Hỏi user chọn action |

## Quick Reference

```bash
/raas bootstrap "Algo Trading API"         # Bootstrap mới
/raas:bootstrap:parallel "Full RaaS stack" # Bootstrap song song
/raas:deploy                                # Deploy production
/raas:mission "backtest BTC/USDT RSI"      # Dispatch mission
/raas:status                                # Health check
/raas:billing setup                         # Billing setup
```

## Action

1. Phân tích `$ARGUMENTS` → match với routing matrix
2. Nếu match rõ → trigger command tương ứng với enhanced prompt
3. Nếu không rõ → `AskUserQuestion` với 4 options (bootstrap, deploy, mission, status)
