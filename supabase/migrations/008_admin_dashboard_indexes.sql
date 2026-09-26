-- ==============================================================================
-- BUZZORA STAGE 7B: ADMIN DASHBOARD & ORDER MANAGEMENT INDEXES
-- Migration: 008_admin_dashboard_indexes.sql
-- ==============================================================================
-- Purpose:
-- Accelerate administrative search, multi-criteria filtering, aggregation,
-- and pagination queries across the orders and payments tables.
-- ==============================================================================

-- 1. Index for order status filtering and status-based counts
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- 2. Index for phone number search in customer orders
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON public.orders(customer_phone);

-- 3. Composite index for combined status filtering ordered by creation timestamp
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.orders(status, created_at DESC);

-- 4. Composite index on payments for relational order joins and status checks
CREATE INDEX IF NOT EXISTS idx_payments_order_status ON public.payments(order_id, payment_status);
