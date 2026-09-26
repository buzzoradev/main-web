import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/auth";

export async function GET(request) {
  const adminContext = await getAdminContext(request);

  if (!adminContext.authenticated) {
    return NextResponse.json(
      { authenticated: false, error: "Authentication required." },
      { status: 401 }
    );
  }

  if (!adminContext.authorized) {
    return NextResponse.json(
      {
        authenticated: true,
        authorized: false,
        error: "Forbidden: Administrator privileges required.",
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    authenticated: true,
    authorized: true,
    user: {
      adminId: adminContext.adminId,
      email: adminContext.email,
      role: adminContext.role,
    },
  });
}
