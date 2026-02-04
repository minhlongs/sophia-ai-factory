import { NextResponse } from 'next/server';
import {
  validateOpenRouter,
  validateElevenLabs,
  validateDID,
  validateAirtable
} from '@/lib/validation/services';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { service, key, params } = body;

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
      case 'airtable':
        result = await validateAirtable(key, params?.baseId);
        break;
      default:
        return NextResponse.json({ valid: false, message: "Unknown service" }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json({ valid: false, message: "Internal server error" }, { status: 500 });
  }
}
