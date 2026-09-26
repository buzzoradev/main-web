import { NextResponse } from "next/server";
import { getAdminPaymentDetails } from "@/lib/admin/payments";

export async function GET(request, { params }) {
  try {
    const paymentId = params?.id;
    const result = await getAdminPaymentDetails(paymentId, request);
    return NextResponse.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { error: err.message || "Failed to load payment details." },
      { status }
    );
  }
}
