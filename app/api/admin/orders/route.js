import { NextResponse } from "next/server";
import { getAdminOrdersList } from "@/lib/admin/orders";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const page = searchParams.get("page") || 1;
    const pageSize = searchParams.get("pageSize") || 20;
    const search = searchParams.get("search") || "";
    const orderStatus = searchParams.get("orderStatus") || "ALL";
    const paymentStatus = searchParams.get("paymentStatus") || "ALL";
    const fromDate = searchParams.get("fromDate") || null;
    const toDate = searchParams.get("toDate") || null;

    const result = await getAdminOrdersList({
      page,
      pageSize,
      search,
      orderStatus,
      paymentStatus,
      fromDate,
      toDate,
      adminContext: request,
    });

    return NextResponse.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to load orders." },
      { status }
    );
  }
}
