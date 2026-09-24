# Plan de Migración: Google Sheets + Apps Script → Supabase

## Por qué migrar

El cuello de botella actual no es un bug puntual, es estructural:

- **Concurrencia real**: Apps Script limita a ~30 ejecuciones simultáneas por proyecto. Con 100 personas usando la app a la vez (puerta + 16 stands + consultas de progreso), se satura.
- **Candado global**: `LockService.getScriptLock()` es único para todo el script — cada escritura (marcar asistencia, marcar stand, registrar) espera su turno detrás de TODAS las demás, sin importar si son a filas distintas.
- **Lectura completa en cada consulta**: cada acción lee `getDataRange()` (toda la hoja) y recorre fila por fila en JS. Con cientos/miles de filas, cada request se vuelve más lento — ya lo vivimos con las métricas.
- **Esquema fragile por columnas**: cada vez que cambia algo (RUC, cantidad de stands, quitar QR) hay que renumerar columnas a mano en 6+ funciones. Alto riesgo de error humano en vivo.

Postgres (vía Supabase) resuelve los cuatro con su diseño nativo: transacciones ACID, `UNIQUE` constraints en vez de candados manuales, índices en vez de escaneo lineal, y tablas normalizadas en vez de columnas por stand.

---

## Modelo de datos propuesto

```sql
-- Reemplaza las 16 columnas de stands por filas. Agregar/quitar un stand deja de
-- requerir renumerar nada — se inserta o desactiva una fila.
create table stands (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  pin           text not null unique,       -- o hasheado con pgcrypto si se quiere ir más lejos
  activo        boolean not null default true,
  orden         int not null,
  created_at    timestamptz not null default now()
);

create table attendees (
  id            text primary key,           -- mismo esquema de ID legible: "HR0001FX"
  nombre        text not null,
  email         text,
  celular       text,
  empresa       text,
  ruc           text,
  asistencia_at timestamptz,                -- null = no ha hecho check-in de puerta
  origen        text not null default 'manual', -- 'manual' | 'sync_formulario'
  created_at    timestamptz not null default now()
);
create index idx_attendees_email on attendees (lower(email));
create index idx_attendees_nombre_email on attendees (lower(nombre), lower(email)); -- dedup

-- Reemplaza las 16 columnas dispersas. La PK compuesta IMPIDE duplicar una visita
-- sin necesidad de ningún candado: dos escaneos simultáneos del mismo QR en el
-- mismo stand simplemente chocan contra la constraint y el segundo no hace nada.
create table stand_visits (
  attendee_id   text references attendees(id) on delete cascade,
  stand_id      uuid references stands(id),
  visited_at    timestamptz not null default now(),
  primary key (attendee_id, stand_id)
);

-- Login de MKT. Reemplaza la contraseña única + token en caché.
create table admin_users (
  user_id       uuid primary key references auth.users(id),
  nombre        text
);
```

**Beneficio directo**: "aptos al sorteo" = `count(stand_visits) filter (attendee) = count(stands where activo)`. "Ranking por stand" = `select stand_id, count(*) from stand_visits group by stand_id`. Todo con índices, sin recorrer nada en JS.

---

## Autenticación y control de acceso

| Hoy (Apps Script) | Con Supabase |
|---|---|
| 1 contraseña compartida → token en `CacheService` (6h) | Supabase Auth con email+password para el equipo MKT (o 1-2 cuentas compartidas si prefieren no dar cuentas individuales). Sesión maneja renovación automática vía `supabase-js`. |
| PIN de stand → variable en memoria del navegador | Edge Function `validar-pin-stand`: verifica el PIN contra `stands`, devuelve un token firmado (JWT corto, ~4h) que autoriza *solo* ese `stand_id`. El insert en `stand_visits` pasa por otra Edge Function que valida ese token antes de escribir — ningún PIN ni contraseña vive en el cliente, igual que ahora. |
| Progreso del asistente: público, sin login | Se mantiene público, pero vía una función Postgres `security definer` (`obtener_progreso(id text)`) que solo expone los datos de ESE id — nunca la tabla completa a través del anon key. |

RLS (Row Level Security) en `attendees` y `stand_visits`: lectura/escritura general bloqueada por defecto; solo permitida a `authenticated` con fila en `admin_users`, o a través de las Edge Functions con rol `service_role` (que se ejecutan en el servidor, no en el navegador).

---

## Mapeo función por función (`Código.gs` → Supabase)

| Acción actual | Reemplazo |
|---|---|
| `validarAdmin` | Supabase Auth `signInWithPassword` (cliente) — ya no hace falta reinventar sesión. |
| `validarPinStand` + `marcarStand` | Edge Function `validar-pin-stand` + Edge Function `marcar-stand` (valida el token del paso anterior). |
| `marcarAsistencia` | Edge Function o `update` directo con RLS (`authenticated` + `admin_users`). |
| `registroManual` / `actualizarRegistroExistente` | `insert`/`update` directo vía `supabase-js` con RLS — el dedup nombre+correo se hace con una constraint `unique (lower(nombre), lower(email))` o se valida antes con un `select`. |
| `obtenerProgresoAsistente` | RPC pública `obtener_progreso(id)`. |
| `obtenerMetricasMKT` | Vista SQL o RPC con agregados — sin caché de 15s necesario, Postgres lo resuelve al vuelo; opcionalmente **Realtime**: el dashboard se actualiza solo, sin botón "Refrescar". |
| `obtenerListaAsistentesMKT` | `select` con filtros server-side (`ilike`) — la búsqueda deja de traer TODO el arreglo al navegador. |
| `buscarEmpresaPorRuc` | Edge Function `buscar-ruc` — misma lógica de dos niveles (caché local en Postgres primero, luego Decolecta), el token vive en secrets de Supabase, nunca en el cliente. |
| `sincronizarInscripcionesFormulario` | Edge Function programada (Supabase Scheduled Functions / `pg_cron`) que sigue leyendo el Sheet de WordPress igual que hoy (no se toca ese formulario) y hace `upsert` en `attendees`. Misma lógica de dedup nombre+correo ya escrita, se traduce casi 1:1. |
| `generarIdsFaltantes`, `limpiarFilasVaciasSheet` | Ya no aplican — no hay columnas que renumerar ni filas fantasma en Postgres. |

---

## Frontend (`index.html`)

- Se agrega el cliente `@supabase/supabase-js` por CDN (sigue siendo un solo archivo HTML, sin build step — mismo espíritu "vibe coding").
- Cada `fetch(URL_API_GOOGLE?action=...)` se reemplaza por `supabase.from(...)` o `supabase.functions.invoke(...)`.
- El flujo visual, la impresión térmica, el escáner de cámara (`html5-qrcode`), el QR local (`qrcodejs`) — **nada de eso cambia**. Solo cambia de dónde vienen y a dónde van los datos.
- Se elimina toda la lógica de `tokenAdmin` manual — la sesión la maneja `supabase-js` sola.

## Hosting

Sin cambios: Netlify sigue sirviendo el HTML estático. Supabase reemplaza a Apps Script + Sheets como backend. Costo: plan gratuito de Supabase cubre holgadamente el volumen de un evento de este tamaño.

---

## Migración de datos existentes (una sola vez)

1. Exportar el Sheet actual a CSV.
2. Script de transformación (te lo escribo cuando lleguemos a esta fase): las 16 columnas de stands se convierten en filas de `stand_visits`; el resto mapea directo a `attendees`.
3. Importar a Supabase (tiene importador de CSV integrado, o vía `psql`/script).
4. Verificar conteos (total asistentes, total visitas por stand) contra el dashboard actual antes de dar de baja el Sheet.

---

## Fases y estimado de esfuerzo

| Fase | Contenido | Estimado |
|---|---|---|
| 0. Setup | Crear proyecto Supabase, definir schema, RLS, sembrar `stands` con los 16 PINs actuales | 1-2h |
| 1. Migración de datos | Exportar/transformar/importar el Sheet actual | 1-2h |
| 2. Backend (Edge Functions) | Portar cada acción de `Código.gs` | 3-5h |
| 3. Frontend | Reemplazar llamadas `fetch` por `supabase-js` en `index.html` | 3-5h |
| 4. Pruebas end-to-end | Los 16 stands, registro manual, progreso, dashboard, buscador, RUC, impresión | 2-4h |
| 5. Corte | Sheet queda de solo lectura como respaldo; se apunta el frontend a Supabase; monitoreo de la primera hora real | — |

Total aproximado: **10-18 horas** de trabajo repartidas en los días que quedan, no de un tirón. El Sheet actual sigue funcionando durante todo el proceso — no hay que romper nada en producción hasta el corte final (fase 5), y podemos probar Supabase en paralelo sin presión.

---

## ✅ Decisiones ya tomadas

1. **Auth del staff MKT**: Supabase Auth real (email+password). El login NO pasa por una Edge Function — el navegador llama directo a `supabase.auth.signInWithPassword(...)`.
2. **Auth de stands**: PIN plano comparado contra la tabla `stands`, vía Edge Function con `service_role` (la tabla nunca se expone al cliente). Nada de cuentas de Supabase Auth para stands.
3. Proyecto de Supabase creado. **Project Reference ID: `twdhsipvaitoclcxlltk`**.

## 📍 Estado actual (checkpoint — última actualización: continúa aquí si se corta la sesión)

- **Fase 0 (schema)** ✅ completa. Corridos en el SQL Editor, en este orden: `supabase/schema.sql`, `supabase/seed_stands.sql` (16 stands con sus PINs reales), `supabase/grants.sql` (hubo que agregarlo aparte: al desactivar "Automatically expose new tables" al crear el proyecto, Supabase tampoco le dio los `GRANT` base a `service_role`/`authenticated` — es una capa distinta e independiente de RLS).
- **Fase 1 (migrar asistentes existentes del Sheet a Postgres)** ⬜ NO iniciada todavía.
- **Fase 2 (Edge Functions)**:
  - `validar-pin-stand` ✅ escrita, desplegada y probada con `curl` — funciona.
  - `marcar-stand` ✅ escrita, desplegada y probada con `curl` (PIN correcto/incorrecto, asistente inexistente, inserción real + detección de duplicado con `upsert(...ignoreDuplicates:true)`) — funciona. Diseño: recibe `{ pin, attendeeId }` en cada llamada (NO hay token/JWT — se descartó esa idea del borrador inicial; el PIN vive en memoria del navegador del stand y se revalida server-side en cada escaneo, igual de seguro que el modelo actual y sin la complejidad de firmar/verificar tokens). Devuelve `{ success, yaEstaba, mensaje, standNombre, attendeeNombre }`.
  - `buscar-empresa-por-ruc` ✅ escrita, desplegada y probada — **incluyendo el nivel SUNAT**, `DECOLECTA_API_TOKEN` ya configurado como secret y probado con un RUC real (devolvió la razón social correcta vía Decolecta). Exige sesión de staff MKT real (`auth: ["user"]` + chequeo explícito de `es_staff_mkt()`), a diferencia de `validar-pin-stand`/`marcar-stand` que son públicas — probado creando y borrando usuarios de prueba en Supabase Auth vía Admin API, ya que **Fase 3 (login real de staff) todavía no existe**.
  - `sincronizar-inscripciones-formulario` ✅ escrita, desplegada y **corrida de verdad contra el Sheet real** del formulario de WordPress (ID `1ZV42Rj1KGGrc006O7lQPVsMYCn40XqL3XR8eNXkICJM`, pestaña "Hoja 1", público vía CSV — sin cuenta de servicio de Google). Resultado real: **148 asistentes nuevos migrados a `attendees`**. Probada idempotencia (segunda corrida = 0 nuevos, sin duplicar) y rechazo sin credenciales (401). Acepta `auth: ["user","secret"]`: modo `secret` para el cron, modo `user` con chequeo `es_staff_mkt()` para un futuro botón manual "Sincronizar ahora" en el panel MKT.
  - **Disparo automático — decidido: trigger real, NO polling.** El usuario SÍ tiene acceso de edición al Sheet del formulario de WordPress, así que en vez de `pg_cron` cada 5 min se instala un trigger `onChange` en ESE Sheet (Apps Script del otro proyecto) que llama a esta función al instante en cada inscripción nueva. Código ya escrito en [`supabase/trigger-onchange-sheet-formulario.gs`](trigger-onchange-sheet-formulario.gs) (NO se despliega con `supabase functions deploy` — es Apps Script normal, va pegado en el Apps Script DEL OTRO Sheet). **Pendiente de instalar — son pasos manuales en la cuenta de Google del usuario, Claude no tiene acceso**: pegar el script, configurar `SUPABASE_SECRET_KEY` en Propiedades del script (con la secret key real, ver instrucciones dentro del archivo), y crear el activador "Al cambiar". Sin este paso, la sincronización solo corre cuando alguien la dispare a mano.
- **Fase 1 (migrar asistentes) ya arrancó de facto**: los 148 inscritos del formulario ya están en Postgres gracias a la corrida real de arriba. Falta decidir si migrar también los asistentes ya cargados directamente en el Sheet actual de la app (los que vinieron de registro manual en puerta, no del formulario) — ese es un origen de datos distinto (`Codigo.gs`, no el Sheet de WordPress) y necesita su propio script de import.
- **Decisión de arquitectura para Fase 3**: una vez cortado a Supabase, el registro manual de puerta escribe **solo en Supabase**, nunca de vuelta al Sheet actual de la app — escribir en ambos reintroduciría el mismo cuello de botella que motivó toda esta migración (ver "Por qué migrar" al inicio de este documento). El Sheet actual queda como respaldo de solo lectura tras el corte (Fase 5).
- **Fase 3 (frontend `index.html` → `supabase-js`)** ✅ completa. `Código.gs` + Sheets **ya NO son el backend** de este `index.html` — cada acción pasa por Supabase (Edge Function, RPC, o escritura directa con RLS). Se agregaron 3 RPCs nuevas que faltaban (`obtener_progreso`, `obtener_metricas_mkt`, `obtener_lista_asistentes_mkt`, en `supabase/rpc_funciones.sql`) y una Edge Function nueva (`registro-manual`, crea/edita con dedup + ID centralizado para evitar carreras entre staff simultáneo). Cuenta real de staff MKT creada: `hola@fiberlux.pe` (contraseña generada, compartida con el usuario en el chat — cámbiala desde el panel cuando puedas). Probado end-to-end en navegador (Browser pane, servidor estático local vía `.dev-static-server.js` + `.claude/launch.json`) contra el proyecto real, con limpieza de todos los datos de prueba.
- **Nota para retomar sesión**: para previsualizar el frontend localmente, correr `node .dev-static-server.js` desde esta carpeta (puerto 8787) — no hace falta Netlify para probar cambios de UI/JS.
- **Herramientas ya instaladas/configuradas**: Supabase CLI vía Scoop. Instalado y logueado/linkeado en 2 máquinas hasta ahora — es por dispositivo, hay que repetir `scoop install supabase` + `supabase login` (requiere terminal interactiva real, con TTY — no funciona desde un agente/script) + `supabase link --project-ref twdhsipvaitoclcxlltk` en cualquier máquina nueva.
- **Nota conocida**: `supabase init` falla con `AlreadyExists: FileSystem.makeDirectory` en esta ruta (probablemente por la sincronización de OneDrive). No hace falta correrlo — `supabase functions new <nombre>` crea `config.toml` igual, sin pasar por `init`.
- **Nota sobre limpieza de datos de prueba**: `service_role` NO tiene `GRANT DELETE` en `attendees`/`stand_visits` (a propósito, ver `grants.sql` — la app nunca borra nada). Para borrar datos de prueba durante desarrollo, usar `supabase db query "delete from ..." --linked` (conexión directa a Postgres, no pasa por PostgREST/grants), no la REST API con la service key.
- **Etiqueta de impresión rediseñada** (2026-08-07, sin commitear todavía): tamaño cambiado de 62×30mm a 90×29mm en `index.html` (`@page`, `.etiqueta-print-box`, tamaños de fuente, QR de 13mm a 22mm). Pendiente confirmar impresión física antes de commitear.
- **Contraseña de `hola@fiberlux.pe` cambiada** (2026-08-07) vía Admin API. ⚠️ Durante ese cambio se expuso por error la `service_role` legacy key completa en la salida de un comando de terminal — **pendiente rotarla** desde el Dashboard (Project Settings → API Keys) antes del evento.
- **Respaldo automático a Sheets cada 30 min — descartado** (2026-08-07): se llegó a construir (Edge Function `respaldar-a-sheets` + receptor Apps Script + cron), pero el usuario decidió NO instalarlo para evitar confundir las dos fuentes: el Sheet del formulario de WordPress sigue siendo el respaldo de las inscripciones (Sheet → Supabase vía el sync existente), y Supabase es la réplica completa (formulario + registro en puerta). Archivos removidos del repo tras la decisión.
