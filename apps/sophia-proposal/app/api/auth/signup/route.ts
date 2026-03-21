import { NextRequest, NextResponse } from "next/server";
import { signUp } from "@/lib/db/auth";
import { signUpSchema } from "@/lib/validators/auth";

// API routes are dynamic by default
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signup
 * Create a new user account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
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

    // Sign up user
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

    // Success - return user + JWT token
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
    console.error("Signup error:", e);
    return NextResponse.json(
      {
        user: null,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
