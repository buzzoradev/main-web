import { NextResponse } from "next/server";
import { reconcilePaymentWithProvider } from "@/lib/admin/payments";

export async function POST(request, { params }) {
  try {
    const paymentId = params?.id;
    const result = await reconcilePaymentWithProvider({
      paymentId,
      adminContext: request,
    });
    return NextResponse.json(result);
  } catch (err) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      {
        error: err.message || "Failed to reconcile payment with provider.",
        classification: err.classification || "RECONCILIATION_ERROR",
      },
      { status }
    );
  }
}
