-- =============================================================================
-- ParkNow: correcciones de seguridad (hallazgos de React Doctor, 2026-10-17)
-- Ejecutar UNA VEZ en el SQL Editor del proyecto de PARKNOW, después de
-- setup_parknow.sql. Se puede volver a ejecutar sin problema.
-- =============================================================================

-- 1. time_slots: nadie puede editar la tabla directamente.
--    La política anterior ("using (true)") dejaba que cualquiera, incluso sin
--    sesión y solo con la anon key pública, cambiara cupos y precios de
--    cualquier horario. Ahora los cupos solo cambian con las dos funciones de
--    abajo, que corren con privilegios del dueño.
DROP POLICY IF EXISTS "time_slots_update_rpc" ON public.time_slots;

CREATE OR REPLACE FUNCTION public.decrement_slot_capacity(slot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  UPDATE time_slots
     SET available_capacity = available_capacity - 1
   WHERE id = slot_id AND available_capacity > 0;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay capacidad disponible para el slot %', slot_id;
  END IF;
END;
$$;

-- Devolver un cupo nunca puede dejar el bloque por encima de la capacidad del
-- parqueadero: así nadie puede "inflar" la disponibilidad llamándola en bucle.
CREATE OR REPLACE FUNCTION public.increment_slot_capacity(slot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  UPDATE time_slots ts
     SET available_capacity = ts.available_capacity + 1
    FROM parking_lots pl
   WHERE ts.id = slot_id
     AND pl.id = ts.parking_lot_id
     AND ts.available_capacity < pl.total_capacity;
END;
$$;

REVOKE ALL ON FUNCTION public.decrement_slot_capacity(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_slot_capacity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decrement_slot_capacity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_slot_capacity(uuid) TO authenticated;

-- 2. reservations.owner_id lo asigna la base de datos, no la app (igual que en
--    Finance con user_id). La política de inserción sigue exigiendo que sea
--    auth.uid(), así que un valor distinto enviado a mano se rechaza.
ALTER TABLE public.reservations ALTER COLUMN owner_id SET DEFAULT auth.uid();
