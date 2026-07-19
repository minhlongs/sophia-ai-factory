# Cross-Layer Orchestration Rule

> Khi nào hợp lệ để gọi giữa các layer ngoài thứ tự seed → tree → forest → land?

## Cho phép DUY NHẤT

**Forest → Land orchestration** (one-way only).

Ví dụ:
- `forest/inngest/functions/dunning-handler.ts` calls `land/billing/dunning-state-machine.ts`
- `forest/quota/quota-enforcer.ts` calls `land/billing/usage-aggregator.ts`
- `forest/inngest/functions/conversion-to-ledger.ts` calls `land/payouts/commission-ledger.ts`

**Lý do:** Inngest/cron/quota jobs (forest) cần dispatch business workflow (land). Đây là orchestration role của forest, không phải logic move.

## Tuyệt đối CẤM

| Direction | Lý do |
|---|---|
| `seed → tree/forest/land` | Foundational layer KHÔNG biết domain. |
| `tree → forest` | Tree là domain logic, forest là infra. Tree không gọi infra orchestrator. |
| `tree → land` | Tree không biết business workflow. |
| `land → forest` | **Sẽ tạo circular dependency.** Land được forest orchestrate, không được gọi ngược. |

## Phát hiện vi phạm

```bash
# Check forest importing land (allowed for orchestration)
grep -rn "from ['\"]@/land" src/forest/ | head

# Check land importing forest (FORBIDDEN — should return 0 results)
grep -rn "from ['\"]@/forest" src/land/

# Check tree importing land/forest (FORBIDDEN)
grep -rn "from ['\"]@/land\|from ['\"]@/forest" src/tree/
```

CI guard có thể thêm vào `.github/workflows/` hoặc pre-commit hook.

## Khi nào KHÔNG dùng cross-layer

- Nếu module của bạn cần gọi cả forest VÀ land logic → đặt nó ở forest (orchestration tự nhiên)
- Nếu logic dùng được ở 2+ domain → nâng lên seed (primitive) hoặc tree (domain reusable)
- Nếu duplicate code giữa forest/land → extract sang seed util

## Migration path nếu vi phạm

Nếu phát hiện `land/X.ts` import từ `forest/Y.ts`:
1. Xác định: Y là pure data/util? → move sang seed.
2. Y là orchestration? → invert dependency: forest gọi land qua event/inngest, không direct import.
3. Y là cross-domain logic? → extract sang seed/tree.

## Seealso

- `sophia-layer-architecture.md` — định nghĩa 4 layer
- `binh-phap-quality.md` — quality gate enforcement
