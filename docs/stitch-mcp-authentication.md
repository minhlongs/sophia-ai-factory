# Stitch MCP Authentication Requirements

## Overview

This document details the exact authentication requirements for implementing a Stitch MCP (Model Context Protocol) server that integrates Google's AI design generation capabilities.

## Authentication Architecture

### Required Credentials

| Component | Required | Description |
|-----------|----------|-------------|
| **Client ID** | Yes | OAuth 2.0 client identifier for the MCP server application |
| **Client Secret** | Yes | OAuth 2.0 client secret for token exchange (keep confidential) |
| **Token Endpoint** | Yes | Google's OAuth 2.0 token endpoint: `https://oauth2.googleapis.com/token` |
| **Dynamic Registration** | No | Google OAuth does NOT support dynamic client registration |

### API Endpoints

The Stitch MCP server will typically interact with Google's design generation APIs:

```
OAuth 2.0 Token Endpoint: https://oauth2.googleapis.com/token
Design API Base URL: (depends on specific Google API - e.g., Vertex AI endpoint)
```

## Credential Acquisition Steps

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click project selector → "New Project"
3. Enter project name (e.g., "Stitch MCP Server")
4. Wait for project creation

### Step 2: Enable Required APIs

Enable the AI/design APIs your Stitch implementation will use:

```bash
# Common APIs for design generation:
gcloud services enable aiplatform.googleapis.com  # Vertex AI
gcloud services enable vision.googleapis.com     # Cloud Vision
```

Or via Console:
1. Navigation menu → APIs & Services → Library
2. Search for relevant APIs (Vertex AI, etc.)
3. Click "Enable"

### Step 3: Configure OAuth Consent Screen

1. Navigation menu → APIs & Services → OAuth consent screen
2. Choose User Type:
   - **External**: For users outside your organization (requires verification)
   - **Internal**: For users within your Google Workspace organization only
3. Fill required fields:
   - App name (e.g., "Stitch MCP Server")
   - User support email
   - Developer contact email
4. Add scopes (depending on API needs):
   - `https://www.googleapis.com/auth/cloud-platform`
   - `https://www.googleapis.com/auth/aiplatform`
5. Add test users if in Testing mode
6. Submit for verification if going to production (takes days/weeks)

### Step 4: Create OAuth 2.0 Client Credentials

1. APIs & Services → Credentials
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Select Application type:
   - **Web application** (if MCP server runs as web service)
   - **Desktop app** (if running locally)
   - **Other** (choose based on deployment)
4. Configure:
   - **Name**: "Stitch MCP Server"
   - **Authorized redirect URIs**: For web apps, add callback URLs
   - **Authorized JavaScript origins**: For web apps, add origins
5. Click "Create"
6. **IMPORTANT**: Copy and securely store:
   - **Client ID**: Displayed immediately
   - **Client Secret**: Click "Download JSON" or copy before leaving page

### Step 5: Alternative - Service Account (Recommended for MCP Servers)

For machine-to-machine authentication (typical for MCP servers), use service accounts:

1. IAM & Admin → Service Accounts
2. Click "Create Service Account"
3. Name: "stitch-mcp-server"
4. Grant roles:
   - `roles/aiplatform.user` (Vertex AI User)
   - `roles/aiplatform.admin` (if needing full control)
5. Click "Done"
6. Create key:
   - Select service account → "Keys" tab → "Add Key" → "Create new key"
   - Format: JSON
   - **Store the JSON file securely** - contains private key

**Service Account Benefits**:
- No user interaction required
- More secure (no client secret exposure in config)
- Fine-grained IAM permissions
- Supports workload identity federation

### Step 6: Configure MCP Server

#### Option A: OAuth 2.0 Client Credentials Flow

```typescript
// In your Stitch MCP server configuration
const config = {
  oauth: {
    clientId: process.env.STITCH_CLIENT_ID,
    clientSecret: process.env.STITCH_CLIENT_SECRET,
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/cloud-platform"]
  },
  stitchApi: {
    baseUrl: "https://YOUR_REGION-aiplatform.googleapis.com/v1/...",
    projectId: process.env.GOOGLE_CLOUD_PROJECT
  }
};
```

Token acquisition:

```typescript
async function getAccessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.STITCH_CLIENT_ID!,
      client_secret: process.env.STITCH_CLIENT_SECRET!,
      scope: "https://www.googleapis.com/auth/cloud-platform"
    })
  });
  const data = await response.json();
  return data.access_token;
}
```

#### Option B: Service Account JSON Key (Recommended)

```typescript
import { GoogleAuth } from "google-auth-library";

const auth = new GoogleAuth({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"]
});

async function getAccessToken(): Promise<string> {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}
```

### Step 7: MCP Server Configuration

Place credentials in `.opencode/.mcp.json`:

```json
{
  "mcpServers": {
    "stitch": {
      "command": "node",
      "args": ["./path/to/stitch-mcp-server.js"],
      "env": {
        "GOOGLE_CLOUD_PROJECT": "your-project-id",
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json",
        "STITCH_CLIENT_ID": "your-client-id",
        "STITCH_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

**Security Notes**:
- Never commit credentials to version control
- Use environment variables or secret management
- Service account keys should be rotated regularly
- Consider using Workload Identity Federation to avoid key files entirely

## Dynamic Client Registration

**Status: NOT SUPPORTED**

Google's OAuth 2.0 implementation does **not** support Dynamic Client Registration (RFC 7591). All OAuth clients must be:
1. Pre-registered in Google Cloud Console
2. Manually configured with redirect URIs
3. Associated with a verified OAuth consent screen

For MCP server scenarios, use:
- **Service accounts** (preferred for machine-to-machine)
- **Pre-registered OAuth client** (if user-facing OAuth flow needed)

## Verification Checklist

- [ ] Google Cloud project created
- [ ] Required APIs enabled (Vertex AI, etc.)
- [ ] OAuth consent screen configured
- [ ] OAuth 2.0 client created OR service account created
- [ ] Credentials securely stored (env vars, secret manager)
- [ ] MCP server configured with credentials
- [ ] `.opencode/.mcp.json` updated with stitch server entry
- [ ] Token acquisition tested successfully
- [ ] Design API call tested with obtained token

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `invalid_client` | Verify client ID/secret match exactly |
| `invalid_grant` | Check redirect URI matches OAuth config |
| `insufficient_permissions` | Grant proper IAM roles to service account |
| `accessNotConfigured` | Enable required API in Google Cloud Console |
| Token expires quickly | Implement token caching and refresh logic |

## References

- [MCP Specification](https://modelcontextprotocol.io/specification/latest)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Authentication](https://cloud.google.com/docs/authentication)
- [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai)
