-- ==============================================================================
-- BUZZORA STAGE 7E: PRODUCTION SECURITY & RELIABILITY HARDENING
-- Migration: 011_production_hardening.sql
-- ==============================================================================
-- Purpose:
-- 1. Additive index on customer_email for fast customer tracking & anti-enumeration lookups.
-- 2. Explicit fail-closed RLS policies for orders, order_items, payments, and order_status_history.
-- 3. Guarantees PostgREST / browser client cannot read or mutate order and financial tables directly.
-- 4. Purely additive, non-destructive, and idempotent.
-- ==============================================================================

-- 1. Additive index on orders(customer_email) for tracking and admin filtering performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);

-- 2. Ensure RLS is enabled on all core commercial tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- 3. Explicit fail-closed RLS policies (deny public and authenticated browser access)
-- Note: Service-role operations (used by server route handlers) bypass RLS automatically.

DO $$ 
BEGIN
    -- Orders table
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND policyname = 'Deny direct client access to orders'
    ) THEN
        CREATE POLICY "Deny direct client access to orders"
        ON public.orders
        FOR ALL
        TO anon, authenticated
        USING (false);
    END IF;

    -- Order items table
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_items' AND policyname = 'Deny direct client access to order_items'
    ) THEN
        CREATE POLICY "Deny direct client access to order_items"
        ON public.order_items
        FOR ALL
        TO anon, authenticated
        USING (false);
    END IF;

    -- Payments table
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'payments' AND policyname = 'Deny direct client access to payments'
    ) THEN
        CREATE POLICY "Deny direct client access to payments"
        ON public.payments
        FOR ALL
        TO anon, authenticated
        USING (false);
    END IF;

    -- Order status history audit table
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_status_history' AND policyname = 'Deny direct client access to order_status_history'
    ) THEN
        CREATE POLICY "Deny direct client access to order_status_history"
        ON public.order_status_history
        FOR ALL
        TO anon, authenticated
        USING (false);
    END IF;
END $$;
