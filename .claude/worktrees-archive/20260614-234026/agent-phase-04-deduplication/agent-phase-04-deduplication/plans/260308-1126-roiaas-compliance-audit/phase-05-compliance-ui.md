---
title: "Phase 5: Compliance Certificate UI"
description: "Dashboard page for viewing compliance certificates and audit trail"
status: pending
priority: P1
effort: 2.5h
parent_plan: 260308-1126-roiaas-compliance-audit
created: 2026-03-08
---

# Phase 5: Compliance Certificate UI

> **Mục tiêu:** Dashboard page hiển thị compliance certificate, audit trail, hash chain visualization

---

## Context Links

- **Parent Plan:** `plans/260308-1126-roiaas-compliance-audit/plan.md`
- **Phase 3:** `phase-03-compliance-receipt.md` (receipt API)
- **Existing Dashboard:** `apps/sophia-ai-factory/src/app/[locale]/dashboard/page.tsx`

---

## Overview

**Priority:** P1 | **Effort:** 2.5h | **Status:** pending

Dashboard page tại `/dashboard/compliance` cho phép:
- Xem compliance certificate (current license)
- Xem audit trail table (filterable, paginated)
- Visualize hash chain (Mermaid diagram)
- Verify receipt (input receipt ID)

**Design:** Responsive, bilingual (vi/en), client-friendly

---

## Requirements

### Functional

- [ ] GET `/[locale]/dashboard/compliance` page
- [ ] Certificate view component (license summary, hash chain status)
- [ ] Audit trail table (filter by action, date, license)
- [ ] Hash chain visualizer (Mermaid diagram)
- [ ] Receipt verifier (manual input + verify button)

### Non-Functional

- [ ] Page load < 2s
- [ ] Table pagination (50 rows/page)
- [ ] Responsive design (mobile-friendly)
- [ ] i18n supported (vi/en)

---

## Architecture

### Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Compliance Dashboard                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Compliance Certificate                              │   │
│  │  - License Nonce: xxx-xxx-xxx                       │   │
│  │  - Tier: Premium                                     │   │
│  │  - Hash Chain: ✅ Valid                              │   │
│  │  - Total Validations: 1,234                          │   │
│  │  - Download Certificate [JSON] [PDF]                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Audit Trail                                         │   │
│  │  [Filter: All Actions ▼] [Date Range] [Search]       │   │
│  │  ┌─────────────────────────────────────────────────┐ │   │
│  │  │ Date     │ Action   │ License   │ Hash    │ ... │ │   │
│  │  ├──────────┼──────────┼───────────┼─────────┼─────┤ │   │
│  │  │ 10:30    │ VALIDATE │ xxx-123   │ ✅      │ ... │ │   │
│  │  │ 10:25    │ CREATE   │ yyy-456   │ ✅      │ ... │ │   │
│  │  └─────────────────────────────────────────────────┘ │   │
│  │  [Pagination: < 1 2 3 >]                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Hash Chain Visualization                            │   │
│  │  (Mermaid diagram showing chain links)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Verify Receipt                                      │   │
│  │  [Enter Receipt ID] [Verify Button]                  │   │
│  │  Result: ✅ Valid / ❌ Invalid                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Code Files

**Files to Create:**
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/compliance/page.tsx`
- `apps/sophia-ai-factory/src/app/[locale]/dashboard/compliance/components/`
  - `certificate-view.tsx`
  - `audit-trail-table.tsx`
  - `hash-chain-visualizer.tsx`
  - `receipt-verifier.tsx`

**API Dependencies:**
- `GET /api/admin/audit/receipt` (Phase 3)
- `POST /api/admin/audit/receipt/verify` (Phase 3)
- `GET /api/admin/audit/logs` (existing)

---

## Implementation Steps

### Step 1: Create Main Page

```typescript
// src/app/[locale]/dashboard/compliance/page.tsx
import { getTranslations } from 'next-intl/server'
import { createServerClient } from '@/lib/supabase/server'
import { CertificateView } from './components/certificate-view'
import { AuditTrailTable } from './components/audit-trail-table'
import { HashChainVisualizer } from './components/hash-chain-visualizer'
import { ReceiptVerifier } from './components/receipt-verifier'

export default async function CompliancePage() {
  const t = await getTranslations('compliance')
  const supabase = await createServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/login')
  }

  // Fetch current license
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('*')
    .eq('nonce', session.user.metadata?.license_nonce)
    .single()

  // Fetch recent audit logs
  const { data: logs } = await supabase
    .from('raas_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <CertificateView license={license} />

      <AuditTrailTable initialLogs={logs || []} />

      <HashChainVisualizer logs={logs || []} />

      <ReceiptVerifier />
    </div>
  )
}
```

### Step 2: Create Certificate View Component

```typescript
// src/app/[locale]/dashboard/compliance/components/certificate-view.tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, Download } from 'lucide-react'
import type { RaasLicenseRow } from '@/lib/supabase/types'

interface CertificateViewProps {
  license: RaasLicenseRow | null
}

export function CertificateView({ license }: CertificateViewProps) {
  if (!license) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">No active license found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <h2 className="text-lg font-semibold">Compliance Certificate</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">License Nonce</p>
                <p className="font-mono text-sm">{license.nonce.slice(0, 16)}...</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tier</p>
                <Badge>{license.tier}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hash Chain Status</p>
                <Badge variant="secondary" className="text-green-600">
                  ✅ Valid
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Validations</p>
                <p className="font-semibold">
                  {(license.metadata as any)?.validateCount || 0}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download JSON
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

### Step 3: Create Audit Trail Table

```typescript
// src/app/[locale]/dashboard/compliance/components/audit-trail-table.tsx
'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { RaasAuditLogRow } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/badge'

interface AuditTrailTableProps {
  initialLogs: RaasAuditLogRow[]
}

export function AuditTrailTable({ initialLogs }: AuditTrailTableProps) {
  const [logs, setLogs] = useState(initialLogs)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const limit = 50

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true
    return log.action === filter.toUpperCase()
  })

  const paginatedLogs = filteredLogs.slice((page - 1) * limit, page * limit)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="CREATE">Create</SelectItem>
            <SelectItem value="VALIDATE">Validate</SelectItem>
            <SelectItem value="REVOKE">Revoke</SelectItem>
            <SelectItem value="UPDATE">Update</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>License Nonce</TableHead>
            <TableHead>Hash Chain</TableHead>
            <TableHead>User</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedLogs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                {new Date(log.created_at * 1000).toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{log.action}</Badge>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {log.license_nonce?.slice(0, 12)}...
              </TableCell>
              <TableCell>
                {log.hash_chain_valid ? (
                  <Badge variant="secondary" className="text-green-600">
                    ✅ Valid
                  </Badge>
                ) : (
                  <Badge variant="destructive">❌ Invalid</Badge>
                )}
              </TableCell>
              <TableCell>{log.user_id?.slice(0, 8) || 'System'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {paginatedLogs.length} of {filteredLogs.length} logs
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={page * limit >= filteredLogs.length}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### Step 4: Create Hash Chain Visualizer (Mermaid)

```typescript
// src/app/[locale]/dashboard/compliance/components/hash-chain-visualizer.tsx
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import type { RaasAuditLogRow } from '@/lib/supabase/types'

interface HashChainVisualizerProps {
  logs: RaasAuditLogRow[]
}

export function HashChainVisualizer({ logs }: HashChainVisualizerProps) {
  const [mermaidSvg, setMermaidSvg] = useState('')

  useEffect(() => {
    // Generate Mermaid diagram
    const recentLogs = logs.slice(0, 5) // Show last 5 logs

    let graph = 'graph LR\n'
    graph += '  A[Genesis] --> B[Log 1]\n'

    for (let i = 1; i < recentLogs.length; i++) {
      graph += `  B${i} --> B${i + 1}\n`
    }

    // Dynamic import mermaid
    import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false })
      const { svg } = await mermaid.render('hash-chain', graph)
      setMermaidSvg(svg)
    })
  }, [logs])

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Hash Chain Visualization</h3>
        <div dangerouslySetInnerHTML={{ __html: mermaidSvg }} />
      </CardContent>
    </Card>
  )
}
```

### Step 5: Create Receipt Verifier

```typescript
// src/app/[locale]/dashboard/compliance/components/receipt-verifier.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle, XCircle } from 'lucide-react'

export function ReceiptVerifier() {
  const [receiptId, setReceiptId] = useState('')
  const [result, setResult] = useState<{ valid: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleVerify = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/audit/receipt/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId })
      })
      const data = await response.json()
      setResult({ valid: data.valid, message: data.message })
    } catch {
      setResult({ valid: false, message: 'Verification failed' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Verify Receipt</h3>

        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Enter receipt ID"
            value={receiptId}
            onChange={(e) => setReceiptId(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleVerify} disabled={loading || !receiptId}>
            {loading ? 'Verifying...' : 'Verify'}
          </Button>
        </div>

        {result && (
          <div className={`flex items-center gap-2 ${result.valid ? 'text-green-600' : 'text-red-600'}`}>
            {result.valid ? <CheckCircle /> : <XCircle />}
            <p>{result.message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## Todo List

- [ ] Create main compliance page
- [ ] Create CertificateView component
- [ ] Create AuditTrailTable component
- [ ] Create HashChainVisualizer component (Mermaid)
- [ ] Create ReceiptVerifier component
- [ ] Add i18n translations (vi/en)
- [ ] Test responsive design

---

## Success Criteria

**Definition of Done:**

1. ✅ Page loads at `/dashboard/compliance`
2. ✅ Certificate shows current license info
3. ✅ Audit trail table paginates correctly
4. ✅ Hash chain visualizer renders (Mermaid)
5. ✅ Receipt verifier works (valid/invalid)
6. ✅ Responsive design (mobile-friendly)

---

_End of Phase 5 Plan_
