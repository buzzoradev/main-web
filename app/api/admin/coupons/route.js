import { NextResponse } from "next/server";
import { getAdminCoupons, createAdminCoupon } from "@/lib/admin/coupons";
import { readBoundedJson } from "@/lib/security/request";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";
    const pageSize = searchParams.get("pageSize") || "25";
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "ALL";

    const result = await getAdminCoupons({
      page,
      pageSize,
      search,
      status,
      adminContext: request,
    });

    return NextResponse.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to load coupons." },
      { status }
    );
  }
}

export async function POST(request) {
  try {
    const body = await readBoundedJson(request, { maxBytes: 32 * 1024 });
    const coupon = await createAdminCoupon(body, request);
    return NextResponse.json({ coupon }, { status: 201 });
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to create coupon." },
      { status }
    );
  }
}
