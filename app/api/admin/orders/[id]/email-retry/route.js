import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { retryEmailEvent, EMAIL_EVENT_TYPES } from "@/lib/email/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recordAdminAudit, AUDIT_ACTIONS, RESOURCE_TYPES, AUDIT_RESULTS } from "@/lib/admin/audit";
import { readBoundedJson } from "@/lib/security/request";

export async function POST(request, { params }) {
  let adminContext;
  try {
    adminContext = await requireAdmin(request);
  } catch (authErr) {
    const status = authErr.statusCode || 401;
    return NextResponse.json({ error: authErr.message || "Unauthorized" }, { status });
  }

  const buzzoraOrderId = params?.id;
  if (!buzzoraOrderId || typeof buzzoraOrderId !== "string") {
    return NextResponse.json({ error: "Invalid Buzzora Order ID." }, { status: 400 });
  }

  let body = {};
  try {
    body = await readBoundedJson(request, { maxBytes: 8 * 1024 });
  } catch (readErr) {
    return NextResponse.json(
      { error: readErr.message || "Invalid JSON payload." },
      { status: readErr.statusCode || 400 }
    );
  }

  const { eventType } = body || {};
  if (!eventType || !Object.values(EMAIL_EVENT_TYPES).includes(eventType)) {
    return NextResponse.json(
      { error: `Invalid eventType. Allowed: ${Object.values(EMAIL_EVENT_TYPES).join(", ")}` },
      { status: 400 }
    );
  }

  const cleanOrderId = buzzoraOrderId.trim().toUpperCase();
  const supabase = createServerSupabaseClient();

  // Find order ID
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, buzzora_order_id, status")
    .eq("buzzora_order_id", cleanOrderId)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  try {
    const result = await retryEmailEvent({
      orderId: order.id,
      buzzoraOrderId: order.buzzora_order_id,
      eventType,
    });

    await recordAdminAudit({
      adminContext,
      action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
      resourceType: RESOURCE_TYPES.ORDER,
      resourceId: order.buzzora_order_id,
      orderId: order.id,
      result: result.success ? AUDIT_RESULTS.SUCCESS : AUDIT_RESULTS.FAILURE,
      reason: `Admin triggered transactional email retry for event '${eventType}'.`,
      metadata: { eventType, result },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error(`[Admin Email Retry Error] ${cleanOrderId}:`, err.message);
    return NextResponse.json(
      { error: err.message || "Failed to retry email delivery." },
      { status: 500 }
    );
  }
}
