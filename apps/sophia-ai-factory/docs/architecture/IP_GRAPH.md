# IP Graph Architecture

> **Layer**: tree  
> **Module**: `src/tree/ip-graph/`  
> **Database Table**: `ip_entities`  
> **Status**: Production-ready (Phase 1)

## Purpose

The IP Graph models intellectual property as a hierarchical tree. Sophia creators build IP universes (e.g., "Eco Futures") containing worlds, series, characters, themes, and brands — all versioned and provenance-tracked.

## Hierarchy

```
IP Entity Types
├── universe      — top-level IP container (e.g., "Eco Futures")
├── world         — setting/context within universe
├── series        — episodic content series
├── character     — persona/avatar
├── theme         — recurring creative theme
└── brand         — brand identity entity
```

## Structure

Each IP entity:
- Has a `parentId` (null for universes)
- Belongs to a `workspaceId`
- Carries `metadata` (arbitrary JSON for domain-specific data)
- Has a `status` (draft / published / archived)
- Tracks `createdAt` / `updatedAt`

## Graph Operations

| Function | Purpose |
|---|---|
| `createIP(entity)` | Insert new IP entity |
| `getIP(id)` | Fetch single entity |
| `listIP(workspaceId, type?)` | List by workspace + optional type filter |
| `getIPChildren(parentId)` | Get all children of a parent (tree traversal) |
| `updateIPStatus(id, status)` | Change status (draft → published → archived) |

## Use Cases

1. **Character consistency**: Reference character IP entity when generating content → maintain voice/appearance
2. **Brand guidelines**: Store brand IP → all creative decisions inherit constraints
3. **Universe expansion**: Parent IP → child series → individual episodes (provenance chain)
4. **Theme reuse**: Extract theme from top-performing content → apply to new projects

## Integration

- **Tree → Forest**: Agent Protocol reads IP metadata before content generation
- **Tree → Provenance**: Every generated asset links back to source IP entity
- **Tree → Mission**: Missions can target a specific IP universe
- **Land**: Billing can charge per-IP-brand (multi-brand workspaces)

## See Also

- `src/seed/types/creative-domain.ts` — IP interface
- `src/tree/provenance/` — Provenance chain linking assets to IP
- `src/forest/agent-protocol/` — How agents use IP context