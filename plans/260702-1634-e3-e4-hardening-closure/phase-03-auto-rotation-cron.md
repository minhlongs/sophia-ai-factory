---
phase: 3
title: "Auto-Rotation Cron"
status: completed
effort: "~1 hr"
priority: P2
---

# Phase 3: Auto-Rotation Cron

## Overview

Add a scheduled Inngest function that automatically triggers key rotation every 90 days. The core rotation pipeline (`key.rotation.requested` event → re-encrypt job) already exists — this phase adds the auto-trigger.

## Requirements

- Inngest cron function firing every 90 days
- Check if current key version age > 90 days before triggering (skip if already rotated recently)
- Fire `key.rotation.requested` event with current version info
- Audit log all steps
- Won't duplicate rotation if cron fires during active rotation

## Architecture

```
Inngest cron: `0 0 1 */3 *` (1st of every 3rd month)
  → step.run: check key_versions for latest version
    ├── age < 90 days → log "skipped — key version < 90 days old" → exit
    └── age >= 90 days → log "rotation due" → fire key.rotation.requested
```

## Related Code Files

- Modify: `src/forest/inngest/functions/key-rotation-reencrypt.ts` (add cron handler)
- Modify: `src/forest/inngest/functions/index.ts` (export new function if separate file)
- Read: `src/tree/inngest/client.ts` (confirm event type)

## TDD Process

1. **Write tests first** for the cron handler:
   - Cron skips rotation when key version < 90 days old
   - Cron triggers rotation when key version >= 90 days
   - Cron doesn't fire duplicate events when rotation is in progress
   - Audit log events written correctly

## Implementation Steps

1. **Decide file location:**
   - Option A: Add to `key-rotation-reencrypt.ts` as a separate exported function
   - Option B: Create new file `src/forest/inngest/functions/key-rotation-cron.ts`
   
   **Recommendation:** Option A (co-locate with rotation logic, both listen to same infra)

2. **Implement cron function:**
   ```typescript
   export const keyRotationCron = inngest.createFunction(
     { id: 'key-rotation-cron' },
     { cron: '0 0 1 */3 *' }, // Every 90 days
     async ({ step, logger }) => {
       const latestVersion = await step.run('check-latest-version', async () => {
         const db = getD1()
         const row = await db.prepare(
           'SELECT version, created_at FROM key_versions ORDER BY version DESC LIMIT 1'
         ).first<{ version: number; created_at: string }>()
         return row
       })
       
       if (!latestVersion) {
         // No key versions exist yet — log and exit
         await logAuditEvent({ action: 'key_rotation.cron_skip_no_version', ... })
         return { skipped: true, reason: 'no_key_version' }
       }
       
       const ageDays = (Date.now() - new Date(latestVersion.created_at).getTime()) / 86400000
       if (ageDays < 90) {
         await logAuditEvent({ action: 'key_rotation.cron_skip_too_young', ... })
         return { skipped: true, reason: 'too_young', ageDays }
       }
       
       // Trigger rotation
       await inngest.send({ name: 'key.rotation.requested', data: { cronTriggered: true } })
       await logAuditEvent({ action: 'key_rotation.cron_triggered', ... })
       return { skipped: false, ageDays }
     }
   )
   ```

3. **Export from index** if new file

4. **Write tests:**
   - Mock D1 response to return version created 95 days ago → verify cron fires
   - Mock D1 response to return version created 30 days ago → verify cron skips
   - Mock D1 to return null → verify cron logs "no version"

## Success Criteria

- [x] Tests pass: skip when < 90 days, fire when >= 90 days, handle no-version
- [x] Cron registered in Inngest handler
- [x] Audit log entries written for skip/trigger decisions
- [x] `npm run build` passes with 0 errors

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cron fires during active rotation | Low | Rotation is idempotent (key version + oldVersion in event) |
| Cron misses CF Workers cold start | Low | Inngest manages schedule independently of Worker lifecycle |
| 90-day hardcoded not flexible | Low | Can extract to env var later if needed |
