import { NextRequest, NextResponse } from "next/server";
import { signIn, sendMagicLink } from "@/lib/supabase/auth";
import { signInSchema, magicLinkSchema } from "@/lib/validators/auth";

// API routes are dynamic by default
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login
 * Sign in with email/password or send magic link
 */
export async function POST(request: NextRequest) {
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
    const { user, error } = await signIn(email, password);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "Invalid email or password" },
        { status: 401 }
      );
    }

    // Return user without sensitive data
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
