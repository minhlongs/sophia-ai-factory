# Data Ingestion Service

## Overview
The Data Ingestion Service fetches product data from affiliate networks (ClickBank, ShareASale, etc.), normalizes it, and populates the Sophia Index in Supabase.

## Architecture
- **Adapters**: Network-specific classes (`ClickbankAdapter`, `ShareasaleAdapter`) that implement `IngestionAdapter`.
- **BaseAdapter**: Handles rate limiting (Bottleneck) and database upserts.
- **Runner**: Orchestrates the ingestion process.

## Usage

### 1. Manual Trigger (Local)
You can run the ingestion script locally for testing:
```bash
# Install ts-node if not installed
npm install -g ts-node

# Run script (requires .env.local with Supabase keys)
npx ts-node scripts/manual-ingest.ts
# Or specific network
npx ts-node scripts/manual-ingest.ts clickbank
```

### 2. API Trigger
POST request to `/api/ingestion/trigger`:
```bash
curl -X POST http://localhost:3000/api/ingestion/trigger \
  -H "Content-Type: application/json" \
  -d '{"networks": ["clickbank"]}'
```

### 3. Scheduled Cron
A GitHub Action (`.github/workflows/sophia-ingestion.yml`) runs nightly at 2 AM UTC.
It calls the API endpoint protected by `CRON_SECRET`.

## Adding a New Network
1. Create `src/lib/ingestion/adapters/your-network-adapter.ts` extending `BaseAdapter`.
2. Implement `fetchProducts()`.
3. Add to `src/lib/ingestion/runner.ts`.
4. Update types in `src/lib/ingestion/types.ts`.

## Environment Variables
Required in `.env.local` (and GitHub Secrets/Vercel Env):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CRON_SECRET` (for API protection)
- `SHAREASALE_API_TOKEN` (optional)
- `SHAREASALE_API_SECRET` (optional)
- `SHAREASALE_AFFILIATE_ID` (optional)
