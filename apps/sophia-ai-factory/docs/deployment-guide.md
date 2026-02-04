# Sophia AI Video Factory - Deployment Guide

This guide covers the deployment of the Sophia AI Video Factory, including the frontend application, backend services (Airtable, n8n), and required environment configuration.

## 1. Prerequisites

- **Node.js**: v18 or higher (for local development/build)
- **Airtable Account**: For database
- **n8n Instance**: Self-hosted or Cloud
- **Vercel Account**: For frontend hosting
- **OpenRouter/ElevenLabs/D-ID Accounts**: For AI APIs

## 2. Environment Variables

Configure these variables in your deployment environment (Vercel Project Settings) and locally in `.env.local`.

### Core Configuration
```bash
# Admin Dashboard Authentication (Basic Auth)
ADMIN_USER=admin
ADMIN_PASS=your_secure_password

# Feature Flags (Optional - defaults in src/config/flags.ts)
NEXT_PUBLIC_FEATURE_AFFILIATE_ENGINE=true
NEXT_PUBLIC_FEATURE_ADMIN_DASHBOARD=true
```

### Backend Integration
```bash
# Airtable Configuration
# Get API Key: https://airtable.com/create/tokens (Scopes: data.records:read, data.records:write)
# Get Base ID: From Airtable URL (starts with app...)
AIRTABLE_API_KEY=pat_...
AIRTABLE_BASE_ID=app...

# n8n Webhook URLs
# These are the endpoints provided by your n8n workflow triggers
N8N_WEBHOOK_GENERATE_SCRIPT=https://n8n.yourdomain.com/webhook/generate-script
N8N_WEBHOOK_PUBLISH_VIDEO=https://n8n.yourdomain.com/webhook/publish-video
```

## 3. Database Setup (Airtable)

1. Create a new Airtable Base.
2. Create the following tables with specific columns:

**Table: Scripts**
- `Topic` (Single line text)
- `Content` (Long text)
- `Status` (Single select: draft, generated, voice_ready, video_ready, published)
- `Tier` (Single select: BASIC, PREMIUM, ENTERPRISE)
- `UserId` (Single line text)
- `AudioUrl` (URL)
- `VideoUrl` (URL)
- `CreatedAt` (Date)
- `UpdatedAt` (Date)

**Table: Videos**
- `ScriptId` (Link to Scripts)
- `VideoUrl` (URL)
- `Platform` (Single select: youtube, tiktok)
- `Status` (Single select: processing, completed, failed)
- `StatsViews` (Number)

**Table: Affiliates**
- `Name` (Single line text)
- `Category` (Single select)
- `Commission` (Single line text)
- `Link` (URL)
- `Tier` (Single select)

## 4. Automation Setup (n8n)

1. Import the workflow JSON files from `workflows/` directory into your n8n instance.
2. Configure credentials in n8n for:
   - OpenRouter (OpenAI compatible)
   - ElevenLabs
   - D-ID
   - YouTube/Google
3. Update the Webhook nodes to "Production" URL mode.
4. Copy the production webhook URLs to your Vercel environment variables (`N8N_WEBHOOK_...`).

## 5. Frontend Deployment (Vercel)

1. Push code to GitHub.
2. Import project into Vercel.
3. Configure **Build Settings**:
   - Framework Preset: Next.js
   - Build Command: `npm run build`
4. Add Environment Variables from Section 2.
5. Deploy.

## 6. Verification

After deployment, run the `verify-env.js` script (if configured) or manually check:
1. **Public Pages**: Visit `/` and `/affiliate-discovery`.
2. **Admin Access**: Visit `/admin`, login, and check if stats load (verifies server actions).
3. **Automation**: Go to `/dashboard`, submit a new project, and check Airtable for the new record.

## 7. Troubleshooting

- **Airtable Error**: Check API Key scopes and Base ID. Ensure table names match exactly.
- **n8n Error**: Verify webhook URLs are reachable and method is POST.
- **Build Error**: Check `npm run lint` locally.
