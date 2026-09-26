-- ============================================================================
-- Buzzora Database Migration 006: Fulfillment Foundation & Status History Audit
-- ============================================================================
-- Purpose:
-- 1. Ensure courier fulfillment fields and timestamps exist on public.orders.
-- 2. Create public.order_status_history for immutable fulfillment auditing.
-- 3. Enforce strict Row Level Security (RLS) on order_status_history.
-- ============================================================================

-- 1. Ensure shipping & fulfillment metadata columns exist on public.orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS courier_name TEXT,
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS tracking_url TEXT,
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 2. Create order_status_history table
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    previous_status VARCHAR(30) NOT NULL,
    new_status VARCHAR(30) NOT NULL,
    changed_by TEXT DEFAULT 'system',
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Targeted indexes for order_status_history
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON public.order_status_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_status_history_new_status ON public.order_status_history(new_status);

-- 4. Enable Row Level Security (RLS) on order_status_history
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Note on RLS:
-- Default deny for anon role. No SELECT/INSERT/UPDATE granted to public.
-- All audit writes occur strictly through privileged server routes using service_role.
