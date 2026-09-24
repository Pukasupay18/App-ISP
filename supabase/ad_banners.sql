-- Espacio publicitario administrable desde Supabase (Table Editor), sin tocar
-- index.html. Reemplaza los arrays PUBLICIDAD_HOME/PUBLICIDAD_PROGRESO
-- hardcodeados en el frontend.
--
-- Correr UNA VEZ en el SQL Editor de Supabase.

-- ---------------------------------------------------------------------
-- AD_CONFIG — interruptor único global: apaga/enciende TODO el espacio
-- publicitario (ambos carruseles) sin tener que desactivar banner por
-- banner. Fila única forzada con el check (id = 1).
-- ---------------------------------------------------------------------
create table public.ad_config (
  id     int primary key default 1,
  activo boolean not null default true,
  constraint una_sola_fila check (id = 1)
);
insert into public.ad_config (id, activo) values (1, true);

alter table public.ad_config enable row level security;

create policy "cualquiera lee el interruptor del espacio publicitario"
  on public.ad_config for select
  using (true);

-- Sin políticas de insert/update: se edita a mano desde el Table Editor
-- (usa el rol de dashboard, no la anon key, así que no necesita policy).

-- ---------------------------------------------------------------------
-- AD_BANNERS — cada fila es una imagen del carrusel. "ubicacion" decide en
-- cuál de las dos pantallas aparece; "orden" decide la secuencia; "activo"
-- permite pausar un banner puntual sin borrarlo (ej. campaña vencida).
-- ---------------------------------------------------------------------
create table public.ad_banners (
  id         uuid primary key default gen_random_uuid(),
  ubicacion  text not null check (ubicacion in ('home', 'progreso')),
  img_url    text not null,        -- URL pública de la imagen (Drive público, CDN, etc.)
  link       text,                 -- URL a abrir al hacer clic (o NULL si no es clickeable)
  orden      int not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_ad_banners_ubicacion on public.ad_banners (ubicacion, orden);

alter table public.ad_banners enable row level security;

create policy "cualquiera lee banners activos"
  on public.ad_banners for select
  using (activo = true);

-- Sin políticas de insert/update/delete: se administra a mano desde el
-- Table Editor de Supabase (agregar fila = agregar banner; ubicacion =
-- 'home' o 'progreso'; pegar el link de la imagen en img_url).

-- ---------------------------------------------------------------------
-- GRANT — capa DISTINTA e independiente de RLS (ver supabase/grants.sql).
-- Este proyecto tiene "Automatically expose new tables" desactivado, así
-- que toda tabla nueva necesita este paso a mano o PostgREST le niega el
-- acceso a "anon" aunque la policy de arriba diga que sí puede leer.
-- ---------------------------------------------------------------------
grant select on public.ad_config  to anon, authenticated;
grant select on public.ad_banners to anon, authenticated;
