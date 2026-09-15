-- ============================================================================
-- Buzzora PostgreSQL Database Schema & Hardened RPC Function
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper Function: Auto-update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. ORDERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buzzora_order_id VARCHAR(64) UNIQUE NOT NULL,
    
    -- Customer Contact & Shipping Information
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postcode TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'India',
    
    -- Financial Totals (INR)
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    shipping_cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (shipping_cost >= 0),
    total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    
    -- Order Fulfillment State
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
    
    -- Session Idempotency Key
    idempotency_key VARCHAR(128) UNIQUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for orders.updated_at
DROP TRIGGER IF EXISTS trigger_orders_updated_at ON public.orders;
CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. ORDER ITEMS TABLE (Historical Snapshot)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    
    -- Historical Snapshot Fields
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    size_sku TEXT NOT NULL,
    weight TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(10, 2) NOT NULL CHECK (line_total >= 0),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. PAYMENTS TABLE (Supports Multiple Payment Retries per Order)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    
    -- Idempotent Merchant Transaction Reference
    merchant_transaction_id VARCHAR(64) UNIQUE NOT NULL,
    
    -- Gateway Provider & Reference
    payment_provider VARCHAR(50) NOT NULL,
    provider_transaction_id TEXT,
    
    -- Financial Details
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    
    -- Payment Attempt State
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (payment_status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED')),
    
    -- Sanitized Provider Audit Log
    provider_response JSONB,
    
    -- Timestamps
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_provider_tx_id UNIQUE (payment_provider, provider_transaction_id)
);

-- Trigger for payments.updated_at
DROP TRIGGER IF EXISTS trigger_payments_updated_at ON public.payments;
CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(payment_status);

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 7. ATOMIC RPC FUNCTION (HARDENED & TRANSACTION SAFE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_with_items(
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
    p_idempotency_key VARCHAR(128) DEFAULT NULL
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
BEGIN
    -- 1. Initial Idempotency Check
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

    -- 2. Atomic Order & Line Item Inserts with Exception Handling for Race Conditions
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
            idempotency_key
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
            p_idempotency_key
        )
        RETURNING id, created_at INTO v_order_id, v_created_at;

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
        -- Safely handle concurrent race conditions
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
-- 8. RPC EXECUTION PRIVILEGES (REVOKE FROM PUBLIC, GRANT TO SERVICE_ROLE ONLY)
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_order_with_items(
    VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, VARCHAR, JSONB, VARCHAR
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_with_items(
    VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, VARCHAR, JSONB, VARCHAR
) TO service_role;
