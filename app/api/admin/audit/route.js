import { NextResponse } from "next/server";
import { getAdminAuditLogs } from "@/lib/admin/audit";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("pageSize") || "25";
    const action = searchParams.get("action") || "ALL";
    const resourceType = searchParams.get("resourceType") || "ALL";
    const search = searchParams.get("search") || "";
    const fromDate = searchParams.get("fromDate") || null;
    const toDate = searchParams.get("toDate") || null;

    const result = await getAdminAuditLogs({
      page,
      pageSize,
      action,
      resourceType,
      search,
      fromDate,
      toDate,
      adminContext: request,
    });

    return NextResponse.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to load audit logs." },
      { status }
    );
  }
}
