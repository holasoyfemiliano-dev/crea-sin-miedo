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

-- Eventos (ediciones del taller — una fila por ciudad/fecha)
create table if not exists csm_eventos (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  ciudad           text not null,
  venue            text,
  direccion        text,
  maps_url         text,
  fecha            date not null,
  capacidad        int default 80,
  estado           text default 'proximo' check (estado in ('proximo','activo','finalizado')),
  notas_produccion text,
  created_at       timestamptz default now()
);

create index if not exists csm_eventos_fecha_idx on csm_eventos(fecha);

-- Registro simple al taller (invitación, sin pago)
create table if not exists csm_registro_taller (
  id               uuid primary key default gen_random_uuid(),
  evento_id        uuid references csm_eventos(id),
  nombre           text not null,
  email            text not null unique,
  telefono         text,
  ocupacion        text,
  fecha_registro   timestamptz default now()
);

create index if not exists csm_registro_taller_email_idx on csm_registro_taller(email);
create index if not exists csm_registro_taller_evento_idx on csm_registro_taller(evento_id);

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
  evento_id        uuid references csm_eventos(id),
  nombre           text not null,
  rol              text,
  area             text,
  horario_entrada  text,
  horario_salida   text,
  telefono         text,
  tareas           text[],
  notas            text
);

create index if not exists csm_staff_evento_idx on csm_staff(evento_id);

-- Cronograma (editable schedule) — sirve tanto para el cronograma general
-- (tipo publico/break, lo que ve el asistente) como el de producción
-- (fotografia/video/entrega/staff, para filmmakers y crew)
create table if not exists csm_cronograma (
  id           uuid primary key default gen_random_uuid(),
  evento_id    uuid references csm_eventos(id),
  hora         text not null,
  actividad    text not null,
  responsable  text,
  lugar        text,
  notas        text,
  tipo         text default 'publico' check (tipo in ('publico','staff','break','fotografia','video','entrega')),
  completado   boolean default false,
  orden        int default 0,
  duracion_min int
);

create index if not exists csm_cronograma_evento_idx on csm_cronograma(evento_id, orden);

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
alter table csm_registro_taller   disable row level security;
alter table csm_eventos           disable row level security;

-- Sample discount codes (optional)
insert into csm_codigos_descuento (codigo, tipo, descuento, tier, usos_max)
values
  ('PRENSA2026',  'gratis',      0,  'general', 5),
  ('VIP20',       'porcentaje',  20, 'vip',     null),
  ('FULL15',      'porcentaje',  15, 'full',    null),
  ('EARLY50',     'porcentaje',  50, 'all',     20)
on conflict (codigo) do nothing;
