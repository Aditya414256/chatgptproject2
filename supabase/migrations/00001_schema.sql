-- =============================================================================
-- FindMedicine — Complete Database Schema Migration
-- =============================================================================
-- This migration creates all tables, functions, triggers, RLS policies,
-- and scheduled jobs for the FindMedicine application.
--
-- Designed for idempotency: safe to run multiple times.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------

-- 1a. profiles — extends auth.users with app-specific fields
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text        NOT NULL,
  phone       text        NOT NULL,
  role        text        NOT NULL CHECK (role IN ('customer', 'store_owner')),
  created_at  timestamptz DEFAULT now()
);

-- 1b. stores — each store belongs to a store_owner profile
CREATE TABLE IF NOT EXISTS public.stores (
  id                    uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid             NOT NULL REFERENCES public.profiles(id),
  name                  text             NOT NULL,
  address               text             NOT NULL,
  lat                   double precision NOT NULL,
  lng                   double precision NOT NULL,
  is_open               boolean          DEFAULT true,
  offers_delivery       boolean          DEFAULT false,
  serviceable_pincodes  text[]           DEFAULT '{}',
  created_at            timestamptz      DEFAULT now()
);

-- 1c. medicines — admin-seeded catalogue of available medicines
CREATE TABLE IF NOT EXISTS public.medicines (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text        NOT NULL,
  generic_name          text        NOT NULL,
  strength              text        NOT NULL,
  form                  text        NOT NULL CHECK (form IN (
                          'tablet', 'capsule', 'syrup', 'injection',
                          'cream', 'drops', 'inhaler', 'powder',
                          'ointment', 'gel'
                        )),
  requires_prescription boolean     DEFAULT false,
  created_at            timestamptz DEFAULT now()
);

-- 1d. store_inventory — which medicines a store stocks and at what price
CREATE TABLE IF NOT EXISTS public.store_inventory (
  store_id    uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  medicine_id uuid          NOT NULL REFERENCES public.medicines(id) ON DELETE CASCADE,
  price       numeric(10,2) NOT NULL CHECK (price > 0),
  stock       integer       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  PRIMARY KEY (store_id, medicine_id)
);

-- 1e. orders — customer orders placed against a store
CREATE TABLE IF NOT EXISTS public.orders (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       uuid          NOT NULL REFERENCES public.profiles(id),
  store_id          uuid          NOT NULL REFERENCES public.stores(id),
  fulfilment_type   text          NOT NULL CHECK (fulfilment_type IN ('pickup', 'delivery')),
  status            text          NOT NULL DEFAULT 'pending'
                                  CHECK (status IN (
                                    'pending', 'accepted', 'ready',
                                    'out_for_delivery', 'completed',
                                    'rejected', 'cancelled', 'expired',
                                    'not_collected'
                                  )),
  delivery_address  text,
  delivery_pincode  text,
  prescription_path text,
  reject_reason     text,
  handover_code     text          NOT NULL,
  total             numeric(10,2) NOT NULL,
  created_at        timestamptz   DEFAULT now(),
  expires_at        timestamptz
);

-- 1f. order_items — line items within an order
CREATE TABLE IF NOT EXISTS public.order_items (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid          NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  medicine_id uuid          NOT NULL REFERENCES public.medicines(id),
  quantity    integer       NOT NULL CHECK (quantity > 0),
  unit_price  numeric(10,2) NOT NULL
);

-- 1g. notifications — in-app notifications for users
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id),
  order_id   uuid        NOT NULL REFERENCES public.orders(id),
  message    text        NOT NULL,
  read       boolean     DEFAULT false,
  created_at timestamptz DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- 2. INDEXES (for performance)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_stores_owner          ON public.stores (owner_id);
CREATE INDEX IF NOT EXISTS idx_store_inventory_store  ON public.store_inventory (store_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer        ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_store           ON public.orders (store_id);
CREATE INDEX IF NOT EXISTS idx_orders_status          ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_order_items_order      ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user     ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_order    ON public.notifications (order_id);


-- ---------------------------------------------------------------------------
-- 3. RPC FUNCTIONS
-- ---------------------------------------------------------------------------

-- 3a. nearby_stores — find stores within a radius using the haversine formula,
--     optionally checking medicine availability.
CREATE OR REPLACE FUNCTION public.nearby_stores(
  user_lat      double precision,
  user_lng      double precision,
  radius_km     double precision DEFAULT 5,
  medicine_ids  uuid[]           DEFAULT '{}'
)
RETURNS TABLE (
  store_id          uuid,
  store_name        text,
  address           text,
  lat               double precision,
  lng               double precision,
  is_open           boolean,
  offers_delivery   boolean,
  distance_km       double precision,
  total_price       numeric,
  missing_medicines text[]
) AS $$
BEGIN
  RETURN QUERY
  WITH requested AS (
    SELECT unnest(medicine_ids) AS mid
  ),
  store_distances AS (
    SELECT
      s.id, s.name, s.address, s.lat, s.lng, s.is_open, s.offers_delivery,
      (6371 * acos(
        LEAST(1.0,                           -- guard against floating-point > 1
          cos(radians(user_lat)) * cos(radians(s.lat)) *
          cos(radians(s.lng) - radians(user_lng)) +
          sin(radians(user_lat)) * sin(radians(s.lat))
        )
      )) AS dist_km
    FROM public.stores s
  ),
  filtered AS (
    SELECT * FROM store_distances WHERE dist_km <= radius_km
  ),
  inventory_check AS (
    SELECT
      f.id  AS sid,
      COALESCE(SUM(CASE WHEN si.stock > 0 THEN si.price ELSE 0 END), 0) AS tp,
      ARRAY_AGG(m.name) FILTER (WHERE si.medicine_id IS NULL OR si.stock <= 0) AS missing
    FROM filtered f
    CROSS JOIN requested r
    LEFT JOIN public.store_inventory si
      ON si.store_id = f.id AND si.medicine_id = r.mid AND si.stock > 0
    LEFT JOIN public.medicines m ON m.id = r.mid
    GROUP BY f.id
  )
  SELECT
    f.id,
    f.name,
    f.address,
    f.lat,
    f.lng,
    f.is_open,
    f.offers_delivery,
    ROUND(f.dist_km::numeric, 2)::double precision,
    COALESCE(ic.tp, 0),
    COALESCE(ic.missing, '{}')
  FROM filtered f
  LEFT JOIN inventory_check ic ON ic.sid = f.id
  ORDER BY
    (CASE WHEN COALESCE(array_length(ic.missing, 1), 0) = 0 THEN 0 ELSE 1 END),
    f.dist_km;
END;
$$ LANGUAGE plpgsql STABLE;


-- 3b. stores_for_pincode — find delivery-capable stores that service a pincode,
--     optionally checking medicine availability.
CREATE OR REPLACE FUNCTION public.stores_for_pincode(
  p_pincode     text,
  medicine_ids  uuid[] DEFAULT '{}'
)
RETURNS TABLE (
  store_id          uuid,
  store_name        text,
  address           text,
  lat               double precision,
  lng               double precision,
  is_open           boolean,
  offers_delivery   boolean,
  distance_km       double precision,
  total_price       numeric,
  missing_medicines text[]
) AS $$
BEGIN
  RETURN QUERY
  WITH requested AS (
    SELECT unnest(medicine_ids) AS mid
  ),
  matching_stores AS (
    SELECT s.*
    FROM public.stores s
    WHERE s.offers_delivery = true
      AND p_pincode = ANY(s.serviceable_pincodes)
  ),
  inventory_check AS (
    SELECT
      ms.id AS sid,
      COALESCE(SUM(CASE WHEN si.stock > 0 THEN si.price ELSE 0 END), 0) AS tp,
      ARRAY_AGG(m.name) FILTER (WHERE si.medicine_id IS NULL OR si.stock <= 0) AS missing
    FROM matching_stores ms
    CROSS JOIN requested r
    LEFT JOIN public.store_inventory si
      ON si.store_id = ms.id AND si.medicine_id = r.mid AND si.stock > 0
    LEFT JOIN public.medicines m ON m.id = r.mid
    GROUP BY ms.id
  )
  SELECT
    ms.id,
    ms.name,
    ms.address,
    ms.lat,
    ms.lng,
    ms.is_open,
    ms.offers_delivery,
    0.0::double precision,
    COALESCE(ic.tp, 0),
    COALESCE(ic.missing, '{}')
  FROM matching_stores ms
  LEFT JOIN inventory_check ic ON ic.sid = ms.id
  ORDER BY
    (CASE WHEN COALESCE(array_length(ic.missing, 1), 0) = 0 THEN 0 ELSE 1 END),
    ms.name;
END;
$$ LANGUAGE plpgsql STABLE;


-- 3c. place_order — atomically place an order: validate, lock inventory,
--     debit stock, insert line items, notify store owner.
--     Runs as SECURITY DEFINER so it can read auth.uid() and write across tables.
CREATE OR REPLACE FUNCTION public.place_order(
  p_store_id          uuid,
  p_fulfilment_type   text,
  p_items             jsonb,   -- [{"medicine_id": "uuid", "quantity": 1}, ...]
  p_delivery_address  text     DEFAULT NULL,
  p_delivery_pincode  text     DEFAULT NULL,
  p_prescription_path text     DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_order_id       uuid;
  v_total          numeric(10,2) := 0;
  v_handover_code  text;
  v_item           record;
  v_price          numeric(10,2);
  v_stock          integer;
  v_customer_id    uuid;
  v_store_owner_id uuid;
  v_has_rx         boolean := false;
  v_expires_at     timestamptz;
  v_expiry_minutes integer;
BEGIN
  -- Authenticate
  v_customer_id := auth.uid();
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify customer role
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_customer_id AND role = 'customer'
  ) THEN
    RAISE EXCEPTION 'Only customers can place orders';
  END IF;

  -- Validate fulfilment type
  IF p_fulfilment_type NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Invalid fulfilment type';
  END IF;

  -- Delivery requires address and pincode
  IF p_fulfilment_type = 'delivery'
     AND (p_delivery_address IS NULL OR p_delivery_pincode IS NULL) THEN
    RAISE EXCEPTION 'Delivery orders require address and pincode';
  END IF;

  -- Check if any items require prescription
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS x(medicine_id uuid, quantity int)
    JOIN public.medicines m ON m.id = x.medicine_id
    WHERE m.requires_prescription = true
  ) INTO v_has_rx;

  -- For delivery orders with Rx medicines, prescription is mandatory
  IF p_fulfilment_type = 'delivery' AND v_has_rx AND p_prescription_path IS NULL THEN
    RAISE EXCEPTION 'Prescription required for delivery orders with prescription medicines';
  END IF;

  -- Get store owner
  SELECT owner_id INTO v_store_owner_id
  FROM public.stores WHERE id = p_store_id;
  IF v_store_owner_id IS NULL THEN
    RAISE EXCEPTION 'Store not found';
  END IF;

  -- Generate 4-digit handover code
  v_handover_code := LPAD(floor(random() * 10000)::text, 4, '0');

  -- Calculate expiry (default 10 minutes, configurable via app.order_expiry_minutes)
  v_expiry_minutes := COALESCE(
    current_setting('app.order_expiry_minutes', true)::integer, 10
  );
  v_expires_at := now() + (v_expiry_minutes || ' minutes')::interval;

  IF p_prescription_path IS NOT NULL AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='prescriptions' AND name=p_prescription_path AND split_part(name,'/',1)=v_customer_id::text) THEN
    RAISE EXCEPTION 'Upload your prescription before ordering';
  END IF;
  -- Create order (total updated after line items)
  v_order_id := gen_random_uuid();
  INSERT INTO public.orders (
    id, customer_id, store_id, fulfilment_type, status,
    delivery_address, delivery_pincode, prescription_path,
    handover_code, total, expires_at
  ) VALUES (
    v_order_id, v_customer_id, p_store_id, p_fulfilment_type, 'pending',
    p_delivery_address, p_delivery_pincode, p_prescription_path,
    v_handover_code, 0, v_expires_at
  );

  -- Process each item: lock inventory row, verify stock, insert line item
  FOR v_item IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(medicine_id uuid, quantity int)
  LOOP
    -- Lock and fetch price/stock
    SELECT si.price, si.stock INTO v_price, v_stock
    FROM public.store_inventory si
    WHERE si.store_id = p_store_id AND si.medicine_id = v_item.medicine_id
    FOR UPDATE;

    IF v_price IS NULL THEN
      RAISE EXCEPTION 'Medicine % not available at this store', v_item.medicine_id;
    END IF;

    IF v_stock < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for medicine %', v_item.medicine_id;
    END IF;

    -- Debit stock
    UPDATE public.store_inventory
    SET stock = stock - v_item.quantity
    WHERE store_id = p_store_id AND medicine_id = v_item.medicine_id;

    -- Insert line item
    INSERT INTO public.order_items (order_id, medicine_id, quantity, unit_price)
    VALUES (v_order_id, v_item.medicine_id, v_item.quantity, v_price);

    v_total := v_total + (v_price * v_item.quantity);
  END LOOP;

  -- Update order total
  UPDATE public.orders SET total = v_total WHERE id = v_order_id;

  -- Notify store owner
  INSERT INTO public.notifications (user_id, order_id, message)
  VALUES (
    v_store_owner_id,
    v_order_id,
    'New ' || p_fulfilment_type || ' order received! Order total: ₹' || v_total
  );

  RETURN jsonb_build_object(
    'order_id',      v_order_id,
    'handover_code', v_handover_code,
    'total',         v_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ---------------------------------------------------------------------------
-- 4. TRIGGER FUNCTIONS
-- ---------------------------------------------------------------------------

-- 4a. restore_stock — when an order moves to a terminal-failure status,
--     return the reserved stock back to inventory.
CREATE OR REPLACE FUNCTION public.restore_stock()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IN ('rejected', 'cancelled', 'expired')
     AND OLD.status NOT IN ('rejected', 'cancelled', 'expired') THEN
    UPDATE public.store_inventory si
    SET stock = si.stock + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND si.store_id  = NEW.store_id
      AND si.medicine_id = oi.medicine_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 4b. validate_status_transition — enforce the order state machine.
CREATE OR REPLACE FUNCTION public.validate_status_transition()
RETURNS trigger AS $$
BEGIN
  -- Terminal statuses cannot change
  IF OLD.status IN ('completed', 'rejected', 'cancelled', 'expired', 'not_collected') THEN
    RAISE EXCEPTION 'Cannot change status of a % order', OLD.status;
  END IF;

  -- Valid transitions
  IF OLD.status = 'pending'
     AND NEW.status IN ('accepted', 'rejected', 'cancelled', 'expired') THEN
    RETURN NEW;

  ELSIF OLD.status = 'accepted'
        AND NEW.status IN ('ready', 'out_for_delivery', 'cancelled') THEN
    -- Pickup → ready;  Delivery → out_for_delivery
    IF NEW.status = 'ready' AND OLD.fulfilment_type != 'pickup' THEN
      RAISE EXCEPTION 'Only pickup orders can be marked ready';
    END IF;
    IF NEW.status = 'out_for_delivery' AND OLD.fulfilment_type != 'delivery' THEN
      RAISE EXCEPTION 'Only delivery orders can be marked out for delivery';
    END IF;
    RETURN NEW;

  ELSIF OLD.status IN ('ready', 'out_for_delivery')
        AND NEW.status IN ('completed', 'not_collected') THEN
    RETURN NEW;

  ELSE
    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- 4c. prevent_role_change — role is immutable after signup.
CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.role IS NOT NULL AND OLD.role != NEW.role THEN
    RAISE EXCEPTION 'Role cannot be changed after signup';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 4d. handle_new_user — auto-create a profile row when a new auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4e. expire_pending_orders — bulk-expire orders past their deadline.
CREATE OR REPLACE FUNCTION public.expire_pending_orders()
RETURNS void AS $$
BEGIN
  UPDATE public.orders
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ---------------------------------------------------------------------------
-- 5. TRIGGERS
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS on_status_change_validate ON public.orders;
CREATE TRIGGER on_status_change_validate
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_status_transition();

DROP TRIGGER IF EXISTS on_status_change_restore_stock ON public.orders;
CREATE TRIGGER on_status_change_restore_stock
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.restore_stock();

DROP TRIGGER IF EXISTS on_role_change ON public.profiles;
CREATE TRIGGER on_role_change
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_change();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ---------------------------------------------------------------------------
-- 6. PERMISSIONS & ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

-- Grant schema and table access to API roles (RLS policies govern row access)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.stores, public.medicines, public.store_inventory TO anon, authenticated;
GRANT SELECT ON public.profiles, public.orders, public.order_items, public.notifications TO authenticated;
GRANT INSERT, UPDATE ON public.stores, public.store_inventory TO authenticated;
GRANT UPDATE(status,reject_reason) ON public.orders TO authenticated;
GRANT UPDATE(read) ON public.notifications TO authenticated;
GRANT UPDATE(full_name,phone) ON public.profiles TO authenticated;

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   ENABLE ROW LEVEL SECURITY;

-- -- Profiles -----------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON public.profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile except role'
  ) THEN
    CREATE POLICY "Users can update own profile except role"
      ON public.profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END $$;

-- -- Stores ------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stores' AND policyname = 'Anyone can view stores'
  ) THEN
    CREATE POLICY "Anyone can view stores"
      ON public.stores FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stores' AND policyname = 'Owner can update own store'
  ) THEN
    CREATE POLICY "Owner can update own store"
      ON public.stores FOR UPDATE
      USING (auth.uid() = owner_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stores' AND policyname = 'Owner can insert store'
  ) THEN
    CREATE POLICY "Owner can insert store"
      ON public.stores FOR INSERT
      WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

-- -- Medicines ---------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'medicines' AND policyname = 'Anyone can view medicines'
  ) THEN
    CREATE POLICY "Anyone can view medicines"
      ON public.medicines FOR SELECT
      USING (true);
  END IF;
END $$;

-- -- Store Inventory ---------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'store_inventory' AND policyname = 'Anyone can view inventory'
  ) THEN
    CREATE POLICY "Anyone can view inventory"
      ON public.store_inventory FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'store_inventory' AND policyname = 'Owner can manage inventory'
  ) THEN
    CREATE POLICY "Owner can manage inventory"
      ON public.store_inventory FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.stores
          WHERE id = store_inventory.store_id AND owner_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'store_inventory' AND policyname = 'Owner can insert inventory'
  ) THEN
    CREATE POLICY "Owner can insert inventory"
      ON public.store_inventory FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.stores
          WHERE id = store_inventory.store_id AND owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- -- Orders ------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Customer can view own orders'
  ) THEN
    CREATE POLICY "Customer can view own orders"
      ON public.orders FOR SELECT
      USING (auth.uid() = customer_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Store owner can view store orders'
  ) THEN
    CREATE POLICY "Store owner can view store orders"
      ON public.orders FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.stores
          WHERE id = orders.store_id AND owner_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Customer can update own pending orders'
  ) THEN
    CREATE POLICY "Customer can update own pending orders"
      ON public.orders FOR UPDATE
      USING (auth.uid() = customer_id AND status = 'pending');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Store owner can update store orders'
  ) THEN
    CREATE POLICY "Store owner can update store orders"
      ON public.orders FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.stores
          WHERE id = orders.store_id AND owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- -- Order Items -------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Customer can view own order items'
  ) THEN
    CREATE POLICY "Customer can view own order items"
      ON public.order_items FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.orders
          WHERE id = order_items.order_id AND customer_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Store owner can view store order items'
  ) THEN
    CREATE POLICY "Store owner can view store order items"
      ON public.order_items FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.orders o
          JOIN public.stores s ON s.id = o.store_id
          WHERE o.id = order_items.order_id AND s.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- -- Notifications -----------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'User can view own notifications'
  ) THEN
    CREATE POLICY "User can view own notifications"
      ON public.notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'User can update own notifications'
  ) THEN
    CREATE POLICY "User can update own notifications"
      ON public.notifications FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 7. pg_cron — expire pending orders every minute
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  PERFORM cron.schedule(
    'expire-pending-orders',
    '* * * * *',
    'SELECT public.expire_pending_orders()'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron job skipped (extension may not be available or job already exists): %', SQLERRM;
END $$;


-- ---------------------------------------------------------------------------
-- 8. REALTIME — publish order & notification changes over Supabase Realtime
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'orders may already be in supabase_realtime publication';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notifications may already be in supabase_realtime publication';
END $$;


-- ===========================================================================
-- END OF MIGRATION
-- ===========================================================================
