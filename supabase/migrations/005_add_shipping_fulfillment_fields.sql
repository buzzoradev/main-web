-- ============================================================================
-- Buzzora Database Migration 005: Add Shipping Timestamps & Fulfillment Fields
-- ============================================================================
-- Purpose:
-- Adds courier fulfillment metadata and shipping timestamps to public.orders.
-- All columns are safely nullable to accommodate orders prior to dispatch.
-- Uses ADD COLUMN IF NOT EXISTS to prevent duplicates with migration 003.
-- ============================================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS courier_name TEXT,
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS tracking_url TEXT,
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
