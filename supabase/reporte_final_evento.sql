-- =====================================================================
-- REPORTE FINAL DEL EVENTO — un asistente por fila, con su check-in de
-- puerta y el detalle completo de qué stands visitó.
-- Pégalo en el SQL Editor de Supabase, dale Run, y usa el botón
-- "Download CSV" de la barra de resultados (arriba a la derecha de la
-- tabla de resultados) para exportarlo a Excel.
-- =====================================================================

select
  a.id                                                  as id_credencial,
  a.nombre,
  a.email,
  a.celular,
  a.empresa,
  a.ruc,
  a.origen                                               as origen_registro,   -- 'manual' (puerta) | 'sync_formulario' (WordPress)
  a.asistencia_at                                        as hora_ingreso,      -- null = nunca hizo check-in de puerta
  count(sv.stand_id)                                     as total_stands_visitados,
  string_agg(s.nombre, ', ' order by s.orden)            as stands_visitados   -- lista de nombres, en el orden del evento
from public.attendees a
left join public.stand_visits sv on sv.attendee_id = a.id
left join public.stands s on s.id = sv.stand_id
group by a.id, a.nombre, a.email, a.celular, a.empresa, a.ruc, a.origen, a.asistencia_at
order by a.nombre;

-- ── Variantes útiles ──────────────────────────────────────────────────

-- Solo los que SÍ llegaron al evento (hicieron check-in de puerta):
-- ...agregar "where a.asistencia_at is not null" antes del group by.

-- Solo los aptos al sorteo (completaron TODOS los stands activos):
-- select * from ( <la consulta de arriba> ) reporte
-- where total_stands_visitados = (select count(*) from public.stands where activo);

-- Ranking de tráfico por stand (para el informe de ROI a las marcas):
-- select s.nombre, count(sv.attendee_id) as visitas
-- from public.stands s
-- left join public.stand_visits sv on sv.stand_id = s.id
-- where s.activo
-- group by s.nombre
-- order by visitas desc;
