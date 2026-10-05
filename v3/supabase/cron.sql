-- =====================================================================
-- Sincronización periódica del Sheet de inscripciones — SOLO SQL Editor,
-- sin CLI, sin Dashboard de Edge Functions. `sincronizar-inscripciones`
-- sigue necesitando un deploy una sola vez (supabase functions deploy o
-- el botón del Dashboard); lo que este archivo programa es el DISPARO
-- periódico de esa función ya desplegada, cada 5 minutos, usando
-- pg_cron + pg_net (ambas extensiones vienen listas en Supabase, solo
-- hay que activarlas).
--
-- Por qué 5 min y no al instante (como el trigger onChange de V2): esto
-- es el padrón de PRE-inscripción, no check-in en vivo. Para el caso
-- "alguien se acaba de registrar y lo necesita YA" existe el botón
-- "Sincronizar ahora" del panel Mkt (modo "user" de la función) — lo
-- cubre sin tener que bajar el cron a cada minuto. Y para que ni el
-- botón pulsado dos veces seguidas, ni dos miembros de staff casi al
-- mismo tiempo, ni el cron pisándose con el botón disparen dos lecturas
-- del Sheet de golpe, la función misma tiene un cooldown de 30s guardado
-- en event_config.ultima_sincronizacion — ver su código, no hace falta
-- nada adicional acá.
--
-- Pasos:
--   1. Correr este archivo completo en el SQL Editor.
--   2. Reemplazar los dos placeholders de más abajo antes del PRIMER Run:
--      - <TU-PROJECT-REF>   → el ref del proyecto (ver Project Settings → General)
--      - <TU-SECRET-KEY>    → Project Settings → API Keys → Secret keys
--        (la que empieza con sb_secret_... o la service_role legacy)
--
-- Si ya corriste una versión anterior de este archivo (con el cron cada
-- 20 min) y solo quieres actualizar el intervalo sin tocar el secreto de
-- Vault, no hace falta correr todo de nuevo — basta con:
--   select cron.unschedule('sincronizar-inscripciones-cada-20min');
-- y luego el bloque `cron.schedule` de más abajo (ya renombrado a
-- "...-cada-5min", así no choca con el nombre anterior).
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- La secret key vive cifrada en Vault, no en texto plano dentro del job
-- de cron (que cualquiera con acceso de lectura al catálogo de pg_cron
-- podría ver). Si ya existe un secreto con este nombre (primera corrida
-- de este archivo ya hecha), este INSERT falla con "duplicate key" — es
-- esperado, no hace falta repetirlo; si quieres cambiar la key, borra la
-- fila primero: delete from vault.secrets where name = 'sincronizar_inscripciones_key';
select vault.create_secret(
  '<TU-SECRET-KEY>',
  'sincronizar_inscripciones_key',
  'Secret key usada por pg_cron para llamar a la Edge Function sincronizar-inscripciones'
);

select cron.schedule(
  'sincronizar-inscripciones-cada-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<TU-PROJECT-REF>.supabase.co/functions/v1/sincronizar-inscripciones',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'sincronizar_inscripciones_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Para revisar qué está programado:  select * from cron.job;
-- Para pausarlo sin borrarlo:        select cron.unschedule('sincronizar-inscripciones-cada-5min');
