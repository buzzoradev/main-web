import { NextResponse } from "next/server";
import { updateShippingDetails } from "@/lib/admin/orders";
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

    const { courierName, trackingNumber, trackingUrl } = body || {};

    const result = await updateShippingDetails({
      buzzoraOrderId,
      shippingDetails: { courierName, trackingNumber, trackingUrl },
      adminContext: request,
    });

    return NextResponse.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to update shipping details." },
      { status }
    );
  }
}
