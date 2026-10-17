-- ═══════════════════════════════════════════════════════════════════════════════
-- Datos de ejemplo para la cuenta de revisión de Google Play (ParkNow)
-- Cuenta: parknow.revisiondev@gmail.com (debe existir: se crea desde la app)
-- Ejecutar en el SQL Editor del proyecto de Supabase de PARKNOW, nunca en el de
-- Finance. Se puede correr varias veces: primero borra las reservas de ESA cuenta
-- (devolviendo sus cupos) y luego las vuelve a crear. No toca ninguna otra cuenta.
--
-- Crea:
--   • una reserva próxima (mañana de 10:00 a 11:00) con su QR de entrada;
--   • una reserva terminada (ayer), para que el historial no esté vacío.
-- Requiere que existan horarios para mañana en time_slots (schema.sql los
-- genera para los 7 días siguientes a su ejecución).
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  review_email CONSTANT text := 'parknow.revisiondev@gmail.com';
  uid      uuid;
  lot      parking_lots%ROWTYPE;
  slot_ids uuid[];
  res_id   uuid;
  start_at timestamptz := (current_date + 1) + time '10:00';
  end_at   timestamptz := (current_date + 1) + time '11:00';
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = review_email;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No existe la cuenta %. Créala primero desde la app.', review_email;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = uid) THEN
    RAISE EXCEPTION 'La cuenta % no tiene perfil. Inicia sesión una vez en la app para crearlo.', review_email;
  END IF;

  -- Limpieza: devolver cupos de reservas activas y borrar las anteriores.
  UPDATE time_slots ts
     SET available_capacity = ts.available_capacity + c.n
    FROM (SELECT rs.slot_id, count(*) AS n
            FROM reservation_slots rs
            JOIN reservations r ON r.id = rs.reservation_id
           WHERE r.owner_id = uid AND r.status = 'RESERVED'
           GROUP BY rs.slot_id) c
   WHERE ts.id = c.slot_id;
  DELETE FROM reservations WHERE owner_id = uid;

  SELECT * INTO lot FROM parking_lots ORDER BY name LIMIT 1;
  IF lot.id IS NULL THEN
    RAISE EXCEPTION 'No hay parqueaderos. Ejecuta primero supabase/schema.sql.';
  END IF;

  -- 1. Reserva próxima: los dos bloques de 30 min de mañana a las 10:00.
  SELECT array_agg(id ORDER BY starts_at) INTO slot_ids
    FROM time_slots
   WHERE parking_lot_id = lot.id AND starts_at >= start_at AND ends_at <= end_at
     AND available_capacity > 0;
  IF coalesce(array_length(slot_ids, 1), 0) < 2 THEN
    RAISE EXCEPTION 'No hay horarios para mañana en %. Vuelve a generar time_slots.', lot.name;
  END IF;

  INSERT INTO reservations (owner_id, parking_lot_id, vehicle_plate, vehicle_type, starts_at, ends_at,
                            status, arrival_deadline_at, assigned_floor, assigned_spot)
  VALUES (uid, lot.id, 'RVW123', 'CAR', start_at, end_at,
          'RESERVED', start_at + interval '25 minutes', 1, 12)
  RETURNING id INTO res_id;

  INSERT INTO reservation_slots (reservation_id, slot_id) SELECT res_id, unnest(slot_ids);
  UPDATE time_slots SET available_capacity = available_capacity - 1 WHERE id = ANY (slot_ids);

  INSERT INTO qr_tokens (reservation_id, token_hash, purpose, expires_at)
  VALUES (res_id, md5(random()::text) || md5(random()::text), 'ENTRY', start_at + interval '25 minutes');

  INSERT INTO payments (reservation_id, type, amount, status)
  VALUES (res_id, 'RESERVATION', lot.price_per_block * 2, 'SUCCESS');

  -- 2. Reserva terminada: ayer de 15:00 a 16:30 (sin cupos: ya pasó).
  INSERT INTO reservations (owner_id, parking_lot_id, vehicle_plate, vehicle_type, starts_at, ends_at,
                            status, arrival_deadline_at, checked_in_at, checked_out_at,
                            assigned_floor, assigned_spot)
  VALUES (uid, lot.id, 'RVW123', 'CAR',
          (current_date - 1) + time '15:00', (current_date - 1) + time '16:30',
          'COMPLETED', (current_date - 1) + time '15:25',
          (current_date - 1) + time '15:08', (current_date - 1) + time '16:21', 2, 4)
  RETURNING id INTO res_id;

  INSERT INTO payments (reservation_id, type, amount, status)
  VALUES (res_id, 'RESERVATION', lot.price_per_block * 3, 'SUCCESS');

  RAISE NOTICE 'Listo: 2 reservas para % en %.', review_email, lot.name;
END;
$$;
