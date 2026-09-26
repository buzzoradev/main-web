import { NextResponse } from "next/server";
import { verifyAdminCredentials, setAdminSessionCookies } from "@/lib/admin/auth";
import { recordAdminAudit, AUDIT_ACTIONS, RESOURCE_TYPES, AUDIT_RESULTS } from "@/lib/admin/audit";
import { adminLoginRateLimit, rateLimitResponse } from "@/lib/security/ratelimit";
import { readBoundedJson, normalizeEmail } from "@/lib/security/request";

export async function POST(request) {
  // 1. Enforce payload size limit (max 10KB for login)
  let body;
  try {
    body = await readBoundedJson(request, { maxBytes: 10 * 1024 });
  } catch (err) {
    const status = err.statusCode || 400;
    return NextResponse.json(
      { error: err.message || "Invalid request payload." },
      { status }
    );
  }

  const { email, password } = body || {};

  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Please provide both email and password." },
      { status: 400 }
    );
  }

  const cleanEmail = normalizeEmail(email);

  // 2. Enforce Distributed Rate Limiting (5 attempts / 15 minutes)
  const rateLimitResult = await adminLoginRateLimit(request, cleanEmail);
  if (!rateLimitResult.success) {
    await recordAdminAudit({
      action: AUDIT_ACTIONS.ADMIN_LOGIN_FAILURE,
      resourceType: RESOURCE_TYPES.SESSION,
      resourceId: cleanEmail,
      result: AUDIT_RESULTS.REJECTED,
      reason: "Login rate limit exceeded. Possible brute-force attack.",
      metadata: { attemptedEmail: cleanEmail, retryAfter: rateLimitResult.resetInSeconds },
    });

    return rateLimitResponse(
      rateLimitResult,
      "Too many login attempts. Please wait 15 minutes before trying again."
    );
  }

  // 3. Verify credentials via Supabase Auth & check admin authorization
  const result = await verifyAdminCredentials(cleanEmail, password);

  if (!result.success) {
    // Record internal audit event with actual diagnostic reason
    await recordAdminAudit({
      action: AUDIT_ACTIONS.ADMIN_LOGIN_FAILURE,
      resourceType: RESOURCE_TYPES.SESSION,
      resourceId: cleanEmail,
      result: AUDIT_RESULTS.FAILURE,
      reason: result.error || "Authentication failed",
      metadata: { attemptedEmail: cleanEmail, code: result.code },
    });

    // Anti-enumeration defense: return uniform 401 error message regardless of whether
    // the email exists, password was incorrect, or user lacks admin privileges
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  // 4. Record successful login audit event
  await recordAdminAudit({
    adminContext: {
      adminId: result.user.id,
      email: result.user.email,
      role: result.user.role,
    },
    action: AUDIT_ACTIONS.ADMIN_LOGIN_SUCCESS,
    resourceType: RESOURCE_TYPES.SESSION,
    resourceId: result.user.email,
    result: AUDIT_RESULTS.SUCCESS,
  });

  // 5. Create clean JSON response with NO sensitive tokens in body
  const response = NextResponse.json({
    success: true,
    user: {
      email: result.user.email,
      role: result.user.role,
    },
  });

  // 6. Attach secure HTTP-only cookies
  setAdminSessionCookies(response, result.session);

  return response;
}
