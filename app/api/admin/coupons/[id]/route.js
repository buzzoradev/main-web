import { NextResponse } from "next/server";
import {
  getAdminCouponById,
  updateAdminCoupon,
  deleteAdminCoupon,
} from "@/lib/admin/coupons";
import { readBoundedJson } from "@/lib/security/request";

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const coupon = await getAdminCouponById(id, request);
    return NextResponse.json({ coupon });
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to load coupon details." },
      { status }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await readBoundedJson(request, { maxBytes: 32 * 1024 });
    const coupon = await updateAdminCoupon(id, body, request);
    return NextResponse.json({ coupon });
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to update coupon." },
      { status }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const result = await deleteAdminCoupon(id, request);
    return NextResponse.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to delete coupon." },
      { status }
    );
  }
}
