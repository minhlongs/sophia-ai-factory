# Phase 6: Deployment

## Context
Deploy the finished application to Vercel.

## Requirements
- **Host:** Vercel
- **Project Name:** `sophia-proposal`
- **Output:** `https://sophia-proposal.vercel.app` (or similar)

## Implementation Steps

1.  **Build Check:**
    - Run `npm run build` locally to ensure no errors.
    - Run `npm run lint` to catch issues.

2.  **Vercel Deploy:**
    - Run `vercel --prod` from the project directory.
    - (Or configure Git integration if preferred, but CLI is faster for ad-hoc).

3.  **Verification:**
    - Visit the live URL.
    - Check all links and interactive elements.
    - Check console for errors.

## Success Criteria
- [ ] Build passes locally.
- [ ] Vercel deployment success.
- [ ] Live site is functional.
