import { NextRequest, NextResponse } from "next/server";
import { signUp } from "@/lib/db/auth";
import { signUpSchema } from "@/lib/validators/auth";

function authConfigured(): boolean {
  return Boolean(process.env.JWT_SECRET=REDACTED);
}

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signup
 * Create a new user account
 */
export async function POST(request: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json({ user: null, error: 'Auth not configured' }, { status: 503 });
  }
  try {
    const body = await request.json();

    const validatedData = signUpSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        {
          user: null,
          error: validatedData.error.errors[0]?.message || "Invalid input",
        },
        { status: 400 }
      );
    }

    const { email, password } = validatedData.data;
    const { user, token, error } = await signUp(email, password);

    if (error || !user) {
      return NextResponse.json(
        {
          user: null,
          error: error || "Failed to create account",
        },
        { status: 400 }
      );
    }

    const response = NextResponse.json(
      {
        user: { id: user.id, email: user.email },
        token,
        error: null,
      },
      { status: 201 }
    );
    if (token) {
      response.cookies.set('auth-token', token, {
        httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60,
      });
    }
    return response;
  } catch (e) {
    return NextResponse.json(
      {
        user: null,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
