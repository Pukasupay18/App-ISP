-- =====================================================================
-- MÓDULO DE ASISTENCIA V3 — Schema inicial (Arequipa, oct 2026)
-- Pega este archivo COMPLETO en el SQL Editor de un proyecto Supabase
-- NUEVO (no el de Huancayo/V2) y dale Run.
--
-- Proyecto de PRUEBAS (cuenta personal, datos falsos únicamente):
--   URL:              https://ibdzfmllapcsmqcnycqh.supabase.co
--   Project Ref ID:   ibdzfmllapcsmqcnycqh
-- Cuando se valide todo, se crea un proyecto NUEVO en la cuenta real de
-- Fiberlux y se corre este mismo archivo ahí — no se migra este proyecto
-- de pruebas, para no arrastrar datos falsos al evento real.
--
-- Diferencias clave respecto al schema de V2:
--   - Nada de PIN: los stands y sponsors se identifican por un `codigo`
--     propio en la URL (/stand/:codigo, /sponsor/:codigo), igual que el
--     asistente ya se identifica por su `id` de gafete en /pase/:id.
--   - Sin vistas públicas. `stands_publico` en V2 es una vista, y las
--     vistas corren con los permisos de quien las creó — se saltan el
--     RLS de la tabla real. Aquí todo lo público sale de funciones RPC
--     (security definer, con columnas explícitas), no de vistas.
--   - `event_config`: interruptores en vivo que antes eran hardcodeados o
--     no existían (registro_abierto, sorteo_abierto, umbral_boletos).
--   - `boletos_extra`: generaliza las acciones que suman boleto además de
--     visitar stands (seguir redes, unirse al canal, dejar reseña).
--   - Sin tablas de banners — la publicidad va hardcodeada en el repo del
--     frontend (decisión tomada para no gastar peticiones del free tier).
-- =====================================================================

-- ---------------------------------------------------------------------
-- ADMIN_USERS — allowlist de staff MKT (idéntico patrón a V2). Se llena
-- a mano desde el SQL Editor, ligando cada fila a una cuenta real de
-- Supabase Auth ya creada.
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

create or replace function public.es_staff_mkt()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- EVENT_CONFIG — interruptores en vivo del evento. Fila única forzada
-- (id = 1). Se lee/escribe SOLO por staff MKT o por funciones RPC —
-- ningún cliente público toca esta tabla directo, ver nota de RLS abajo.
-- ---------------------------------------------------------------------
create table public.event_config (
  id                 int primary key default 1,
  registro_abierto   boolean not null default true,
  sorteo_abierto     boolean not null default false,
  umbral_boletos     int not null default 5,
  cronograma_sheet_url text,
  updated_at         timestamptz not null default now(),
  constraint una_sola_fila check (id = 1)
);
insert into public.event_config (id) values (1);

alter table public.event_config enable row level security;

-- Nadie público la lee directo — el snapshot cacheado (Vercel /api) usa
-- una RPC security definer que sí puede leerla. Solo staff MKT puede
-- verla/editarla desde el panel de Configuración.
create policy "staff MKT lee config"
  on public.event_config for select
  using (public.es_staff_mkt());

create policy "staff MKT edita config"
  on public.event_config for update
  using (public.es_staff_mkt());

-- ---------------------------------------------------------------------
-- STANDS
-- `codigo` reemplaza al PIN: es el token de acceso de /stand/:codigo,
-- no es secreto compartido de palabra, es el link que Marketing entrega
-- una vez a cada stand. `codigo_sponsor` es un segundo código, aparte,
-- para /sponsor/:codigo — solo se usa si el stand es tier Premium.
-- El tier se deriva de esta tabla (lookup real), nunca hardcodeado en
-- el frontend — regla no negociable del brief.
-- ---------------------------------------------------------------------
create table public.stands (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  codigo         text not null unique,
  codigo_sponsor text unique,
  tier           text not null default 'basico' check (tier in ('premium', 'basico')),
  activo         boolean not null default true,
  orden          int not null,
  created_at     timestamptz not null default now()
);
alter table public.stands enable row level security;
-- A propósito: CERO políticas para anon/authenticated genérico. El
-- listado público (para el carrusel de stands del asistente) y la
-- resolución de un código puntual salen de RPCs (ver rpc_funciones.sql),
-- nunca de una vista ni de un select directo a esta tabla.

create policy "staff MKT lee stands"
  on public.stands for select
  using (public.es_staff_mkt());

create policy "staff MKT edita stands"
  on public.stands for update
  using (public.es_staff_mkt());

-- ---------------------------------------------------------------------
-- ATTENDEES (asistentes)
-- `id` sigue siendo el código legible del gafete ("CQ0427FX") — es el
-- mismo valor que identifica /pase/:id, no hace falta un token aparte
-- (ver discusión: el pase solo expone lo que ya está en el gafete físico).
-- `origen` distingue quién los cargó — útil para cuando importemos el
-- padrón real desde tu Sheet de inscripciones (mismo patrón que V2:
-- ver sincronizar-inscripciones-formulario). Cuando tengas la estructura
-- de ese Sheet lista, escribimos la función de importación apuntada aquí.
-- ---------------------------------------------------------------------
create table public.attendees (
  id              text primary key,
  nombre          text not null,
  email           text,
  celular         text,
  empresa         text,
  ruc             text,
  asistencia_at   timestamptz,
  origen          text not null default 'manual' check (origen in ('manual', 'sync_sheet')),
  participa_sorteo boolean not null default false,
  participa_en    timestamptz,
  created_at      timestamptz not null default now()
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

-- Nota: sin política de SELECT/UPDATE para "anon". El propio asistente
-- consulta y actualiza SU pase (progreso, participar en sorteo) solo a
-- través de RPCs security definer que reciben su `id` como parámetro y
-- devuelven/tocan exclusivamente esa fila — nunca la tabla completa.

-- ---------------------------------------------------------------------
-- STAND_VISITS — igual que V2: la PK compuesta reemplaza cualquier lock,
-- dos escaneos simultáneos del mismo QR en el mismo stand chocan contra
-- la constraint y el segundo no hace nada.
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

-- El registro público de una visita (desde /stand/:codigo, sin sesión de
-- staff) pasa por la RPC `marcar_visita_stand` (security definer), que
-- valida el código del stand internamente — por eso no hace falta una
-- política de insert para "anon" aquí.

-- ---------------------------------------------------------------------
-- BOLETOS_EXTRA — boletos de rifa que NO vienen de visitar un stand:
-- seguir una red social, unirse al canal de difusión, dejar una reseña.
-- Un boleto por tipo por asistente (la PK compuesta evita que alguien
-- reclame el mismo boleto dos veces con clics repetidos).
--
-- Total de boletos de un asistente = count(stand_visits) + count(esta
-- tabla). "Apto al sorteo" = ese total >= event_config.umbral_boletos —
-- UNA sola fórmula, en una sola función RPC, consumida tanto por el
-- banner de urgencia del asistente como por el KPI de Mkt (regla no
-- negociable del brief: nunca dos constantes distintas para lo mismo).
-- ---------------------------------------------------------------------
create table public.boletos_extra (
  attendee_id text not null references public.attendees (id) on delete cascade,
  tipo        text not null check (tipo in ('red_social', 'canal', 'resena')),
  creado_en   timestamptz not null default now(),
  primary key (attendee_id, tipo)
);

alter table public.boletos_extra enable row level security;

create policy "staff MKT lee boletos extra"
  on public.boletos_extra for select
  using (public.es_staff_mkt());

-- Igual que stand_visits: la escritura pública pasa por una RPC
-- (`registrar_boleto_extra`), no por una política de insert directa.

-- =====================================================================
-- GRANTS — capa DISTINTA e independiente de RLS (igual que en V2: RLS
-- decide qué filas, GRANT decide si el rol puede tocar la tabla).
--
-- A propósito, "anon" no recibe NINGÚN grant de tabla en este archivo:
-- cada cosa que un visitante sin sesión necesita (ver su pase, escanear
-- un stand, sumar un boleto, participar del sorteo, listar stands para
-- el carrusel) sale de una función RPC con `security definer`, definida
-- en rpc_funciones.sql. Las funciones RPC corren con los permisos de
-- quien las creó (tú, desde el SQL Editor), no con los de "anon" — por
-- eso no hace falta abrir las tablas de base directamente.
--
-- service_role SÍ necesita algo de acceso: las dos Edge Functions que
-- sobreviven en V3 (buscar-empresa-por-ruc, sincronizar-inscripciones)
-- siguen usando la service_role key directo, no pasan por RPC.
-- =====================================================================
grant usage on schema public to service_role, authenticated, anon;

grant select, insert on public.attendees to service_role;

grant select, insert, update on public.attendees      to authenticated;
grant select, insert           on public.stand_visits  to authenticated;
grant select, insert           on public.boletos_extra to authenticated;
grant select, insert, update on public.stands          to authenticated;
grant select, update           on public.event_config   to authenticated;
grant select                   on public.admin_users     to authenticated;

-- =====================================================================
-- Próximo archivo: rpc_funciones.sql, con (nombres tentativos):
--   obtener_snapshot_publico()      — lo que cachea /api/snapshot en Vercel
--   obtener_pase(p_id)              — progreso + boletos + estado del pase
--   resolver_stand(p_codigo)        — nombre + tier del stand, para /stand
--   marcar_visita_stand(...)        — 1 sola llamada: valida + inserta
--   registrar_boleto_extra(...)     — red social / canal / reseña
--   participar_sorteo(p_id)         — solo si event_config.sorteo_abierto
--   resolver_sponsor(p_codigo_sponsor) + obtener_panel_sponsor(...)
--   obtener_metricas_mkt(), obtener_lista_asistentes_mkt(),
--   obtener_lista_sorteo_mkt()      — el pool final para exportar a Excel
--   registro_manual(...)            — crear/editar asistente en puerta
-- =====================================================================
