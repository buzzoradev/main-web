-- ==============================================================================
-- BUZZORA PRODUCTION COUPON & DISCOUNT ENGINE
-- Migration: 013_coupons_and_discounts.sql
-- ==============================================================================
-- Purpose:
-- 1. Create public.coupons table with strict CHECK constraints & uppercase index.
-- 2. Create public.coupon_usages table for atomic reservation/consumption/release.
-- 3. Add authoritative snapshot columns to public.orders.
-- 4. Enforce fail-closed Row Level Security (RLS) on coupons & coupon_usages.
-- 5. Provide concurrency-safe atomic RPC functions for order creation with coupons.
-- ==============================================================================

-- ----------------------------------------------------------------------------
-- 1. COUPONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    discount_percent NUMERIC(5, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    minimum_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    maximum_discount_amount NUMERIC(10, 2) NULL,
    
    starts_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NULL,
    
    usage_limit INTEGER NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT chk_coupons_discount_percent CHECK (discount_percent > 0 AND discount_percent <= 100),
    CONSTRAINT chk_coupons_min_order CHECK (minimum_order_amount >= 0),
    CONSTRAINT chk_coupons_max_discount CHECK (maximum_discount_amount IS NULL OR maximum_discount_amount >= 0),
    CONSTRAINT chk_coupons_usage_limit CHECK (usage_limit IS NULL OR usage_limit > 0),
    CONSTRAINT chk_coupons_usage_count CHECK (usage_count >= 0)
);

-- Case-insensitive uniqueness enforcement for coupon code
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_unique_upper 
    ON public.coupons (UPPER(code)) 
    WHERE deleted_at IS NULL;

-- Indexes for fast query and validation
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON public.coupons (is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coupons_expires_at ON public.coupons (expires_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coupons_created_at ON public.coupons (created_at DESC);

-- Trigger for coupons.updated_at
DROP TRIGGER IF EXISTS trigger_coupons_updated_at ON public.coupons;
CREATE TRIGGER trigger_coupons_updated_at
    BEFORE UPDATE ON public.coupons
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. COUPON USAGES TABLE (Tracks Reservation & Final Consumption per Order)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupon_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    buzzora_order_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RESERVED' 
        CHECK (status IN ('RESERVED', 'CONSUMED', 'RELEASED')),
    discount_amount NUMERIC(10, 2) NOT NULL CHECK (discount_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_coupon_per_order UNIQUE (coupon_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_id ON public.coupon_usages (coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_order_id ON public.coupon_usages (order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_buzzora_order_id ON public.coupon_usages (buzzora_order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_status ON public.coupon_usages (status);

DROP TRIGGER IF EXISTS trigger_coupon_usages_updated_at ON public.coupon_usages;
CREATE TRIGGER trigger_coupon_usages_updated_at
    BEFORE UPDATE ON public.coupon_usages
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. ORDERS TABLE SNAPSHOT COLUMNS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'coupon_code'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN coupon_code VARCHAR(50) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'coupon_discount_percent'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN coupon_discount_percent NUMERIC(5, 2) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'coupon_discount_amount'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN coupon_discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (coupon_discount_amount >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_coupon_code ON public.orders (coupon_code) WHERE coupon_code IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'coupons' AND policyname = 'Deny direct public and client access to coupons'
    ) THEN
        CREATE POLICY "Deny direct public and client access to coupons"
        ON public.coupons
        FOR ALL
        TO anon, authenticated
        USING (false);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'coupon_usages' AND policyname = 'Deny direct public and client access to coupon_usages'
    ) THEN
        CREATE POLICY "Deny direct public and client access to coupon_usages"
        ON public.coupon_usages
        FOR ALL
        TO anon, authenticated
        USING (false);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. ATOMIC RPC FUNCTION: create_order_with_coupon_and_items
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_with_coupon_and_items(
    p_buzzora_order_id VARCHAR(64),
    p_customer_name TEXT,
    p_customer_email TEXT,
    p_customer_phone TEXT,
    p_shipping_address TEXT,
    p_city TEXT,
    p_state TEXT,
    p_postcode TEXT,
    p_country TEXT,
    p_subtotal NUMERIC(10, 2),
    p_shipping_cost NUMERIC(10, 2),
    p_total NUMERIC(10, 2),
    p_currency VARCHAR(3),
    p_items JSONB,
    p_idempotency_key VARCHAR(128) DEFAULT NULL,
    p_coupon_code VARCHAR(50) DEFAULT NULL,
    p_coupon_discount_percent NUMERIC(5, 2) DEFAULT NULL,
    p_coupon_discount_amount NUMERIC(10, 2) DEFAULT 0.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_existing_order JSONB;
    v_item JSONB;
    v_created_at TIMESTAMPTZ;
    v_coupon_id UUID := NULL;
    v_normalized_code VARCHAR(50) := NULL;
    v_current_usage_count INTEGER;
    v_usage_limit INTEGER;
BEGIN
    -- 1. Initial Idempotency Check (Repeated request reuses existing order without consuming coupon again)
    IF p_idempotency_key IS NOT NULL THEN
        SELECT jsonb_build_object(
            'order_id', id,
            'buzzora_order_id', buzzora_order_id,
            'created_at', created_at,
            'is_duplicate', true
        ) INTO v_existing_order
        FROM public.orders
        WHERE (idempotency_key = p_idempotency_key AND customer_email = p_customer_email)
           OR buzzora_order_id = p_buzzora_order_id;
    ELSE
        SELECT jsonb_build_object(
            'order_id', id,
            'buzzora_order_id', buzzora_order_id,
            'created_at', created_at,
            'is_duplicate', true
        ) INTO v_existing_order
        FROM public.orders
        WHERE buzzora_order_id = p_buzzora_order_id;
    END IF;

    IF v_existing_order IS NOT NULL THEN
        RETURN v_existing_order;
    END IF;

    -- 2. Atomic Coupon Validation and Concurrency-Safe Usage Reservation
    IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
        v_normalized_code := UPPER(TRIM(p_coupon_code));

        -- Atomic conditional update with row-level concurrency lock
        UPDATE public.coupons
        SET usage_count = usage_count + 1,
            updated_at = NOW()
        WHERE UPPER(code) = v_normalized_code
          AND is_active = TRUE
          AND deleted_at IS NULL
          AND (starts_at IS NULL OR starts_at <= NOW())
          AND (expires_at IS NULL OR expires_at > NOW())
          AND (minimum_order_amount IS NULL OR p_subtotal >= minimum_order_amount)
          AND (usage_limit IS NULL OR usage_count < usage_limit)
        RETURNING id INTO v_coupon_id;

        IF v_coupon_id IS NULL THEN
            -- Check reason for failure to provide safe, actionable error
            SELECT usage_count, usage_limit INTO v_current_usage_count, v_usage_limit
            FROM public.coupons
            WHERE UPPER(code) = v_normalized_code AND deleted_at IS NULL;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'COUPON_NOT_FOUND: Invalid coupon code.';
            ELSIF v_usage_limit IS NOT NULL AND v_current_usage_count >= v_usage_limit THEN
                RAISE EXCEPTION 'COUPON_LIMIT_REACHED: Coupon usage limit has been reached.';
            ELSE
                RAISE EXCEPTION 'COUPON_INELIGIBLE: Coupon is not valid or minimum order amount not met.';
            END IF;
        END IF;
    END IF;

    -- 3. Atomic Order & Line Item Inserts
    BEGIN
        INSERT INTO public.orders (
            buzzora_order_id,
            customer_name,
            customer_email,
            customer_phone,
            shipping_address,
            city,
            state,
            postcode,
            country,
            subtotal,
            shipping_cost,
            total,
            currency,
            status,
            idempotency_key,
            coupon_code,
            coupon_discount_percent,
            coupon_discount_amount
        ) VALUES (
            p_buzzora_order_id,
            p_customer_name,
            p_customer_email,
            p_customer_phone,
            p_shipping_address,
            p_city,
            p_state,
            p_postcode,
            COALESCE(p_country, 'India'),
            p_subtotal,
            COALESCE(p_shipping_cost, 0),
            p_total,
            COALESCE(p_currency, 'INR'),
            'PENDING',
            p_idempotency_key,
            v_normalized_code,
            p_coupon_discount_percent,
            COALESCE(p_coupon_discount_amount, 0.00)
        )
        RETURNING id, created_at INTO v_order_id, v_created_at;

        -- Record atomic coupon reservation in coupon_usages table
        IF v_coupon_id IS NOT NULL THEN
            INSERT INTO public.coupon_usages (
                coupon_id,
                order_id,
                buzzora_order_id,
                status,
                discount_amount
            ) VALUES (
                v_coupon_id,
                v_order_id,
                p_buzzora_order_id,
                'RESERVED',
                COALESCE(p_coupon_discount_amount, 0.00)
            );
        END IF;

        -- Loop Insert line items inside same transaction
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            INSERT INTO public.order_items (
                order_id,
                product_id,
                product_name,
                size_sku,
                weight,
                quantity,
                unit_price,
                line_total
            ) VALUES (
                v_order_id,
                (v_item->>'product_id')::TEXT,
                (v_item->>'product_name')::TEXT,
                (v_item->>'size_sku')::TEXT,
                (v_item->>'weight')::TEXT,
                (v_item->>'quantity')::INTEGER,
                (v_item->>'unit_price')::NUMERIC(10, 2),
                (v_item->>'line_total')::NUMERIC(10, 2)
            );
        END LOOP;

        RETURN jsonb_build_object(
            'order_id', v_order_id,
            'buzzora_order_id', p_buzzora_order_id,
            'created_at', v_created_at,
            'is_duplicate', false
        );

    EXCEPTION WHEN unique_violation THEN
        -- If concurrent conflict occurs, rollback reserved coupon usage
        IF v_coupon_id IS NOT NULL THEN
            UPDATE public.coupons
            SET usage_count = GREATEST(0, usage_count - 1),
                updated_at = NOW()
            WHERE id = v_coupon_id;
        END IF;

        IF p_idempotency_key IS NOT NULL THEN
            SELECT jsonb_build_object(
                'order_id', id,
                'buzzora_order_id', buzzora_order_id,
                'created_at', created_at,
                'is_duplicate', true
            ) INTO v_existing_order
            FROM public.orders
            WHERE (idempotency_key = p_idempotency_key AND customer_email = p_customer_email)
               OR buzzora_order_id = p_buzzora_order_id;
        ELSE
            SELECT jsonb_build_object(
                'order_id', id,
                'buzzora_order_id', buzzora_order_id,
                'created_at', created_at,
                'is_duplicate', true
            ) INTO v_existing_order
            FROM public.orders
            WHERE buzzora_order_id = p_buzzora_order_id;
        END IF;

        IF v_existing_order IS NOT NULL THEN
            RETURN v_existing_order;
        ELSE
            RAISE EXCEPTION 'Unique constraint violation occurred during order creation.';
        END IF;
    END;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC HELPER: Release Coupon Usage on Failed / Cancelled Orders
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_coupon_usage(p_buzzora_order_id VARCHAR(64))
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_usage RECORD;
BEGIN
    SELECT id, coupon_id, status INTO v_usage
    FROM public.coupon_usages
    WHERE buzzora_order_id = p_buzzora_order_id AND status = 'RESERVED'
    LIMIT 1;

    IF FOUND THEN
        UPDATE public.coupon_usages
        SET status = 'RELEASED', updated_at = NOW()
        WHERE id = v_usage.id;

        UPDATE public.coupons
        SET usage_count = GREATEST(0, usage_count - 1), updated_at = NOW()
        WHERE id = v_usage.coupon_id;

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. RPC HELPER: Consume Coupon Usage on Confirmed Payment
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_coupon_usage(p_buzzora_order_id VARCHAR(64))
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.coupon_usages
    SET status = 'CONSUMED', updated_at = NOW()
    WHERE buzzora_order_id = p_buzzora_order_id AND status = 'RESERVED';

    RETURN FOUND;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. PRIVILEGES (REVOKE FROM PUBLIC, GRANT EXCLUSIVELY TO SERVICE_ROLE)
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_order_with_coupon_and_items FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_coupon_and_items TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_coupon_usage(VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_coupon_usage(VARCHAR) TO service_role;

REVOKE EXECUTE ON FUNCTION public.consume_coupon_usage(VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_coupon_usage(VARCHAR) TO service_role;
