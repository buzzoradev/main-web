import { NextResponse } from "next/server";
import { extractAdminToken, clearAdminSessionCookies, getAdminContext } from "@/lib/admin/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recordAdminAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from "@/lib/admin/audit";

export async function POST(request) {
  const token = await extractAdminToken(request);
  let adminContext = null;

  if (token) {
    try {
      adminContext = await getAdminContext(token);
    } catch {
      // Non-blocking context lookup
    }

    try {
      const supabaseAdmin = createServerSupabaseClient();
      await supabaseAdmin.auth.admin.signOut(token, "global").catch(() => {});
    } catch {
      // Non-blocking logout cleanup
    }
  }

  // Record logout audit event
  await recordAdminAudit({
    adminContext,
    action: AUDIT_ACTIONS.ADMIN_LOGOUT,
    resourceType: RESOURCE_TYPES.SESSION,
    resourceId: adminContext?.email || "admin-session",
    reason: "Administrator logged out.",
  });

  const response = NextResponse.json({
    success: true,
    message: "Admin session terminated successfully.",
  });

  clearAdminSessionCookies(response);

  return response;
}
