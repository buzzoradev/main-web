-- ==============================================================================
-- BUZZORA STAGE 7D: ADMIN AUDIT LOG & OPERATIONAL SECURITY
-- Migration: 010_admin_audit_log.sql
-- ==============================================================================
-- Purpose:
-- 1. Create a unified, immutable administrative audit log table.
-- 2. Index critical dimensions: created_at, action, admin_user_id, resource, order_id, payment_id.
-- 3. Enforce strict Row Level Security (RLS) denying public/client access.
-- 4. Enforce database-level immutability preventing UPDATE or DELETE.
-- ==============================================================================

-- 1. Create the unified admin_audit_log table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NULL,
    admin_email TEXT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NULL,
    resource_id TEXT NULL,
    order_id UUID NULL,
    payment_id UUID NULL,
    previous_state JSONB NULL,
    new_state JSONB NULL,
    result TEXT NOT NULL DEFAULT 'SUCCESS',
    reason TEXT NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Optimal indexes for frequent filtering, search, and chronological audit display
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON public.admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_resource ON public.admin_audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_order_id ON public.admin_audit_log(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_payment_id ON public.admin_audit_log(payment_id);

-- 3. Row Level Security: Fail-Closed Policy
-- Public (anon) and authenticated client users MUST NEVER read, write, update, or delete audit logs.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_audit_log' AND policyname = 'Deny public and client access to admin_audit_log'
    ) THEN
        CREATE POLICY "Deny public and client access to admin_audit_log"
        ON public.admin_audit_log
        FOR ALL
        TO anon, authenticated
        USING (false);
    END IF;
END $$;

-- 4. Database-level immutability: block UPDATE and DELETE operations
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.admin_audit_log;

CREATE TRIGGER trg_prevent_audit_log_mutation
BEFORE UPDATE OR DELETE ON public.admin_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_mutation();
