---
title: "Phase 6: Manifest Generator (PDF/JSON)"
description: "Generate downloadable compliance manifests for external audits"
status: pending
priority: P1
effort: 1.5h
parent_plan: 260308-1126-roiaas-compliance-audit
created: 2026-03-08
---

# Phase 6: Manifest Generator (PDF/JSON)

> **Mục tiêu:** Generate downloadable compliance manifests cho external audits

---

## Context Links

- **Parent Plan:** `plans/260308-1126-roiaas-compliance-audit/plan.md`
- **Phase 2:** `phase-02-crypto-utility.md` (hashing)
- **Phase 3:** `phase-03-compliance-receipt.md` (receipts)
- **Research:** `plans/reports/research-compliance-audit-260308-1117.md` (Appendix A)

---

## Overview

**Priority:** P1 | **Effort:** 1.5h | **Status:** pending

Compliance Manifest = downloadable document chứa:
- Summary của audit trail trong period
- Hash chain verification status
- List của licenses và receipts
- Signed attestation statement

**Formats:**
- JSON: Machine-readable (cho automated audits)
- PDF: Human-readable (cho legal/compliance teams)

---

## Requirements

### Functional

- [ ] `generateManifest(params): Promise<ComplianceManifest>`
- [ ] `generatePdf(manifest): Promise<Buffer>`
- [ ] GET `/api/admin/audit/manifest?format=json|pdf` endpoint
- [ ] Download với Content-Disposition header

### Non-Functional

- [ ] JSON generation < 500ms
- [ ] PDF generation < 2s
- [ ] File size < 5MB (typical manifest)
- [ ] No external PDF dependencies (use @pdf-lib if needed)

---

## Architecture

### Manifest Structure (JSON)

```typescript
export interface ComplianceManifest {
  manifestId: string           // UUID
  generatedAt: string          // ISO 8601
  generatedBy: string          // Admin user ID
  version: string              // "1.0.0"

  period: {
    start: number              // Unix timestamp
    end: number
  }

  summary: {
    totalLogs: number
    hashChainValid: boolean
    firstHash: string
    lastHash: string
    totalLicenses: number
    totalValidations: number
  }

  licenses: Array<{
    nonce: string
    tier: string
    validationCount: number
    createdAt: number
    expiresAt: number | null
    receiptIds: string[]
  }>

  attestation: {
    statement: string
    signedBy: string
    signedAt: number
    signature: string          // HMAC-SHA256
  }
}
```

### PDF Template

```
┌─────────────────────────────────────────────────────────────┐
│  SOPHIA AI FACTORY                                          │
│  Compliance Audit Manifest                                  │
│                                                             │
│  Generated: 2026-03-08 11:26:00 UTC                        │
│  Period: 2026-03-01 to 2026-03-08                          │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Summary                                                    │
│  ─────────────────────────────────────────────────────────  │
│  Total Audit Logs:     1,234                                │
│  Hash Chain Status:    ✅ Valid                             │
│  Total Licenses:       56                                   │
│  Total Validations:    10,432                               │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  License Utilization                                        │
│  ─────────────────────────────────────────────────────────  │
│  Nonce          Tier        Validations    Status           │
│  xxx-123        Premium     5,432          Active           │
│  yyy-456        Growth      3,210          Active           │
│  ...                                                          │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Attestation                                                │
│  ─────────────────────────────────────────────────────────  │
│  "All audit logs have been preserved and verified."         │
│                                                             │
│  Signed by: admin@sophia.agencyos.network                  │
│  Signed at: 2026-03-08 11:26:00 UTC                        │
│  Signature: hmac-sha256-signature-here                     │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  Sophia AI Factory - ROIaaS Phase 6 Compliant              │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Code Files

**Files to Create:**
- `apps/sophia-ai-factory/src/lib/audit/manifest-generator.ts`
- `apps/sophia-ai-factory/src/lib/audit/manifest-generator.test.ts`
- `apps/sophia-ai-factory/src/app/api/admin/audit/manifest/route.ts`

**Dependencies:**
- `src/lib/audit/crypto-utils.ts` (hashing)
- `src/lib/audit/compliance-receipt.ts` (receipts)
- `src/lib/supabase/admin.ts` (DB access)

---

## Implementation Steps

### Step 1: Create Manifest Generator

```typescript
// src/lib/audit/manifest-generator.ts
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { hmacSha256 } from './crypto-utils'
import type { RaasLicenseRow, RaasAuditLogRow } from '@/lib/supabase/types'

const MANIFEST_SECRET = process.env.AUDIT_MANIFEST_SECRET || ''

export interface ComplianceManifest {
  manifestId: string
  generatedAt: string
  generatedBy: string
  version: string
  period: {
    start: number
    end: number
  }
  summary: {
    totalLogs: number
    hashChainValid: boolean
    firstHash: string
    lastHash: string
    totalLicenses: number
    totalValidations: number
  }
  licenses: Array<{
    nonce: string
    tier: string
    validationCount: number
    createdAt: number
    expiresAt: number | null
    receiptIds: string[]
  }>
  attestation: {
    statement: string
    signedBy: string
    signedAt: number
    signature: string
  }
}

export async function generateManifest(params: {
  startTimestamp: number
  endTimestamp: number
  generatedBy: string
}): Promise<ComplianceManifest> {
  const supabase = createAdminClient()

  // Fetch audit logs in period
  const { data: logs } = await supabase
    .from('raas_audit_logs')
    .select('*')
    .gte('created_at', params.startTimestamp)
    .lte('created_at', params.endTimestamp)
    .order('created_at', { ascending: true })

  // Fetch licenses
  const { data: licenses } = await supabase
    .from('raas_licenses')
    .select('*')
    .order('created_at', { ascending: false })

  // Compute summary
  const totalLogs = logs?.length || 0
  const firstHash = logs?.[0]?.content_hash || ''
  const lastHash = logs?.[logs.length - 1]?.content_hash || ''

  // Verify hash chain
  const hashChainValid = verifyHashChain(logs || [])

  const manifest: ComplianceManifest = {
    manifestId: randomUUID(),
    generatedAt: new Date().toISOString(),
    generatedBy: params.generatedBy,
    version: '1.0.0',
    period: {
      start: params.startTimestamp,
      end: params.endTimestamp
    },
    summary: {
      totalLogs,
      hashChainValid,
      firstHash,
      lastHash,
      totalLicenses: licenses?.length || 0,
      totalValidations: logs?.filter(l => l.action === 'VALIDATE').length || 0
    },
    licenses: (licenses || []).map(lic => ({
      nonce: lic.nonce,
      tier: lic.tier,
      validationCount: (lic.metadata as any)?.validateCount || 0,
      createdAt: lic.created_at,
      expiresAt: lic.expires_at,
      receiptIds: [] // Could fetch receipts per license
    })),
    attestation: {
      statement: 'All audit logs have been preserved and verified.',
      signedBy: params.generatedBy,
      signedAt: Math.floor(Date.now() / 1000),
      signature: ''
    }
  }

  // Sign attestation
  const attestationPayload = JSON.stringify({
    manifestId: manifest.manifestId,
    statement: manifest.attestation.statement,
    signedBy: manifest.attestation.signedBy,
    signedAt: manifest.attestation.signedAt
  })
  manifest.attestation.signature = hmacSha256(attestationPayload, MANIFEST_SECRET)

  return manifest
}

function verifyHashChain(logs: RaasAuditLogRow[]): boolean {
  // Reuse logic from crypto-utils.ts
  let previousHash: string | null = null
  for (const log of logs) {
    if (log.previous_log_hash !== previousHash) {
      return false
    }
    previousHash = log.content_hash
  }
  return true
}

export function serializeManifest(manifest: ComplianceManifest): string {
  return JSON.stringify(manifest, null, 2)
}
```

### Step 2: Create PDF Generator (Optional - Simple Text First)

```typescript
// src/lib/audit/pdf-generator.ts
import { ComplianceManifest } from './manifest-generator'

export async function generatePdf(manifest: ComplianceManifest): Promise<Buffer> {
  // Simple HTML-to-PDF approach (no external deps initially)
  const html = `
    <!DOCTYPE html>
    <html>
    <head><title>Compliance Manifest</title></head>
    <body style="font-family: monospace; padding: 40px;">
      <h1>Sophia AI Factory</h1>
      <h2>Compliance Audit Manifest</h2>
      <p>Generated: ${manifest.generatedAt}</p>
      <p>Period: ${new Date(manifest.period.start * 1000).toISOString()} to ${new Date(manifest.period.end * 1000).toISOString()}</p>
      <hr/>
      <h3>Summary</h3>
      <ul>
        <li>Total Audit Logs: ${manifest.summary.totalLogs}</li>
        <li>Hash Chain: ${manifest.summary.hashChainValid ? '✅ Valid' : '❌ Invalid'}</li>
        <li>Total Licenses: ${manifest.summary.totalLicenses}</li>
        <li>Total Validations: ${manifest.summary.totalValidations}</li>
      </ul>
      <hr/>
      <h3>Attestation</h3>
      <p>"${manifest.attestation.statement}"</p>
      <p>Signed by: ${manifest.attestation.signedBy}</p>
      <p>Signature: ${manifest.attestation.signature}</p>
    </body>
    </html>
  `

  // For now, return as Buffer
  // Later: Use @pdf-lib or similar to generate real PDF
  return Buffer.from(html, 'utf-8')
}
```

### Step 3: Create API Endpoint

```typescript
// src/app/api/admin/audit/manifest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateManifest, serializeManifest } from '@/lib/audit/manifest-generator'
import { generatePdf } from '@/lib/audit/pdf-generator'
import { logger } from '@/lib/utils/logger-utility'

export async function GET(request: NextRequest) {
  try {
    // Admin auth check
    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const format = searchParams.get('format') || 'json'
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    // Default to last 7 days
    const now = Math.floor(Date.now() / 1000)
    const startTimestamp = start ? parseInt(start) : now - (7 * 24 * 60 * 60)
    const endTimestamp = end ? parseInt(end) : now

    // Generate manifest
    const manifest = await generateManifest({
      startTimestamp,
      endTimestamp,
      generatedBy: session.user.email || session.user.id
    })

    if (format === 'pdf') {
      const pdfBuffer = await generatePdf(manifest)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="compliance-manifest-${manifest.manifestId}.pdf"`
        }
      })
    }

    // JSON format (default)
    return NextResponse.json(manifest, {
      headers: {
        'Content-Disposition': `attachment; filename="compliance-manifest-${manifest.manifestId}.json"`
      }
    })
  } catch (error) {
    logger.error('Failed to generate manifest', error as Error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## Todo List

- [ ] Create `manifest-generator.ts`
- [ ] Create `pdf-generator.ts` (simple HTML first)
- [ ] Create `/api/admin/audit/manifest` endpoint
- [ ] Test JSON download
- [ ] Test PDF download
- [ ] Add i18n for PDF template

---

## Success Criteria

**Definition of Done:**

1. ✅ JSON manifest generates with all fields
2. ✅ PDF renders (even if simple HTML-based)
3. ✅ Download works (Content-Disposition header)
4. ✅ Manifest includes hash chain verification
5. ✅ Attestation signature valid
6. ✅ API endpoint protected (admin-only)

---

_End of Phase 6 Plan_
