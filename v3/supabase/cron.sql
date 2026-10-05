-- =====================================================================
-- Sincronización periódica del Sheet de inscripciones — SOLO SQL Editor,
-- sin CLI, sin Dashboard de Edge Functions. `sincronizar-inscripciones`
-- sigue necesitando un deploy una sola vez (supabase functions deploy o
-- el botón del Dashboard); lo que este archivo programa es el DISPARO
-- periódico de esa función ya desplegada, cada 20 minutos, usando
-- pg_cron + pg_net (ambas extensiones vienen listas en Supabase, solo
-- hay que activarlas).
--
-- Por qué cada 20 min y no al instante (como el trigger onChange de
-- V2): esto es el padrón de PRE-inscripción, no check-in en vivo — nadie
-- necesita ver su nombre aparecer en el panel Mkt al segundo. 20 min es
-- suficiente margen y son ~72 invocaciones/día de la función, muy lejos
-- de cualquier límite del free tier.
--
-- Pasos:
--   1. Correr este archivo completo en el SQL Editor.
--   2. Reemplazar los dos placeholders de más abajo antes del PRIMER Run:
--      - <TU-PROJECT-REF>   → el ref del proyecto (ver Project Settings → General)
--      - <TU-SECRET-KEY>    → Project Settings → API Keys → Secret keys
--        (la que empieza con sb_secret_... o la service_role legacy)
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- La secret key vive cifrada en Vault, no en texto plano dentro del job
-- de cron (que cualquiera con acceso de lectura al catálogo de pg_cron
-- podría ver). Si ya existe un secreto con este nombre, borra la fila de
-- vault.secrets primero o cambia el nombre.
select vault.create_secret(
  '<TU-SECRET-KEY>',
  'sincronizar_inscripciones_key',
  'Secret key usada por pg_cron para llamar a la Edge Function sincronizar-inscripciones'
);

select cron.schedule(
  'sincronizar-inscripciones-cada-20min',
  '*/20 * * * *',
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

-- Para revisar que está programado: select * from cron.job;
-- Para pausarlo sin borrarlo:        select cron.unschedule('sincronizar-inscripciones-cada-20min');
