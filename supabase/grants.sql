-- =====================================================================
-- Otorga los permisos base de tabla (GRANT) que "Automatically expose new
-- tables" habría dado automáticamente si lo hubiéramos dejado activado al
-- crear el proyecto. Lo desactivamos a propósito para ser explícitos, así
-- que hay que declarar esto a mano.
--
-- GRANT es una capa DISTINTA e independiente de RLS:
--   - GRANT decide si el rol puede tocar la tabla en absoluto.
--   - RLS decide qué filas puede ver/tocar de las que sí puede tocar.
-- service_role se salta RLS, pero SIGUE necesitando el GRANT.
--
-- Pégalo en el SQL Editor y dale Run.
-- =====================================================================

grant usage on schema public to service_role, authenticated, anon;

-- anon: la pantalla de selección de stand (PIN) se muestra ANTES de cualquier
-- login — necesita listar nombres de stand sin sesión. stands_publico ya
-- excluye el PIN por diseño, así que exponerla a "anon" no es una regresión
-- de seguridad: es lo mismo que el array NOMBRES_STANDS hardcodeado que hoy
-- vive en el cliente, pero como fuente única y en vivo.
grant select on public.stands_publico to anon;

-- service_role: usado SOLO desde Edge Functions (nunca llega al navegador).
grant select, insert, update on public.stands        to service_role;
grant select, insert, update on public.attendees      to service_role;
grant select, insert           on public.stand_visits to service_role;
grant select                   on public.admin_users   to service_role;
grant select                   on public.stands_publico to service_role;

-- authenticated: staff MKT logueado por Supabase Auth. El GRANT abre la
-- operación; las políticas RLS (es_staff_mkt()) siguen filtrando las filas.
grant select, insert, update on public.attendees      to authenticated;
grant select, insert           on public.stand_visits to authenticated;
grant select                   on public.admin_users   to authenticated;
grant select                   on public.stands_publico to authenticated;
