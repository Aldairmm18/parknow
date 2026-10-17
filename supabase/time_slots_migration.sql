-- =============================================================================
-- ParkNow: horarios en hora de Colombia y regeneración diaria
-- Ejecutar UNA VEZ en el SQL Editor del proyecto de PARKNOW. Se puede repetir.
-- =============================================================================
-- Problema: schema.sql generaba los bloques de 06:00 a 22:00 en UTC, así que en
-- la app el parqueadero "abría" a la 01:00 y cerraba a las 17:00 (hora de
-- Colombia, UTC−5). Además sólo creaba 7 días: después no había horarios.

-- 1. Un bloque por parqueadero y hora de inicio: evita duplicados al regenerar.
--    Antes se borran los bloques mal generados que nadie ha reservado.
DELETE FROM public.time_slots ts
 WHERE NOT EXISTS (SELECT 1 FROM public.reservation_slots rs WHERE rs.slot_id = ts.id)
   AND extract(hour FROM ts.starts_at AT TIME ZONE 'America/Bogota') NOT BETWEEN 6 AND 21;

CREATE UNIQUE INDEX IF NOT EXISTS time_slots_lot_start_key
  ON public.time_slots (parking_lot_id, starts_at);

-- 2. Genera los bloques de 30 min, de 06:00 a 22:00 hora de Colombia, para los
--    próximos `days` días. Los que ya existen no se tocan.
CREATE OR REPLACE FUNCTION public.generate_time_slots(days int DEFAULT 7)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  INSERT INTO time_slots (parking_lot_id, starts_at, ends_at, available_capacity, price_per_block)
  SELECT pl.id,
         (d + time '06:00' + h * interval '30 minutes') AT TIME ZONE 'America/Bogota',
         (d + time '06:00' + (h + 1) * interval '30 minutes') AT TIME ZONE 'America/Bogota',
         pl.total_capacity,
         pl.price_per_block
    FROM parking_lots pl
   CROSS JOIN generate_series(today, today + days - 1, interval '1 day') AS g(day)
   CROSS JOIN LATERAL (SELECT g.day::date AS d) AS dd
   CROSS JOIN generate_series(0, 31) AS h
  ON CONFLICT (parking_lot_id, starts_at) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_time_slots(int) FROM PUBLIC, anon, authenticated;

SELECT public.generate_time_slots(7);

-- 3. Regeneración diaria a las 00:05 hora de Colombia (05:05 UTC).
--    pg_cron viene con Supabase; si el CREATE EXTENSION falla, actívala en
--    Database → Extensions → pg_cron y vuelve a ejecutar sólo este bloque.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule('parknow-generate-slots')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'parknow-generate-slots');
SELECT cron.schedule('parknow-generate-slots', '5 5 * * *', 'SELECT public.generate_time_slots(7)');
