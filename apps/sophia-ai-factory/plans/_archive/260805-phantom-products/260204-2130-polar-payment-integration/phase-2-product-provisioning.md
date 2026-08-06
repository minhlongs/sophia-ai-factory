# Phase 2: Product Provisioning

## Context
We need to ensure the specific one-time products exist in Polar before we can sell them.

## Overview
Create a utility script to idempotently ensure the 3 required products exist.

## Requirements
- Products to create:
  - **Starter**: $1,200 (One-time)
  - **Growth**: $2,000 (One-time)
  - **Premium**: $3,000 (One-time)
- Script should check if product exists by name before creating to avoid duplicates

## Implementation Steps
1.  **Create Script**
    - Create `scripts/setup-polar-products.ts`
    - Use `ts-node` or similar to run it (or `scripts/setup-polar.js` if easier with project setup)
    - Logic:
      - Fetch existing products
      - For each required product, check existence
      - If missing, call `polar.products.create`

2.  **Define Product Config**
    - Create constant `PRODUCT_DEFINITIONS` in the script

3.  **Run & Verify**
    - Execute script
    - Log Product IDs (needed for Phase 4 or env vars)

## Todo
- [ ] Create `scripts/setup-polar-products.ts`
- [ ] Implement idempotent creation logic
- [ ] Run script and document Product IDs

## Success Criteria
- Script runs successfully
- 3 products appear in Polar Dashboard
- Output provides Product IDs for next steps
