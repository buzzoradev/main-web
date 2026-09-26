import { NextResponse } from "next/server";
import { getAdminDashboardMetrics } from "@/lib/admin/dashboard";

export async function GET(request) {
  try {
    const metrics = await getAdminDashboardMetrics(request);
    return NextResponse.json(metrics);
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to retrieve dashboard metrics." },
      { status }
    );
  }
}
