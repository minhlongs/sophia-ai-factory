import { NextResponse } from 'next/server';
import {
  validateOpenRouter,
  validateElevenLabs,
  validateDID,
} from '@/land/validation/services';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

interface SetupVerifyPayload {
  service?: string;
  apiKey?: string;
  key?: string;
}

// POST /api/setup/verify
// Body: { service: 'openrouter' | 'heygen' | 'elevenlabs' | 'd-id', apiKey?: string, key?: string }
// Response: { valid: boolean, error?: string, info?: { name: string } }
export async function POST(request: Request) {
  try {
    // Guard: reject if app is already configured (prevent API key probing)
    const isConfigured =
      process.env.NEXT_PUBLIC_IS_CONFIGURED === "true" ||
      process.env.IS_CONFIGURED === "true";
    if (isConfigured) {
      const user = await getCurrentUser().catch(() => null);
      if (!user) {
        return NextResponse.json(
          { valid: false, message: "App is already configured" },
          { status: 403 }
        );
      }
    }

    const body = (await request.json().catch(() => ({}))) as SetupVerifyPayload;
    const { service, apiKey, key } = body;
    // Support both 'apiKey' (new RaaS spec) and 'key' (legacy setup wizard)
    const resolvedKey = apiKey ?? key;

    if (!service || !resolvedKey) {
      return NextResponse.json({ valid: false, message: "Missing service or apiKey" }, { status: 400 });
    }

    let result;

    switch (service) {
      case 'openrouter':
        result = await validateOpenRouter(resolvedKey);
        break;
      case 'elevenlabs':
        result = await validateElevenLabs(resolvedKey);
        break;
      case 'd-id':
        result = await validateDID(resolvedKey);
        break;
      case 'anthropic':
        // Basic format check: Anthropic keys start with "sk-ant-"
        if (resolvedKey.startsWith('sk-ant-')) {
          result = { valid: true, message: 'Format valid' };
        } else {
          result = { valid: false, message: 'Anthropic keys must start with sk-ant-' };
        }
        break;
      case 'muapi':
        // MuAPI keys are JWT-like; no public test endpoint — format-check only
        result = { valid: true, verified: false, message: 'Format-checked only (MuAPI has no public ping endpoint)' };
        break;
      case 'replicate':
        // Replicate keys start with 'r8_'; format-check only (no public ping endpoint)
        if (resolvedKey.startsWith('r8_')) {
          result = { valid: true, verified: false, message: 'Format valid' };
        } else {
          result = { valid: false, message: 'Replicate keys must start with r8_' };
        }
        break;
      default:
        return NextResponse.json({ valid: false, message: "Unknown service" }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch {
    return NextResponse.json({ valid: false, message: "Internal server error" }, { status: 500 });
  }
}
