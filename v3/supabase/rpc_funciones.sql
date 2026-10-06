-- =====================================================================
-- MÓDULO DE ASISTENCIA V3 — Funciones RPC
-- Correr DESPUÉS de schema.sql y seed_stands.sql. Pega este archivo
-- completo en el SQL Editor y dale Run.
--
-- Patrón general (igual que V2): todo lo público pasa por una función
-- `security definer` que expone solo lo necesario — nunca una tabla ni
-- una vista directa. Las funciones de staff Mkt chequean es_staff_mkt()
-- explícitamente y devuelven un mensaje claro de sesión expirada, además
-- del REVOKE/GRANT a nivel de permisos (defensa en dos capas).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de boletos — ÚNICA fuente de verdad para "cuántos boletos
-- tiene" y "es apto al sorteo" (regla no negociable del brief: nunca dos
-- constantes distintas para lo mismo). obtener_pase, obtener_snapshot_
-- publico, obtener_metricas_mkt y obtener_lista_sorteo_mkt pasan TODOS
-- por estas dos funciones, nunca recalculan el umbral por su cuenta.
--
-- Visitar un stand NO suma boletos (es un recurso del propio stand para
-- registrar su lead). Cada tipo de boletos_extra pesa distinto — el peso
-- vive únicamente acá, ver también el comentario de la tabla en
-- schema.sql.
-- ---------------------------------------------------------------------
create or replace function public.total_boletos(p_id text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case tipo
      when 'canal' then 3
      when 'resena' then 1
      when 'red_facebook' then 2
      when 'red_instagram' then 2
      when 'red_linkedin' then 2
      when 'red_tiktok' then 2
      else 0
    end
  ), 0)
  from public.boletos_extra where attendee_id = p_id;
$$;

create or replace function public.es_apto_sorteo(p_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.total_boletos(p_id) >= (select umbral_boletos from public.event_config where id = 1);
$$;

create or replace function public.contar_aptos_sorteo()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from public.attendees a where public.es_apto_sorteo(a.id);
$$;

grant execute on function public.total_boletos(text)     to anon, authenticated;
grant execute on function public.es_apto_sorteo(text)     to anon, authenticated;
grant execute on function public.contar_aptos_sorteo()    to anon, authenticated;

-- ---------------------------------------------------------------------
-- obtener_snapshot_publico() — lo que cachea /api/snapshot en Vercel.
-- Público, sin parámetros: el conteo de aptos y los flags del evento,
-- NUNCA datos de una persona puntual. Refrescado cada 45-90s desde el
-- cliente (vía el snapshot cacheado, no llamando esto directo).
-- ---------------------------------------------------------------------
create or replace function public.obtener_snapshot_publico()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_config record;
begin
  select registro_abierto, sorteo_abierto, umbral_boletos
    into v_config
  from public.event_config where id = 1;

  return jsonb_build_object(
    'success', true,
    'aptosSorteo', public.contar_aptos_sorteo(),
    'registroAbierto', v_config.registro_abierto,
    'sorteoAbierto', v_config.sorteo_abierto,
    'umbralBoletos', v_config.umbral_boletos
  );
end;
$$;

grant execute on function public.obtener_snapshot_publico() to anon, authenticated;

-- ---------------------------------------------------------------------
-- obtener_pase(p_id) — reemplaza a obtener_progreso de V2, con boletos
-- (stands + acciones extra) en vez de solo stands, y el estado del
-- sorteo para que el frontend sepa si mostrar el botón "Participar".
-- ---------------------------------------------------------------------
create or replace function public.obtener_pase(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attendee record;
  v_config record;
  v_detalle jsonb;
  v_boletos_extra jsonb;
begin
  select id, nombre, empresa, participa_sorteo into v_attendee
  from public.attendees where id = upper(trim(p_id));

  if not found then
    return jsonb_build_object('success', false, 'mensaje', '❌ Código no encontrado.');
  end if;

  select registro_abierto, sorteo_abierto, umbral_boletos into v_config
  from public.event_config where id = 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', s.nombre,
           'visitado', (sv.attendee_id is not null)
         ) order by s.orden), '[]'::jsonb)
    into v_detalle
  from public.stands s
  left join public.stand_visits sv on sv.stand_id = s.id and sv.attendee_id = v_attendee.id
  where s.activo;

  select coalesce(jsonb_agg(tipo), '[]'::jsonb) into v_boletos_extra
  from public.boletos_extra where attendee_id = v_attendee.id;

  return jsonb_build_object(
    'success', true,
    'nombre', v_attendee.nombre,
    'empresa', coalesce(v_attendee.empresa, '---'),
    'boletosTotal', public.total_boletos(v_attendee.id),
    'umbralBoletos', v_config.umbral_boletos,
    'aptoSorteo', public.es_apto_sorteo(v_attendee.id),
    'participaSorteo', v_attendee.participa_sorteo,
    'sorteoAbierto', v_config.sorteo_abierto,
    'stands', v_detalle,
    'boletosExtraHechos', v_boletos_extra
  );
end;
$$;

grant execute on function public.obtener_pase(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- participar_sorteo(p_id) — opt-in del asistente, solo mientras Marketing
-- tiene abierta la ventana del sorteo (event_config.sorteo_abierto). Así
-- el sorteo se corre sobre quien de verdad sigue en el evento en ese
-- momento, no sobre todo el que alguna vez calificó (ver brief: el
-- problema real de llamar nombres de gente que ya se fue).
-- ---------------------------------------------------------------------
create or replace function public.participar_sorteo(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_sorteo_abierto boolean;
begin
  select id into v_id from public.attendees where id = upper(trim(p_id));
  if not found then
    return jsonb_build_object('success', false, 'mensaje', '❌ Código no encontrado.');
  end if;

  select sorteo_abierto into v_sorteo_abierto from public.event_config where id = 1;
  if not v_sorteo_abierto then
    return jsonb_build_object('success', false, 'mensaje', '⏳ El sorteo todavía no está abierto para inscripción.');
  end if;

  update public.attendees set participa_sorteo = true, participa_en = now() where id = v_id;

  return jsonb_build_object(
    'success', true,
    'apto', public.es_apto_sorteo(v_id),
    'mensaje', '✅ ¡Quedaste participando del sorteo!'
  );
end;
$$;

grant execute on function public.participar_sorteo(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- registrar_boleto_extra(p_id, p_tipo) — suma un boleto por una acción
-- que no es visitar un stand (seguir red social, unirse al canal, dejar
-- reseña). La PK compuesta de boletos_extra evita que el mismo botón
-- clickeado dos veces sume boletos de más.
-- ---------------------------------------------------------------------
create or replace function public.registrar_boleto_extra(p_id text, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  if p_tipo not in ('red_facebook', 'red_instagram', 'red_linkedin', 'red_tiktok', 'canal', 'resena') then
    return jsonb_build_object('success', false, 'mensaje', '⚠️ Tipo de boleto no válido.');
  end if;

  select id into v_id from public.attendees where id = upper(trim(p_id));
  if not found then
    return jsonb_build_object('success', false, 'mensaje', '❌ Código no encontrado.');
  end if;

  insert into public.boletos_extra (attendee_id, tipo) values (v_id, p_tipo)
    on conflict (attendee_id, tipo) do nothing;

  return jsonb_build_object(
    'success', true,
    'boletosTotal', public.total_boletos(v_id),
    'mensaje', '✅ ¡Boleto sumado!'
  );
end;
$$;

grant execute on function public.registrar_boleto_extra(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- obtener_cronograma() — agenda del evento para /pase (brief 4.1).
-- Contenido estático: el frontend la pide UNA vez al cargar, sin polling
-- (a diferencia de obtener_snapshot_publico, que sí cambia en vivo).
-- ---------------------------------------------------------------------
create or replace function public.obtener_cronograma()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'hora', hora,
           'actividad', actividad,
           'expositor', expositor
         ) order by orden), '[]'::jsonb)
  from public.cronograma;
$$;

grant execute on function public.obtener_cronograma() to anon, authenticated;

-- ---------------------------------------------------------------------
-- resolver_stand(p_codigo) — resuelve el código de la URL /stand/:codigo
-- a nombre + tier + si tiene Panel Sponsor habilitado. El botón "Panel"
-- del frontend se muestra/oculta según `panelSponsor`, nunca hardcodeado.
-- ---------------------------------------------------------------------
create or replace function public.resolver_stand(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_stand record;
begin
  select id, nombre, tier, panel_sponsor, codigo_sponsor into v_stand
  from public.stands where codigo = p_codigo and activo;

  if not found then
    return jsonb_build_object('success', false, 'mensaje', '❌ Código de stand no válido.');
  end if;

  return jsonb_build_object(
    'success', true,
    'standId', v_stand.id,
    'nombre', v_stand.nombre,
    'tier', v_stand.tier,
    'panelSponsor', v_stand.panel_sponsor,
    -- Solo se expone si el panel está activo — es lo que arma el botón
    -- "Panel" del brief 4.2 (link directo desde la pantalla del stand,
    -- sin que la persona tenga que teclear un segundo código a mano).
    'codigoSponsor', case when v_stand.panel_sponsor then v_stand.codigo_sponsor else null end
  );
end;
$$;

grant execute on function public.resolver_stand(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- marcar_visita_stand(p_codigo_stand, p_attendee_id) — 1 sola llamada:
-- valida el código del stand, valida el asistente, inserta la visita.
-- Reemplaza a validar-pin-stand + marcar-stand (2 Edge Functions, 3
-- consultas) de V2 por 1 RPC con 1 viaje a la base.
-- ---------------------------------------------------------------------
create or replace function public.marcar_visita_stand(p_codigo_stand text, p_attendee_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stand record;
  v_attendee record;
  v_insertado boolean;
begin
  select id, nombre, tier into v_stand from public.stands where codigo = p_codigo_stand and activo;
  if not found then
    return jsonb_build_object('success', false, 'mensaje', '❌ Código de stand no válido.');
  end if;

  -- Los stands Complementario no tienen función de escaneo (son auspicio
  -- institucional, no un punto físico que registra leads) — bloqueado acá
  -- también a nivel de datos, no solo ocultando el botón en el frontend.
  if v_stand.tier = 'complementario' then
    return jsonb_build_object('success', false, 'mensaje', '⛔ Este stand (nivel Complementario) no tiene función de escaneo.');
  end if;

  select id, nombre, empresa into v_attendee
  from public.attendees where id = upper(trim(p_attendee_id));
  if not found then
    return jsonb_build_object('success', false, 'mensaje', '❌ Código de asistente no válido.');
  end if;

  insert into public.stand_visits (attendee_id, stand_id)
    values (v_attendee.id, v_stand.id)
    on conflict (attendee_id, stand_id) do nothing;
  get diagnostics v_insertado = row_count;
  v_insertado := (v_insertado::int > 0);

  return jsonb_build_object(
    'success', true,
    'yaEstaba', not v_insertado,
    'attendeeNombre', v_attendee.nombre,
    'attendeeEmpresa', coalesce(v_attendee.empresa, '---'),
    'standNombre', v_stand.nombre,
    'boletosTotal', public.total_boletos(v_attendee.id),
    'mensaje', case when v_insertado
      then '✅ ' || v_stand.nombre || ' registró a: ' || v_attendee.nombre
      else 'ℹ️ ' || v_attendee.nombre || ' ya estaba registrado en ' || v_stand.nombre
    end
  );
end;
$$;

grant execute on function public.marcar_visita_stand(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- anotar_visita_stand(p_codigo_stand, p_attendee_id, p_nota) — segunda
-- llamada, solo si el rep del stand decide escribir la nota comercial
-- opcional después de ver el resultado del escaneo (brief 4.2). Exige el
-- código del stand de nuevo para que un stand no pueda anotar la visita
-- de OTRO stand.
-- ---------------------------------------------------------------------
create or replace function public.anotar_visita_stand(p_codigo_stand text, p_attendee_id text, p_nota text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stand_id uuid;
  v_actualizado boolean;
begin
  select id into v_stand_id from public.stands where codigo = p_codigo_stand and activo;
  if not found then
    return jsonb_build_object('success', false, 'mensaje', '❌ Código de stand no válido.');
  end if;

  update public.stand_visits set nota = p_nota
    where stand_id = v_stand_id and attendee_id = upper(trim(p_attendee_id));
  get diagnostics v_actualizado = row_count;
  v_actualizado := (v_actualizado::int > 0);

  if not v_actualizado then
    return jsonb_build_object('success', false, 'mensaje', '❌ No se encontró esa visita para este stand.');
  end if;

  return jsonb_build_object('success', true, 'mensaje', '✅ Nota guardada.');
end;
$$;

grant execute on function public.anotar_visita_stand(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- resolver_sponsor(p_codigo_sponsor) + obtener_panel_sponsor(...) —
-- /sponsor/:codigo. Solo responde si panel_sponsor está activo para ese
-- stand — si Marketing lo apaga, el link deja de funcionar al instante,
-- sin que el stand necesite enterarse ni cambiar nada de su lado.
--
-- Pendiente (fuera de esta función, requiere decisión aparte): "staff
-- activo" del brief 4.3 no se calcula aquí — no hay sesiones de staff
-- por stand en este modelo (solo el código de acceso), así que esa
-- métrica queda sin dato real por ahora.
--
-- Decisión tomada (no pendiente): el envío de la base de datos propia
-- del sponsor por correo (brief 4.3) NO se construye — Marketing lo
-- envía a mano post-evento con los datos de obtener_panel_sponsor /
-- obtener_lista_asistentes_mkt. No hay botón "Solicitar base de datos"
-- en el panel sponsor, ni función de email.
-- ---------------------------------------------------------------------
create or replace function public.resolver_sponsor(p_codigo_sponsor text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_stand record;
begin
  select id, nombre into v_stand
  from public.stands
  where codigo_sponsor = p_codigo_sponsor and panel_sponsor and activo;

  if not found then
    return jsonb_build_object('success', false, 'mensaje', '❌ Código no válido o panel no habilitado para este stand.');
  end if;

  return jsonb_build_object('success', true, 'standId', v_stand.id, 'nombre', v_stand.nombre);
end;
$$;

grant execute on function public.resolver_sponsor(text) to anon, authenticated;

create or replace function public.obtener_panel_sponsor(p_codigo_sponsor text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stand record;
  v_visitas_hoy int;
  v_total_visitas int;
  v_ultimos jsonb;
begin
  select id, nombre into v_stand
  from public.stands
  where codigo_sponsor = p_codigo_sponsor and panel_sponsor and activo;

  if not found then
    return jsonb_build_object('success', false, 'mensaje', '❌ Código no válido o panel no habilitado para este stand.');
  end if;

  select count(*) into v_visitas_hoy
  from public.stand_visits
  where stand_id = v_stand.id
    and (visited_at at time zone 'America/Lima')::date = (now() at time zone 'America/Lima')::date;

  select count(*) into v_total_visitas
  from public.stand_visits where stand_id = v_stand.id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', t.nombre,
           'empresa', t.empresa,
           'nota', t.nota,
           'visitedAt', t.visited_at
         ) order by t.visited_at desc), '[]'::jsonb)
    into v_ultimos
  from (
    select a.nombre, coalesce(a.empresa, '---') as empresa, sv.nota, sv.visited_at
    from public.stand_visits sv
    join public.attendees a on a.id = sv.attendee_id
    where sv.stand_id = v_stand.id
    order by sv.visited_at desc
    limit 10
  ) t;

  return jsonb_build_object(
    'success', true,
    'nombre', v_stand.nombre,
    'visitasHoy', v_visitas_hoy,
    'totalVisitas', v_total_visitas,
    'ultimosVisitantes', v_ultimos
  );
end;
$$;

grant execute on function public.obtener_panel_sponsor(text) to anon, authenticated;

-- =====================================================================
-- A partir de acá: funciones SOLO staff Mkt — revoke de "public" +
-- grant explícito a "authenticated", además del chequeo es_staff_mkt()
-- adentro (defensa en dos capas, mismo patrón que V2).
-- =====================================================================

-- ---------------------------------------------------------------------
-- obtener_metricas_mkt() — resumen del dashboard: totales + ranking de
-- stands con su última visita (para las alertas de "stand sin actividad
-- reciente" del brief 4.5.1 — el frontend decide el umbral de minutos,
-- esta función solo entrega el dato crudo).
-- ---------------------------------------------------------------------
create or replace function public.obtener_metricas_mkt()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config record;
  v_ranking jsonb;
begin
  if not public.es_staff_mkt() then
    return jsonb_build_object('success', false, 'mensaje', '⛔ Sesión no autorizada o expirada. Vuelve a iniciar sesión en el panel MKT.');
  end if;

  select registro_abierto, sorteo_abierto, umbral_boletos into v_config
  from public.event_config where id = 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', s.nombre,
           'tier', s.tier,
           'panelSponsor', s.panel_sponsor,
           'visitas', coalesce(v.cnt, 0),
           'ultimaVisita', v.ultima
         ) order by coalesce(v.cnt, 0) desc), '[]'::jsonb)
    into v_ranking
  from public.stands s
  left join (
    select stand_id, count(*) cnt, max(visited_at) ultima
    from public.stand_visits group by stand_id
  ) v on v.stand_id = s.id
  where s.activo;

  return jsonb_build_object(
    'success', true,
    'total', (select count(*) from public.attendees),
    'ingresados', (select count(*) from public.attendees where asistencia_at is not null),
    'aptos', public.contar_aptos_sorteo(),
    'umbralBoletos', v_config.umbral_boletos,
    'registroAbierto', v_config.registro_abierto,
    'sorteoAbierto', v_config.sorteo_abierto,
    'ranking', v_ranking
  );
end;
$$;

revoke execute on function public.obtener_metricas_mkt() from public;
grant execute on function public.obtener_metricas_mkt() to authenticated;

-- ---------------------------------------------------------------------
-- obtener_lista_asistentes_mkt() — para el buscador y el registro
-- manual (coincidencias). Trae todo de una vez, igual que V2: el
-- filtro corre en el cliente, sin ida y vuelta al servidor por tecla.
-- ---------------------------------------------------------------------
create or replace function public.obtener_lista_asistentes_mkt()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lista jsonb;
begin
  if not public.es_staff_mkt() then
    return jsonb_build_object('success', false, 'mensaje', '⛔ Sesión no autorizada o expirada. Vuelve a iniciar sesión en el panel MKT.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id,
           'nombre', a.nombre,
           'email', coalesce(a.email, '---'),
           'celular', coalesce(a.celular, '---'),
           'empresa', coalesce(a.empresa, '---'),
           'ruc', coalesce(a.ruc, '---'),
           'ingresado', (a.asistencia_at is not null),
           'boletosTotal', public.total_boletos(a.id),
           'participaSorteo', a.participa_sorteo
         ) order by a.created_at desc), '[]'::jsonb)
    into v_lista
  from public.attendees a;

  return jsonb_build_object('success', true, 'asistentes', v_lista);
end;
$$;

revoke execute on function public.obtener_lista_asistentes_mkt() from public;
grant execute on function public.obtener_lista_asistentes_mkt() to authenticated;

-- ---------------------------------------------------------------------
-- obtener_lista_sorteo_mkt() — el pool final para el sorteo: solo
-- quienes confirmaron presencia (participa_sorteo) Y llegan al umbral.
-- Se llama una sola vez, al momento de sortear, no en vivo.
-- ---------------------------------------------------------------------
create or replace function public.obtener_lista_sorteo_mkt()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lista jsonb;
begin
  if not public.es_staff_mkt() then
    return jsonb_build_object('success', false, 'mensaje', '⛔ Sesión no autorizada o expirada. Vuelve a iniciar sesión en el panel MKT.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id,
           'nombre', a.nombre,
           'empresa', coalesce(a.empresa, '---'),
           'celular', coalesce(a.celular, '---'),
           'boletosTotal', public.total_boletos(a.id),
           'participaEn', a.participa_en
         ) order by a.participa_en), '[]'::jsonb)
    into v_lista
  from public.attendees a
  where a.participa_sorteo and public.es_apto_sorteo(a.id);

  return jsonb_build_object('success', true, 'asistentes', v_lista);
end;
$$;

revoke execute on function public.obtener_lista_sorteo_mkt() from public;
grant execute on function public.obtener_lista_sorteo_mkt() to authenticated;

-- ---------------------------------------------------------------------
-- registro_manual(...) — crea o edita un asistente en puerta. A
-- diferencia de V2 (que descargaba TODA la tabla a JS para buscar
-- duplicados), acá se intenta el insert directo y se atrapa la
-- violación de la constraint única — mucho más liviano, sin traer nada
-- de más. El correlativo del ID sale de una sequence real (atómica),
-- no de un count(*) que puede chocar entre dos registros simultáneos.
-- ---------------------------------------------------------------------
create sequence if not exists public.attendees_correlativo_seq;

create or replace function public.generar_id_asistente(p_nombre text, p_correlativo text)
returns text
language plpgsql
immutable
as $$
declare
  v_partes text[];
  v_iniciales text;
begin
  v_partes := regexp_split_to_array(trim(p_nombre), '\s+');
  if array_length(v_partes, 1) >= 2 then
    v_iniciales := upper(left(v_partes[1], 1) || left(v_partes[2], 1));
  else
    v_iniciales := upper(rpad(left(v_partes[1], 2), 2, 'X'));
  end if;
  return v_iniciales || p_correlativo || 'FX';
end;
$$;

create or replace function public.registro_manual(
  p_mode text,
  p_id text,
  p_nombre_completo text,
  p_email text,
  p_celular text,
  p_empresa text,
  p_ruc text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_nuevo text;
  v_correlativo text;
begin
  if not public.es_staff_mkt() then
    return jsonb_build_object('success', false, 'mensaje', '⛔ Sesión no autorizada o expirada. Vuelve a iniciar sesión en el panel MKT.');
  end if;

  if p_mode = 'crear' then
    v_correlativo := lpad(nextval('public.attendees_correlativo_seq')::text, 4, '0');
    v_id_nuevo := public.generar_id_asistente(coalesce(nullif(trim(p_nombre_completo), ''), 'Usuario Sin Nombre'), v_correlativo);

    begin
      insert into public.attendees (id, nombre, email, celular, empresa, ruc, asistencia_at, origen)
      values (
        v_id_nuevo,
        coalesce(nullif(trim(p_nombre_completo), ''), 'Usuario Sin Nombre'),
        nullif(trim(p_email), ''),
        nullif(trim(p_celular), ''),
        nullif(trim(p_empresa), ''),
        nullif(trim(p_ruc), ''),
        now(),
        'manual'
      );
    exception when unique_violation then
      return jsonb_build_object(
        'success', false,
        'mensaje', '⚠️ Ya existe un asistente registrado con ese mismo nombre y correo. Búscalo y usa Editar.'
      );
    end;

    return jsonb_build_object('success', true, 'id', v_id_nuevo, 'mensaje', '✅ ¡Registro nuevo exitoso! ID: ' || v_id_nuevo);

  elsif p_mode = 'actualizar' then
    if p_id is null or trim(p_id) = '' then
      return jsonb_build_object('success', false, 'mensaje', '❌ Falta el ID a actualizar.');
    end if;

    begin
      update public.attendees set
        nombre = coalesce(nullif(trim(p_nombre_completo), ''), nombre),
        email = nullif(trim(p_email), ''),
        celular = nullif(trim(p_celular), ''),
        empresa = nullif(trim(p_empresa), ''),
        ruc = nullif(trim(p_ruc), ''),
        asistencia_at = now()
      where id = trim(p_id);
    exception when unique_violation then
      return jsonb_build_object('success', false, 'mensaje', '⚠️ Ese nombre + correo ya pertenece a otro asistente registrado.');
    end;

    if not found then
      return jsonb_build_object('success', false, 'mensaje', '❌ ID no encontrado para actualizar.');
    end if;

    return jsonb_build_object('success', true, 'id', trim(p_id), 'mensaje', '✅ ¡Datos editados con éxito y asistencia registrada en puerta!');

  else
    return jsonb_build_object('success', false, 'mensaje', '⚠️ mode debe ser ''crear'' o ''actualizar''.');
  end if;
end;
$$;

revoke execute on function public.registro_manual(text, text, text, text, text, text, text) from public;
grant execute on function public.registro_manual(text, text, text, text, text, text, text) to authenticated;
