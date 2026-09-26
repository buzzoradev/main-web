import { NextResponse } from "next/server";
import { getAdminOrderDetails } from "@/lib/admin/orders";

export async function GET(request, { params }) {
  try {
    const buzzoraOrderId = params?.id;
    const result = await getAdminOrderDetails(buzzoraOrderId, request);
    return NextResponse.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to load order details." },
      { status }
    );
  }
}
