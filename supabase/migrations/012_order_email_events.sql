-- ==============================================================================
-- BUZZORA STAGE 8E: TRANSACTIONAL EMAIL SYSTEM WITH RESEND
-- Migration: 012_order_email_events.sql
-- ==============================================================================
-- Purpose:
-- 1. Create a dedicated order_email_events table for tracking transactional emails.
-- 2. Enforce logical event idempotency via UNIQUE(order_id, event_type).
-- 3. Enforce Resend API idempotency via UNIQUE(idempotency_key).
-- 4. Enable Row Level Security (RLS) with explicit fail-closed deny-all client policy.
-- 5. Track attempt counts, provider message IDs, and failure reasons.
-- 6. Purely additive, non-destructive, and idempotent.
-- ==============================================================================

-- 1. Create the order_email_events table
CREATE TABLE IF NOT EXISTS public.order_email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'ORDER_CANCELLED')),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DELIVERED', 'BOUNCED', 'COMPLAINED')),
    recipient_email TEXT NOT NULL,
    resend_email_id TEXT NULL,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    metadata JSONB NULL,
    sent_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_order_email_event UNIQUE(order_id, event_type)
);

-- 2. Performance indexes for operational lookups and admin dashboard
CREATE INDEX IF NOT EXISTS idx_order_email_events_order_id ON public.order_email_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_email_events_idempotency_key ON public.order_email_events(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_order_email_events_status ON public.order_email_events(status);
CREATE INDEX IF NOT EXISTS idx_order_email_events_resend_id ON public.order_email_events(resend_email_id);

-- 3. Trigger to maintain updated_at timestamp
DROP TRIGGER IF EXISTS trg_set_order_email_events_updated_at ON public.order_email_events;

CREATE TRIGGER trg_set_order_email_events_updated_at
BEFORE UPDATE ON public.order_email_events
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 4. Row Level Security: Fail-Closed Policy
-- Public (anon) and standard authenticated users MUST NEVER read or write email events directly
ALTER TABLE public.order_email_events ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_email_events' AND policyname = 'Deny direct client access to order_email_events'
    ) THEN
        CREATE POLICY "Deny direct client access to order_email_events"
        ON public.order_email_events
        FOR ALL
        TO anon, authenticated
        USING (false);
    END IF;
END $$;
