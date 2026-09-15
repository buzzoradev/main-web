-- ============================================================================
-- Buzzora Database Migration 003: Add Courier & Tracking Fields to Orders
-- ============================================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS courier_name TEXT,
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS tracking_url TEXT;
