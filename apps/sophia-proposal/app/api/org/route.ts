import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, createOrganization, getUserOrganization } from "@/lib/db/auth";
import { createOrgSchema } from "@/lib/validators/org";

// API routes are dynamic by default
export const dynamic = "force-dynamic";

/**
 * GET /api/org
 * Get the current user's organization
 */
export async function GET(request: NextRequest) {
  try {
    // Get user from cookies
    const cookie = request.headers.get("cookie") || "";
    const user = await getCurrentUser(cookie);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's organization
    const org = await getUserOrganization(user.id);

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      role: org.role,
    });
  } catch (e) {
    console.error("Get org error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/org
 * Create a new organization for the current user
 */
export async function POST(request: NextRequest) {
  try {
    // Get user from cookies
    const cookie = request.headers.get("cookie") || "";
    const user = await getCurrentUser(cookie);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Validate input
    const body = await request.json();
    const validatedData = createOrgSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: validatedData.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { name, slug } = validatedData.data;

    // Create organization
    const { orgId, error } = await createOrganization(user.id, name, slug);

    if (error || !orgId) {
      return NextResponse.json(
        { error: error || "Failed to create organization" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        id: orgId,
        name,
        slug,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("Create org error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
