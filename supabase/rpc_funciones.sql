-- =====================================================================
-- FASE 3 — Funciones RPC que reemplazan la lógica de agregados/lectura de
-- Código.gs que hoy vive en Apps Script. Pégalo en el SQL Editor de
-- Supabase y dale Run (después de schema.sql, seed_stands.sql, grants.sql).
-- =====================================================================

-- ---------------------------------------------------------------------
-- obtener_progreso(id) — reemplaza obtenerProgresoAsistente() de Código.gs.
-- Pública (anon): la pantalla "Ver mi progreso" no exige login, cualquiera
-- con su propio ID puede consultar SU propio avance. security definer +
-- search_path fijo para que pueda leer `attendees`/`stand_visits` aunque
-- el rol "anon" no tenga SELECT directo sobre esas tablas — el punto es
-- justo que esta función expone SOLO los datos de ESE id, nunca la tabla
-- completa (ver nota en schema.sql).
-- ---------------------------------------------------------------------
create or replace function public.obtener_progreso(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attendee record;
  v_total int;
  v_max int;
  v_detalle jsonb;
begin
  select id, nombre, empresa into v_attendee
  from public.attendees
  where id = upper(trim(p_id));

  if not found then
    return jsonb_build_object('success', false, 'mensaje', '❌ Código ID no encontrado.');
  end if;

  select count(*) into v_max from public.stands where activo;

  select coalesce(jsonb_agg(jsonb_build_object('nombre', s.nombre, 'visitado', (sv.attendee_id is not null)) order by s.orden), '[]'::jsonb),
         count(sv.attendee_id)
    into v_detalle, v_total
  from public.stands s
  left join public.stand_visits sv on sv.stand_id = s.id and sv.attendee_id = v_attendee.id
  where s.activo;

  return jsonb_build_object(
    'success', true,
    'nombre', v_attendee.nombre,
    'empresa', coalesce(v_attendee.empresa, '---'),
    'total', v_total,
    'maxStands', v_max,
    'aptoSorteo', v_total = v_max,
    'detalle', v_detalle
  );
end;
$$;

grant execute on function public.obtener_progreso(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- obtener_metricas_mkt() — reemplaza obtenerMetricasMKT(). Exige staff MKT
-- (chequeo explícito de es_staff_mkt(), igual que en las Edge Functions
-- ya desplegadas) en vez de depender solo de RLS, para devolver un mensaje
-- de sesión expirada claro en vez de un simple vacío.
-- ---------------------------------------------------------------------
create or replace function public.obtener_metricas_mkt()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_ingresados int;
  v_aptos int;
  v_max int;
  v_ranking jsonb;
begin
  if not public.es_staff_mkt() then
    return jsonb_build_object('success', false, 'mensaje', '⛔ Sesión no autorizada o expirada. Vuelve a iniciar sesión en el panel MKT.');
  end if;

  select count(*) into v_total from public.attendees;
  select count(*) into v_ingresados from public.attendees where asistencia_at is not null;
  select count(*) into v_max from public.stands where activo;

  select count(*) into v_aptos
  from (
    select sv.attendee_id
    from public.stand_visits sv
    join public.stands s on s.id = sv.stand_id and s.activo
    group by sv.attendee_id
    having count(*) = v_max
  ) sub;

  select coalesce(jsonb_agg(jsonb_build_object('nombre', s.nombre, 'visitas', coalesce(v.cnt, 0)) order by coalesce(v.cnt, 0) desc), '[]'::jsonb)
    into v_ranking
  from public.stands s
  left join (select stand_id, count(*) cnt from public.stand_visits group by stand_id) v on v.stand_id = s.id
  where s.activo;

  return jsonb_build_object(
    'success', true,
    'total', v_total,
    'ingresados', v_ingresados,
    'aptos', v_aptos,
    'maxStands', v_max,
    'ranking', v_ranking
  );
end;
$$;

-- Postgres otorga EXECUTE a PUBLIC por defecto en funciones nuevas — sin este
-- revoke, cualquier llamada sin sesión (rol "anon") también podría ejecutarla
-- (el chequeo de es_staff_mkt() de arriba la protege igual, pero mejor negar
-- la ejecución desde la capa de permisos también, no solo desde la lógica).
revoke execute on function public.obtener_metricas_mkt() from public;
grant execute on function public.obtener_metricas_mkt() to authenticated;

-- ---------------------------------------------------------------------
-- obtener_lista_asistentes_mkt() — reemplaza obtenerListaAsistentesMKT().
-- Se sigue trayendo la lista completa de una sola vez (igual que hoy): el
-- buscador filtra en el cliente, sin ida y vuelta al servidor por cada
-- tecla, y ese mismo array en memoria alimenta el buscador de coincidencias
-- del registro manual y la exportación de "aptos al sorteo".
-- ---------------------------------------------------------------------
create or replace function public.obtener_lista_asistentes_mkt()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_lista jsonb;
begin
  if not public.es_staff_mkt() then
    return jsonb_build_object('success', false, 'mensaje', '⛔ Sesión no autorizada o expirada. Vuelve a iniciar sesión en el panel MKT.');
  end if;

  select count(*) into v_max from public.stands where activo;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'nombre', a.nombre,
    'email', coalesce(a.email, '---'),
    'celular', coalesce(a.celular, '---'),
    'empresa', coalesce(a.empresa, '---'),
    'ruc', coalesce(a.ruc, '---'),
    'totalStands', coalesce(v.cnt, 0)
  ) order by a.created_at desc), '[]'::jsonb)
    into v_lista
  from public.attendees a
  left join (
    select sv.attendee_id, count(*) cnt
    from public.stand_visits sv
    join public.stands s on s.id = sv.stand_id and s.activo
    group by sv.attendee_id
  ) v on v.attendee_id = a.id;

  return jsonb_build_object('success', true, 'asistentes', v_lista, 'maxStands', v_max);
end;
$$;

revoke execute on function public.obtener_lista_asistentes_mkt() from public;
grant execute on function public.obtener_lista_asistentes_mkt() to authenticated;
