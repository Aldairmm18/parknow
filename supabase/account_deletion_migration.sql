-- =============================================================================
-- ParkNow: eliminación de cuenta desde la app (requisito de Google Play y App Store)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase, después de schema.sql.
-- ⚠️ Solo en el proyecto de Supabase de ParkNow, NUNCA en el de Finance: allá
-- existe otra función con el mismo nombre y esta la reemplazaría.
-- =============================================================================
-- La app llama a supabase.rpc('delete_own_account'). La función corre con
-- privilegios del dueño (SECURITY DEFINER) pero solo puede borrar la cuenta de
-- quien la invoca (auth.uid()), nunca la de otra persona.
--
-- Qué hace, en el mismo orden que promete el aviso de Ajustes → Privacidad:
--   1. Si hay un vehículo dentro del parqueadero (CHECKED_IN), se niega: primero
--      hay que salir, si no el QR de salida dejaría de existir.
--   2. Cancela las reservas futuras y devuelve sus cupos al inventario.
--   3. Las reservas con un pago exitoso se conservan por obligación contable,
--      pero anónimas: sin dueño y sin placa.
--   4. El resto de reservas se borra (con sus cupos, QR, pagos y eventos).
--   5. Borra el perfil (public.users) y la cuenta de acceso (auth.users).

-- ─── Columnas que usa la app y que schema.sql no creaba ──────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url            text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_provider         text NOT NULL DEFAULT 'EMAIL';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS accepted_terms_at     timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS marketing_opt_in      boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

-- Una reserva anonimizada ya no tiene dueño.
ALTER TABLE public.reservations ALTER COLUMN owner_id DROP NOT NULL;

-- ─── Función ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    paid uuid[];
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;

    IF EXISTS (SELECT 1 FROM reservations WHERE owner_id = uid AND status = 'CHECKED_IN') THEN
        RAISE EXCEPTION 'Tienes un vehículo dentro del parqueadero. Sal primero y luego elimina tu cuenta.';
    END IF;

    -- 2. Reservas futuras: cancelarlas y liberar sus cupos.
    -- Se cuenta por bloque: dos reservas en el mismo bloque devuelven dos cupos.
    UPDATE time_slots ts
       SET available_capacity = ts.available_capacity + c.n
      FROM (SELECT rs.slot_id, count(*) AS n
              FROM reservation_slots rs
              JOIN reservations r ON r.id = rs.reservation_id
             WHERE r.owner_id = uid AND r.status = 'RESERVED'
             GROUP BY rs.slot_id) c
     WHERE ts.id = c.slot_id;

    UPDATE reservations SET status = 'CANCELLED'
     WHERE owner_id = uid AND status = 'RESERVED';

    -- Los QR identifican a la persona en la entrada: se borran siempre.
    UPDATE check_events ce SET qr_token_id = NULL
      FROM reservations r
     WHERE ce.reservation_id = r.id AND r.owner_id = uid;

    DELETE FROM qr_tokens q
     USING reservations r
     WHERE q.reservation_id = r.id AND r.owner_id = uid;

    -- 3. Reservas pagadas: se conservan sin datos personales.
    SELECT coalesce(array_agg(DISTINCT r.id), '{}') INTO paid
      FROM reservations r
      JOIN payments p ON p.reservation_id = r.id
     WHERE r.owner_id = uid AND p.status = 'SUCCESS';

    UPDATE reservations
       SET owner_id = NULL, vehicle_plate = '******'
     WHERE id = ANY (paid);

    -- 4. El resto se borra; slots, pagos y eventos caen en cascada.
    DELETE FROM reservations WHERE owner_id = uid;

    -- 5. Perfil y cuenta de acceso.
    DELETE FROM users WHERE id = uid;
    DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
