import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/upstox-api";
import { db } from "@/db";
import { userSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/auth/token
 * Save and validate Upstox access token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, sessionId } = body;

    if (!accessToken || !sessionId) {
      return NextResponse.json(
        { error: "Access token and session ID are required" },
        { status: 400 }
      );
    }

    // Validate token with Upstox
    const isValid = await validateToken(accessToken);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid access token. Please check your Upstox access token." },
        { status: 401 }
      );
    }

    // Upsert session
    const existing = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, sessionId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userSessions)
        .set({
          accessToken,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(userSessions.sessionId, sessionId));
    } else {
      await db.insert(userSessions).values({
        sessionId,
        accessToken,
        isActive: true,
      });
    }

    return NextResponse.json({ success: true, message: "Token validated and saved" });
  } catch (error) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate token" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/token?sessionId=xxx
 * Check if session has a valid token
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ authenticated: false });
    }

    const sessions = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, sessionId))
      .limit(1);

    if (sessions.length === 0 || !sessions[0].isActive) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true });
  } catch (error) {
    console.error("Token check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}

/**
 * DELETE /api/auth/token
 * Logout - deactivate session
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (sessionId) {
      await db
        .update(userSessions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(userSessions.sessionId, sessionId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
