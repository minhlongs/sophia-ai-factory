import { NextResponse } from 'next/server';
import {
  validateOpenRouter,
  validateElevenLabs,
  validateDID
} from '@/lib/validation/services';

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

    const body = await request.json();
    const { service, key } = body;

    if (!service || !key) {
      return NextResponse.json({ valid: false, message: "Missing service or key" }, { status: 400 });
    }

    let result;

    switch (service) {
      case 'openrouter':
        result = await validateOpenRouter(key);
        break;
      case 'elevenlabs':
        result = await validateElevenLabs(key);
        break;
      case 'd-id':
        result = await validateDID(key);
        break;
      default:
        return NextResponse.json({ valid: false, message: "Unknown service" }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch {
    return NextResponse.json({ valid: false, message: "Internal server error" }, { status: 500 });
  }
}
