import { NextResponse } from "next/server";
import {
  ADMIN_REFRESH_COOKIE_NAME,
  setAdminSessionCookies,
  clearAdminSessionCookies,
  getAdminContext,
} from "@/lib/admin/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { recordAdminAudit, AUDIT_ACTIONS, RESOURCE_TYPES, AUDIT_RESULTS } from "@/lib/admin/audit";
import { adminRefreshRateLimit, rateLimitResponse } from "@/lib/security/ratelimit";

/**
 * Admin Session Refresh Endpoint.
 *
 * Implements single-use refresh token rotation:
 * 1. Reads the HTTP-only buzzora_admin_refresh_token cookie.
 * 2. Enforces distributed rate limiting against refresh flooding.
 * 3. Exchanges it with Supabase Auth for a new access token and a new rotated refresh token.
 * 4. Verifies the user is still an active admin in the database.
 * 5. Updates HTTP-only cookies and returns clean JSON without exposing tokens.
 * 6. If refresh token is invalid or replayed, clears all session cookies.
 */
export async function POST(request) {
  // 1. Rate limiting on refresh endpoint
  const rateLimitResult = await adminRefreshRateLimit(request);
  if (!rateLimitResult.success) {
    return rateLimitResponse(
      rateLimitResult,
      "Too many session refresh attempts. Please slow down."
    );
  }

  const refreshToken = request.cookies.get(ADMIN_REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    const response = NextResponse.json(
      { error: "No refresh token available. Please sign in again." },
      { status: 401 }
    );
    clearAdminSessionCookies(response);
    return response;
  }

  let authClient;
  try {
    authClient = createBrowserSupabaseClient();
  } catch (err) {
    return NextResponse.json(
      { error: "Server authentication configuration error." },
      { status: 500 }
    );
  }

  const { data, error } = await authClient.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data?.session?.access_token) {
    const response = NextResponse.json(
      { error: "Session expired or revoked. Please sign in again." },
      { status: 401 }
    );
    clearAdminSessionCookies(response);
    return response;
  }

  // Re-verify that user remains an active administrator
  const adminContext = await getAdminContext(data.session.access_token);

  if (!adminContext.authorized) {
    // Record session revocation audit event
    await recordAdminAudit({
      adminContext,
      action: AUDIT_ACTIONS.ADMIN_SESSION_REVOKED,
      resourceType: RESOURCE_TYPES.SESSION,
      resourceId: adminContext.email || "revoked-session",
      result: AUDIT_RESULTS.REJECTED,
      reason: "Session refresh attempted on inactive/unauthorized admin account.",
    });

    const response = NextResponse.json(
      { error: "Administrator authorization revoked." },
      { status: 403 }
    );
    clearAdminSessionCookies(response);
    return response;
  }

  // Record successful session refresh
  await recordAdminAudit({
    adminContext,
    action: AUDIT_ACTIONS.ADMIN_SESSION_REFRESH,
    resourceType: RESOURCE_TYPES.SESSION,
    resourceId: adminContext.email,
    result: AUDIT_RESULTS.SUCCESS,
  });

  const response = NextResponse.json({
    success: true,
    user: {
      email: adminContext.email,
      role: adminContext.role,
    },
  });

  // Rotate both access_token and refresh_token
  setAdminSessionCookies(response, data.session);

  return response;
}
