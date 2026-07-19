# App Docs — Sophia AI Factory (Engineering-Internal Layer)

This directory is the **engineering-internal documentation layer** for Sophia AI Factory.

**Audience:** Engineers, compliance auditors, security reviewers.
**Language:** English only.

Customer-facing and operator-facing docs live in the **root `docs/`** directory. If you're a customer or operator looking for handover guides, runbooks, or FAQs, see [`/docs/README.md`](../../docs/README.md).

---

## Scope of This Directory

Content here is NOT intended for customers. It covers:

- **Compliance evidence** — ASVS-L2 checklist, SOC2 prep materials, pentest reports
- **Migration phase notes** — per-migration implementation notes, rollback procedures
- **Load-test & performance data** — raw load-test results, benchmark data
- **Dev-SOPs** — engineering workflow procedures, deployment checklists, infra hardening
- **GO-LIVE checklist** — pre-launch gate verification
- **Advanced code standards** — patterns beyond the root code-standards.md
- **Integration configs** — NOWPayments config, GitLab migration runbook, etc.
- **Operator playbooks** — internal operator-facing procedures (not customer-facing)
- **Known issues & legacy** — issue tracker, legacy migration context

---

## Key Files

| File | Description |
|------|-------------|
| [asvs-l2-checklist.md](asvs-l2-checklist.md) | ASVS Level 2 audit — 29/31 controls pass (94%) |
| [deployment-guide.md](deployment-guide.md) | Engineering-internal deploy notes (more detail than root deployment-guide.md) |
| [deployment-checklist.md](deployment-checklist.md) | Pre-deploy gate checklist |
| [GO-LIVE-DEPLOYMENT-GUIDE.md](GO-LIVE-DEPLOYMENT-GUIDE.md) | GO-LIVE gate verification |
| [dev-sops.md](dev-sops.md) | Engineering workflow SOPs |
| [infra-hardening.md](infra-hardening.md) | Infrastructure security hardening notes |
| [load-test-260518.md](load-test-260518.md) | Load test results 2026-05-18 |
| [load-testing-runbook.md](load-testing-runbook.md) | How to run load tests |
| [nowpayments-configuration.md](nowpayments-configuration.md) | NOWPayments API + IPN configuration |
| [dr-drill-260518.md](dr-drill-260518.md) | DR drill 2026-05-18 results |
| [code-standards-advanced-patterns.md](code-standards-advanced-patterns.md) | Advanced TypeScript patterns |
| [compliance/](compliance/) | Compliance evidence package |
| [migrations/](migrations/) | Per-migration implementation notes |
| [perf/](perf/) | Performance benchmarks |

---

## Relationship to Root `docs/`

```
Root docs/                          App docs/
├── project-overview-pdr.md  ←→   (no equivalent — app-level PDR is engineering detail)
├── deployment-guide.md      ←→   deployment-guide.md (more detail here)
├── system-architecture.md   ←→   (no equivalent — system arch is root-level)
├── code-standards.md        ←→   code-standards-advanced-patterns.md (extension)
├── disaster-recovery.md     ←→   dr-drill-260518.md (evidence, not procedure)
└── ...                           ...
```

**Sync rule:** If a doc is meaningful to operators or customers → promote to root `docs/`. Engineering-internal context stays here.

---

## Deploy Doctrine Reminder

This app uses CF-direct deploy (wrangler CLI). GitHub Actions DISABLED since 2026-05-03.

```bash
git push origin main
cd apps/sophia-ai-factory && npm run deploy:full
bash scripts/apply-migrations.sh   # if migrations/ changed
curl -s https://sophia.agencyos.network/api/version | jq .shortSha  # verify SHA
```

Full sequence: `.claude/rules/sophia-deploy-verify.md`
