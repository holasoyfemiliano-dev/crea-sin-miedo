-- Crea sin Miedo — Database Schema
-- Run this in Supabase SQL Editor

-- Asistentes (paying attendees)
create table if not exists csm_asistentes (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  email            text not null,
  telefono         text,
  tipo             text not null check (tipo in ('general','vip','full')),
  monto            numeric(10,2) default 0,
  mp_payment_id    text unique,
  mp_preference_id text,
  pagado           boolean default false,
  check_in         boolean default false,
  check_in_at      timestamptz,
  fecha_registro   timestamptz default now(),
  notas            text
);

create index if not exists csm_asistentes_email_idx on csm_asistentes(email);
create index if not exists csm_asistentes_tipo_idx  on csm_asistentes(tipo);
create index if not exists csm_asistentes_pagado_idx on csm_asistentes(pagado);

-- Invitados gratis (manually added)
create table if not exists csm_invitados (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  email          text,
  telefono       text,
  tier           text default 'general' check (tier in ('general','vip','full')),
  notas          text,
  check_in       boolean default false,
  check_in_at    timestamptz,
  fecha_registro timestamptz default now()
);

-- Discount codes
create table if not exists csm_codigos_descuento (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  tipo        text not null check (tipo in ('porcentaje','gratis')),
  descuento   numeric(5,2) default 0,   -- percentage (0–100) or ignored if gratis
  tier        text default 'all',        -- 'all', 'general', 'vip', 'full'
  usos_max    int,                        -- null = unlimited
  usos        int default 0,
  activo      boolean default true,
  created_at  timestamptz default now()
);

-- Staff
create table if not exists csm_staff (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  rol              text,
  area             text,
  horario_entrada  text,
  horario_salida   text,
  telefono         text,
  tareas           text[],
  notas            text
);

-- Cronograma (editable schedule)
create table if not exists csm_cronograma (
  id           uuid primary key default gen_random_uuid(),
  hora         text not null,
  actividad    text not null,
  responsable  text,
  lugar        text,
  notas        text,
  tipo         text default 'publico' check (tipo in ('publico','staff','break'))
);

-- RPC: atomic coupon increment
create or replace function increment_coupon_uso(coupon_id uuid)
returns void language sql as $$
  update csm_codigos_descuento
  set usos = usos + 1
  where id = coupon_id;
$$;

-- RLS: disable for now (use service key from server only)
alter table csm_asistentes        disable row level security;
alter table csm_invitados         disable row level security;
alter table csm_codigos_descuento disable row level security;
alter table csm_staff             disable row level security;
alter table csm_cronograma        disable row level security;

-- Sample discount codes (optional)
insert into csm_codigos_descuento (codigo, tipo, descuento, tier, usos_max)
values
  ('PRENSA2026',  'gratis',      0,  'general', 5),
  ('VIP20',       'porcentaje',  20, 'vip',     null),
  ('FULL15',      'porcentaje',  15, 'full',    null),
  ('EARLY50',     'porcentaje',  50, 'all',     20)
on conflict (codigo) do nothing;
