import { NextResponse } from "next/server";
import { getAdminPaymentsList } from "@/lib/admin/payments";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("pageSize") || "25";
    const search = searchParams.get("search") || "";
    const paymentStatus = searchParams.get("paymentStatus") || "ALL";
    const reconciliationFilter = searchParams.get("reconciliationFilter") || "ALL";

    const result = await getAdminPaymentsList({
      page,
      pageSize,
      search,
      paymentStatus,
      reconciliationFilter,
      adminContext: request,
    });

    return NextResponse.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to load payment records." },
      { status }
    );
  }
}
