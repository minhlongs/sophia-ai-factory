import { NextRequest, NextResponse } from "next/server";
import { signIn, sendMagicLink } from "@/lib/db/auth";
import { signInSchema, magicLinkSchema } from "@/lib/validators/auth";

function authConfigured(): boolean {
  return Boolean(process.env.JWT_SECRET=REDACTED);
}

// API routes are dynamic by default
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * Sign in with email/password or send magic link
 */
export async function POST(request: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 503 });
  }
  try {
    const body = await request.json();
    const { magicLink } = body;

    // Magic link login
    if (magicLink) {
      const validatedData = magicLinkSchema.safeParse(body);
      if (!validatedData.success) {
        return NextResponse.json(
          { error: validatedData.error.errors[0]?.message || "Invalid email" },
          { status: 400 }
        );
      }

      const { error } = await sendMagicLink(validatedData.data.email);
      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }

      return NextResponse.json({
        message: "Magic link sent to your email",
      });
    }

    // Password login
    const validatedData = signInSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: validatedData.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { email, password } = validatedData.data;
    const { user, token, error } = await signIn(email, password);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "Invalid email or password" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      user: { id: user.id, email: user.email },
      token,
    });
    if (token) {
      response.cookies.set('auth-token', token, {
        httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60,
      });
    }
    return response;
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
