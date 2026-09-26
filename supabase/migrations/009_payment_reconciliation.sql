-- ==============================================================================
-- BUZZORA STAGE 7C: PAYMENT RECONCILIATION & PAYMENT OPERATIONS
-- Migration: 009_payment_reconciliation.sql
-- ==============================================================================
-- Purpose:
-- 1. Index payments for fast merchant and provider transaction reconciliation.
-- 2. Establish dedicated, immutable payment reconciliation audit logging table.
-- 3. Enforce strict Row Level Security (RLS) denying public access to audit trail.
-- ==============================================================================

-- 1. Additional optimal indexes for payment reconciliation operations
CREATE INDEX IF NOT EXISTS idx_payments_merchant_tx ON public.payments(merchant_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_tx ON public.payments(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at_desc ON public.payments(created_at DESC);

-- 2. Dedicated Payment Reconciliation Audit Trail
CREATE TABLE IF NOT EXISTS public.payment_reconciliation_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    admin_id UUID,
    admin_email TEXT,
    action TEXT NOT NULL,
    previous_payment_status TEXT,
    provider_status_observed TEXT,
    resulting_payment_status TEXT,
    order_status_updated BOOLEAN DEFAULT FALSE,
    reconciliation_result TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Optimal indexes for reconciliation audit lookups
CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_payment_id ON public.payment_reconciliation_audit(payment_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_order_id ON public.payment_reconciliation_audit(order_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_created_at ON public.payment_reconciliation_audit(created_at DESC);

-- 4. Row Level Security: Fail-Closed Policy
ALTER TABLE public.payment_reconciliation_audit ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'payment_reconciliation_audit' AND policyname = 'Deny public and client access to payment_reconciliation_audit'
    ) THEN
        CREATE POLICY "Deny public and client access to payment_reconciliation_audit"
        ON public.payment_reconciliation_audit
        FOR ALL
        TO anon, authenticated
        USING (false);
    END IF;
END $$;
