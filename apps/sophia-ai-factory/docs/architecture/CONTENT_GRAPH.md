# Content Graph Architecture

> **Layer**: tree  
> **Module**: `src/tree/content-graph/`  
> **Database Tables**: `content_projects`, `content_assets`, `derivative_assets`  
> **Status**: Production-ready (Phase 1)

## Purpose

Content Graph models the full lifecycle of creative production: from mission → project → asset → derivative → distribution.

## Hierarchy

```
Mission (creative-mission)
  └── ContentProject
        ├── ContentAsset[]     (raw outputs: video, image, audio, text)
        │     └── DerivativeAsset[]  (re-edits, cuts, translations, thumbnails)
        └── DistributionAsset[] (platform-specific versions)
```

## ContentProject

Top-level production container:
- Links to a mission (`missionId`) and concept (`conceptId`)
- Has format, status, budget, and cost tracking
- Tracks creator + brand ownership

## ContentAsset

Individual generated artifact:
- Links to project + agent run (provenance)
- Stores file reference (R2 path), format, duration, dimensions
- Has generation metadata (model, prompt, parameters)
- Status: draft → processing → ready → published → archived

## DerivativeAsset

Transformed version of a parent asset:
- `parentAssetId` links to source
- `derivationType`: edit | cut | translate | thumbnail | remix | format_convert
- Human edits tracked via `humanEdits` JSON array
- Approval chain via `approvalId`

## Graph Operations

| Function | Purpose |
|---|---|
| `createProject(project)` | Start new production |
| `getProject(id)` | Fetch project with assets |
| `listProjects(workspaceId, status?)` | List workspace projects |
| `updateProjectStatus(id, status)` | Transition project state |
| `createAsset(asset)` | Add asset to project |
| `getAsset(id)` | Fetch asset with derivatives |
| `listAssets(projectId)` | List all assets in project |
| `updateAssetStatus(id, status)` | Transition asset state |
| `createDerivative(parentId, derivative)` | Create derivative |
| `getDerivativesOf(assetId)` | Get all derivatives |

## Cost Tracking

- `budgetCents` on project (ceiling)
- `actualCostCents` on project + asset (accumulated)
- Generation cost recorded via AgentRun

## Integration

- **Tree → Provenance**: Every asset has a full provenance chain
- **Tree → Creative Memory**: Project learnings stored as memory
- **Forest → Agent Protocol**: Agents create assets via protocol
- **Land → Billing**: Asset costs feed usage metering

## See Also

- `src/seed/types/creative-domain.ts` — ContentProject, ContentAsset, DerivativeAsset
- `src/tree/provenance/` — Provenance chain
- `src/forest/agent-protocol/` — How agents produce assets