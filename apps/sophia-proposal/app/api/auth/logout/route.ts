import { NextRequest, NextResponse } from "next/server";
import { signOut } from "@/lib/db/auth";
import { logoutSchema } from "@/lib/validators/auth";

// API routes are dynamic by default
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 * Sign out the current user
 */
export async function POST(request: NextRequest) {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");

    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token provided" },
        { status: 400 }
      );
    }

    // Validate token format
    const validatedData = logoutSchema.safeParse({ accessToken });
    if (!validatedData.success) {
      return NextResponse.json(
        { error: validatedData.error.errors[0]?.message || "Invalid token" },
        { status: 400 }
      );
    }

    // Sign out
    const { error } = await signOut(accessToken);

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const response = NextResponse.json({ message: "Logged out successfully" });
    response.cookies.delete('auth-token');
    return response;
  } catch (e) {
    console.error("Logout error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
