export const meta = {
  name: 'cook-phase-01-creator-gate',
  description: 'Execute Phase 1 Lower Creator Gate plan for Creator Marketplace Launch',
  phases: [
    { title: 'Scout & Plan', detail: 'Load plan, verify current implementation, identify gaps' },
    { title: 'Implementation', detail: 'Execute all 7 sub-steps from plan' },
    { title: 'Review & Test', detail: 'Code review, run tests, verify build' },
    { title: 'Finalize', detail: 'Update plan status, docs, commit' }
  ]
}

phase('Scout & Plan')

const fs = require('fs')
const planContent = fs.readFileSync(
  '/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory/plans/260703-1836-GH-3-creator-marketplace-launch/phase-01-lower-creator-gate.md',
  'utf8'
)

const currentFiles = await parallel([
  () => agent('Read page.tsx and verify hasCreatorAccess import and MASTER gate logic', { label: 'page-tsx', phase: 'Scout & Plan' }),
  () => agent('Read actions.ts and verify MASTER gate logic', { label: 'actions-ts', phase: 'Scout & Plan' }),
  () => agent('Read new/page.tsx and [id]/page.tsx for MASTER gates', { label: 'new-id-pages', phase: 'Scout & Plan' }),
  () => agent('Check beta-invites.ts for isBetaInviteApproved function', { label: 'beta-invites', phase: 'Scout & Plan' }),
  () => agent('Check creator-access.ts location and exports', { label: 'creator-access', phase: 'Scout & Plan' }),
  () => agent('Check land/sop-marketplace/index.ts exports', { label: 'index-exports', phase: 'Scout & Plan' }),
  () => agent('Check if user_beta_invites migration exists in migrations/', { label: 'migration', phase: 'Scout & Plan' })
])

const analysis = await agent('Analyze plan vs current. Plan: ' + planContent.slice(0, 3000) + '\nCurrent: ' + JSON.stringify(currentFiles.map(f => f?.content || f), null, 2).slice(0, 5000) + '\nIdentify: what is done, missing, exact files to modify', { label: 'gap-analysis', phase: 'Scout & Plan' })

phase('Implementation')

const implResults = await parallel([
  () => agent('Step 1.1: Create DB migration NNNN_user_beta_invites.sql for user_beta_invites table', { label: 'migration', phase: 'Implementation' }),
  () => agent('Step 1.2: Ensure isBetaInviteApproved in beta-invites.ts is exported', { label: 'beta-invites-func', phase: 'Implementation' }),
  () => agent('Step 1.3: Create/move creator-access.ts to land/sop-marketplace/creator-access.ts with hasCreatorAccess', { label: 'creator-access-helper', phase: 'Implementation' }),
  () => agent('Step 1.4: Update land/sop-marketplace/index.ts to export hasCreatorAccess and isBetaInviteApproved', { label: 'index-exports', phase: 'Implementation' }),
  () => agent('Step 1.5: Update page.tsx - replace MASTER gate with hasCreatorAccess, show "Become a Creator" CTA', { label: 'page-tsx', phase: 'Implementation' }),
  () => agent('Step 1.6: Update actions.ts - replace MASTER gate with hasCreatorAccess, return error object', { label: 'actions-ts', phase: 'Implementation' }),
  () => agent('Step 1.7: Update new/page.tsx - replace MASTER gate with hasCreatorAccess, redirect to /dashboard/sop-creator', { label: 'new-page', phase: 'Implementation' }),
  () => agent('Step 1.8: Update [id]/page.tsx - replace MASTER gate with hasCreatorAccess (4th gate)', { label: 'id-page', phase: 'Implementation' }),
  () => agent('Step 1.9: Create apply/page.tsx - "