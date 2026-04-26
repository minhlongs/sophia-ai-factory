import { NextResponse } from 'next/server';
import {
  validateOpenRouter,
  validateElevenLabs,
  validateDID,
  validateHeyGen,
} from '@/lib/validation/services';

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
      return NextResponse.json(
        { valid: false, message: "App is already configured" },
        { status: 403 }
      );
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
      case 'heygen':
        result = await validateHeyGen(resolvedKey);
        break;
      case 'elevenlabs':
        result = await validateElevenLabs(resolvedKey);
        break;
      case 'd-id':
        result = await validateDID(resolvedKey);
        break;
      default:
        return NextResponse.json({ valid: false, message: "Unknown service" }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch {
    return NextResponse.json({ valid: false, message: "Internal server error" }, { status: 500 });
  }
}
