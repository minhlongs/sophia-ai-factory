---
title: "Phase 3 - License Actions"
description: "Add revoke confirmation dialog with reason input"
status: completed
priority: P2
effort: 1.5h
parent: plans/260306-1228-license-management-ui/plan.md
last_updated: 2026-03-06
---

# Phase 3: License Actions

## Overview

Add revoke confirmation dialog with reason input field to improve audit trail quality.

**Status:** COMPLETE

## Context Links

- Parent Plan: `plans/260306-1228-license-management-ui/plan.md`
- License List: `src/components/admin/licenses/license-list.tsx`
- API Route: `src/app/api/admin/licenses/[id]/route.ts`
- Audit Service: `src/lib/raas-audit.ts`

## Requirements

### Functional
- Replace browser `confirm()` with custom dialog
- Add optional reason text field
- Log reason to audit trail
- Maintain existing revoke functionality

### Non-Functional
- Dialog must be accessible (keyboard navigation)
- Reason field should support multi-line text
- Action must complete within 2s

## Implementation Steps

### Step 3.1: Create Revoke Dialog Component

**File:** `src/components/admin/licenses/license-revoke-dialog.tsx`

**Features:**
- Dialog trigger button (Ban icon)
- Warning alert about immediate invalidation
- Optional reason text area
- Cancel/Revoke buttons
- Loading state during operation

**Component Props:**
```typescript
interface LicenseRevokeDialogProps {
  licenseId: string;
  onRevoke?: (id: string, reason?: string) => void;
}
```

**UI Elements:**
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="ghost" size="icon">
      <Ban className="w-4 h-4 text-red-400" />
    </Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Revoke License</DialogTitle>
      <DialogDescription>
        This will immediately invalidate the license key.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4">
      <Alert variant="warning">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          User will lose access immediately after revocation.
        </AlertDescription>
      </Alert>
      <div>
        <Label>Revocation Reason (optional)</Label>
        <Textarea
          placeholder="e.g., Payment failed, Terms violation, User request..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </div>
    </div>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <Button onClick={handleRevoke} variant="destructive">
        Revoke License
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Step 3.2: Update License List Component

**File:** `src/components/admin/licenses/license-list.tsx`

**Changes:**
1. Import new dialog component
2. Replace inline revoke handler with dialog
3. Add state for revoke dialog open/close

```typescript
// Add imports
import { LicenseRevokeDialog } from './license-revoke-dialog';
import { Button } from '@/components/ui/button';
import { Ban } from 'lucide-react';

// Add state
const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
const [selectedLicenseId, setSelectedLicenseId] = useState<string | undefined>();

// Replace revoke action in dropdown
<DropdownMenuItem
  onClick={() => {
    setSelectedLicenseId(license.id);
    setRevokeDialogOpen(true);
  }}
  className="text-red-400"
>
  <Ban className="w-4 h-4 mr-2" />
  Revoke
</DropdownMenuItem>

// Add dialog render
{revokeDialogOpen && selectedLicenseId && (
  <LicenseRevokeDialog
    licenseId={selectedLicenseId}
    onRevoke={(id, reason) => {
      setRevokeDialogOpen(false);
      setSelectedLicenseId(undefined);
      handleRevoke(id, reason);
    }}
  />
)}
```

### Step 3.3: Update Revoke Handler

**File:** `src/components/admin/licenses/license-list.tsx`

**Add reason parameter:**
```typescript
const handleRevoke = async (id: string, reason?: string) => {
  try {
    const response = await fetch(`/api/admin/licenses/${id}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    if (response.ok) {
      await fetchLicenses();
      onRevoke?.(id);
    } else {
      const data = await response.json();
      alert(`Failed to revoke: ${data.error}`);
    }
  } catch (error) {
    console.error('Failed to revoke license:', error);
  }
};
```

### Step 3.4: Update API to Accept Reason

**File:** `src/app/api/admin/licenses/[id]/route.ts`

**Add to POST handler:**
```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = checkAdminAuth(request);
  if (authError) return authError;

  try {
    const { id: nonce } = await params;
    const { reason } = await request.json(); // Parse reason from body

    // ... existing license lookup ...

    // Pass reason to audit log
    await logLicenseRevocation({
      nonce,
      tier: existingLicense.tier,
      revokedBy: 'admin',
      reason: reason || undefined
    });
```

### Step 3.5: Update Audit Logging

**File:** `src/lib/raas-audit.ts`

**Current function signature already supports reason:**
```typescript
export async function logLicenseRevocation(params: {
  nonce: string;
  tier?: string;
  revokedBy?: string;
  reason?: string;  // Already exists
  ipAddress?: string;
}): Promise<void>
```

**No changes needed - reason is already optional in the function signature.**

## Success Criteria

- [x] Revoke dialog opens when clicking Revoke action
- [x] Reason text area accepts multi-line input
- [x] Reason is sent to API and stored in audit log
- [x] License list refreshes after revocation
- [x] Dialog closes after successful revocation

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dialog state stuck open | Low | Reset on close/unmount |
| Reason not saved | Medium | Verify API accepts body |
| Breaking existing revoke | High | Test without reason (backward compatible) |

## Security Considerations

- Reason field should be sanitized before storage
- Audit log must capture who revoked (admin user)
- Consider IP address logging for compliance

## Next Steps

- Phase 3 complete - Phase 4 is already complete
- All license actions implemented and tested

---

*Phase 3 created: 2026-03-06*
*Status: COMPLETED - Revoke dialog with reason input implemented*
