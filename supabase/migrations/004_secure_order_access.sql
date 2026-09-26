-- ============================================================================
-- Buzzora Database Migration 004: Secure Order Access Foundation
-- ============================================================================
-- Purpose:
-- 1. Index customer_phone on orders for fast, scalable verification lookups.
-- 2. Maintain strict Row Level Security (RLS) on orders, order_items, and payments.
-- 3. Document the authorization boundary (anon vs service_role).
-- ============================================================================

-- 1. Index on customer_phone to optimize verification in /api/orders/track
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);

-- 2. Confirm RLS is enabled on all order-related tables (default deny for anon)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Note on Supabase RLS Policy:
-- No SELECT/INSERT/UPDATE policies are granted to the 'anon' role on orders, order_items, or payments.
-- All client-side order access MUST be routed through server-side API endpoints:
-- - /api/orders/[id] (requires verified, signed order token)
-- - /api/orders/track (requires matching order ID + email or phone verifier)
-- Server-side endpoints use the service_role key, ensuring that unauthenticated or
-- unauthorized direct PostgREST client queries cannot bypass application authorization.
