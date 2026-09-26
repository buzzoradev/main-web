import { NextResponse } from "next/server";
import { transitionOrderStatus } from "@/lib/admin/orders";
import { readBoundedJson } from "@/lib/security/request";

export async function POST(request, { params }) {
  try {
    const buzzoraOrderId = params?.id;
    let body = {};
    try {
      body = await readBoundedJson(request, { maxBytes: 16 * 1024 });
    } catch (readErr) {
      const status = readErr.statusCode || 400;
      return NextResponse.json(
        { error: readErr.message || "Invalid JSON request payload." },
        { status }
      );
    }

    const { targetStatus, shippingDetails, reason } = body || {};

    if (!targetStatus) {
      return NextResponse.json({ error: "Missing required parameter 'targetStatus'." }, { status: 400 });
    }

    const result = await transitionOrderStatus({
      buzzoraOrderId,
      targetStatus,
      shippingDetails,
      reason,
      adminContext: request,
    });

    return NextResponse.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to transition order status." },
      { status }
    );
  }
}
