-- =====================================================================
-- FASE 0 — Schema inicial (Fiberlux ISP: migración Sheets -> Supabase)
-- Pega este archivo completo en el SQL Editor de Supabase y dale Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STANDS
-- El PIN vive SOLO en esta tabla base, y esta tabla NUNCA se expone
-- directa al cliente (ni a "authenticated" ni a "anon") — se valida
-- exclusivamente desde una Edge Function con la service_role key, igual
-- que hoy el PIN nunca sale de Código.gs. Para que el staff MKT vea la
-- lista de nombres en "Apoyar un Stand", se usa la vista pública de abajo.
-- ---------------------------------------------------------------------
create table public.stands (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  pin        text not null unique,
  activo     boolean not null default true,
  orden      int not null,
  created_at timestamptz not null default now()
);
alter table public.stands enable row level security;
-- A propósito: CERO políticas sobre public.stands. Nadie con la anon/authenticated
-- key puede leer ni escribir esta tabla; solo las Edge Functions (service_role).

-- Vista sin el PIN, para que el staff MKT pueda listar los stands (tiles de
-- "Apoyar sin PIN") sin exponer el secreto.
create view public.stands_publico as
  select id, nombre, activo, orden from public.stands;

-- ---------------------------------------------------------------------
-- ADMIN_USERS — allowlist de staff MKT. No basta con "estar autenticado":
-- solo cuenta como staff quien tenga una fila aquí, ligada a su cuenta de
-- Supabase Auth. Se administra a mano desde el SQL Editor por ahora.
-- ---------------------------------------------------------------------
create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nombre     text,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create policy "un staff puede ver su propia fila"
  on public.admin_users for select
  using (auth.uid() = user_id);

-- Helper: ¿el usuario autenticado actual es staff MKT?
create or replace function public.es_staff_mkt()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- ATTENDEES (asistentes)
-- ---------------------------------------------------------------------
create table public.attendees (
  id            text primary key,               -- mismo esquema legible: "HR0001FX"
  nombre        text not null,
  email         text,
  celular       text,
  empresa       text,
  ruc           text,
  asistencia_at timestamptz,                     -- null = no ha hecho check-in de puerta
  origen        text not null default 'manual',  -- 'manual' | 'sync_formulario'
  created_at    timestamptz not null default now()
);
create unique index attendees_nombre_email_key
  on public.attendees (lower(nombre), lower(coalesce(email, '')));
create index idx_attendees_email on public.attendees (lower(email));

alter table public.attendees enable row level security;

create policy "staff MKT lee asistentes"
  on public.attendees for select
  using (public.es_staff_mkt());

create policy "staff MKT crea asistentes"
  on public.attendees for insert
  with check (public.es_staff_mkt());

create policy "staff MKT edita asistentes"
  on public.attendees for update
  using (public.es_staff_mkt());

-- Nota: NO hay política de SELECT para "anon". La consulta de progreso del
-- propio asistente (pantalla pública, sin login) pasa por una función RPC
-- aparte (Fase 2) que devuelve solo los datos de ESE id, nunca la tabla.

-- ---------------------------------------------------------------------
-- STAND_VISITS
-- La clave primaria compuesta reemplaza al candado global: dos escaneos
-- simultáneos del mismo QR en el mismo stand chocan contra la constraint
-- y el segundo simplemente no hace nada (ON CONFLICT DO NOTHING desde la
-- Edge Function), sin necesidad de LockService ni nada parecido.
-- ---------------------------------------------------------------------
create table public.stand_visits (
  attendee_id text not null references public.attendees (id) on delete cascade,
  stand_id    uuid not null references public.stands (id),
  visited_at  timestamptz not null default now(),
  primary key (attendee_id, stand_id)
);
create index idx_stand_visits_stand on public.stand_visits (stand_id);

alter table public.stand_visits enable row level security;

create policy "staff MKT lee visitas"
  on public.stand_visits for select
  using (public.es_staff_mkt());

create policy "staff MKT registra visitas"
  on public.stand_visits for insert
  with check (public.es_staff_mkt());

-- El registro de visita vía PIN de stand (sin sesión de staff) lo hace la
-- Edge Function marcar-stand con la service_role key, que se salta RLS por
-- diseño — por eso no hace falta una política para "anon" aquí.
