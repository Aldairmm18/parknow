-- ParkNow: configuración completa de la base (schema.sql + account_deletion_migration.sql).
-- Generado para pegar de una vez en el SQL Editor del proyecto de PARKNOW.

-- ParkNow Supabase Schema
-- Run this in your Supabase SQL Editor

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table if not exists users (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  phone        text,
  email        text unique not null,
  status       text not null default 'ACTIVE',
  created_at   timestamptz not null default now()
);

create table if not exists parking_lots (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid,
  name             text not null,
  total_capacity   int not null,
  car_capacity     int not null default 0,
  moto_capacity    int not null default 0,
  price_per_block  numeric(10,2) not null,
  address          text,
  latitude         numeric,
  longitude        numeric
);

create table if not exists time_slots (
  id                  uuid primary key default gen_random_uuid(),
  parking_lot_id      uuid not null references parking_lots(id) on delete cascade,
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  available_capacity  int not null,
  price_per_block     numeric(10,2)
);

create table if not exists reservations (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid() references users(id),
  parking_lot_id       uuid not null references parking_lots(id),
  vehicle_plate        text not null,
  vehicle_type         text not null default 'CAR',
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  status               text not null default 'RESERVED',
  arrival_deadline_at  timestamptz,
  checked_in_at        timestamptz,
  checked_out_at       timestamptz,
  assigned_floor       int,
  assigned_spot        int,
  created_at           timestamptz not null default now()
);

create table if not exists reservation_slots (
  reservation_id  uuid not null references reservations(id) on delete cascade,
  slot_id         uuid not null references time_slots(id),
  primary key (reservation_id, slot_id)
);

create table if not exists qr_tokens (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references reservations(id) on delete cascade,
  token_hash      text unique not null,
  purpose         text not null,
  expires_at      timestamptz not null,
  used_at         timestamptz
);

create table if not exists payments (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references reservations(id) on delete cascade,
  type            text not null,
  amount          numeric(10,2) not null,
  status          text not null default 'PENDING',
  created_at      timestamptz not null default now()
);

create table if not exists check_events (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references reservations(id) on delete cascade,
  qr_token_id     uuid references qr_tokens(id),
  type            text not null,
  result          text not null,
  reason          text,
  event_at        timestamptz not null default now()
);

-- ─── RPCs ─────────────────────────────────────────────────────────────────────

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

-- ─── Row Level Security ────────────────────────────────────────────────────────

alter table users enable row level security;
alter table parking_lots enable row level security;
alter table time_slots enable row level security;
alter table reservations enable row level security;
alter table reservation_slots enable row level security;
alter table qr_tokens enable row level security;
alter table payments enable row level security;
alter table check_events enable row level security;

-- Users: can read/update their own row
create policy "users_select_own" on users for select using (auth.uid() = id);
create policy "users_insert_own" on users for insert with check (auth.uid() = id);
create policy "users_update_own" on users for update using (auth.uid() = id);

-- Parking lots: public read
create policy "parking_lots_public_read" on parking_lots for select using (true);

-- Time slots: public read
create policy "time_slots_public_read" on time_slots for select using (true);
-- Sin política de UPDATE: los cupos solo cambian con decrement/increment_slot_capacity.

-- Reservations: owner only
create policy "reservations_select_own" on reservations for select using (auth.uid() = owner_id);
create policy "reservations_insert_own" on reservations for insert with check (auth.uid() = owner_id);
create policy "reservations_update_own" on reservations for update using (auth.uid() = owner_id);

-- Reservation slots: owner only (via join)
create policy "reservation_slots_select_own" on reservation_slots for select
  using (exists (select 1 from reservations r where r.id = reservation_id and r.owner_id = auth.uid()));
create policy "reservation_slots_insert_own" on reservation_slots for insert
  with check (exists (select 1 from reservations r where r.id = reservation_id and r.owner_id = auth.uid()));

-- QR tokens: owner only
create policy "qr_tokens_select_own" on qr_tokens for select
  using (exists (select 1 from reservations r where r.id = reservation_id and r.owner_id = auth.uid()));
create policy "qr_tokens_insert_own" on qr_tokens for insert
  with check (exists (select 1 from reservations r where r.id = reservation_id and r.owner_id = auth.uid()));
create policy "qr_tokens_update_own" on qr_tokens for update
  using (exists (select 1 from reservations r where r.id = reservation_id and r.owner_id = auth.uid()));

-- Payments: owner only
create policy "payments_select_own" on payments for select
  using (exists (select 1 from reservations r where r.id = reservation_id and r.owner_id = auth.uid()));
create policy "payments_insert_own" on payments for insert
  with check (exists (select 1 from reservations r where r.id = reservation_id and r.owner_id = auth.uid()));

-- Check events: owner only
create policy "check_events_insert_own" on check_events for insert
  with check (exists (select 1 from reservations r where r.id = reservation_id and r.owner_id = auth.uid()));

-- ─── Seed Data ────────────────────────────────────────────────────────────────

insert into parking_lots (id, name, total_capacity, car_capacity, moto_capacity, price_per_block, address, latitude, longitude)
values
  ('11111111-1111-1111-1111-111111111111', 'ParkNow Demo Poblado',  120, 80, 40,  1200, 'El Poblado, Medellín',       6.2008, -75.5740),
  ('22222222-2222-2222-2222-222222222222', 'ParkNow Demo Las Lomas',    80,  60, 20,  1500, 'Las Lomas, Medellín',        6.1980, -75.5729),
  ('33333333-3333-3333-3333-333333333333', 'ParkNow Demo Laureles',    200, 140, 60, 1000, 'Laureles-Estadio, Medellín', 6.2431, -75.5742)
on conflict (id) do nothing;

-- Horarios: bloques de 30 min de 06:00 a 22:00 hora de Colombia, 7 días.
-- La regeneración diaria (pg_cron) está en time_slots_migration.sql.
CREATE UNIQUE INDEX IF NOT EXISTS time_slots_lot_start_key
  ON public.time_slots (parking_lot_id, starts_at);

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
