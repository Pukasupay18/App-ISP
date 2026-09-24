// ⚠️ ESTE ARCHIVO NO VA EN ESTE PROYECTO. Es el código que hay que pegar en
// el Apps Script DEL OTRO Sheet — el del formulario de WordPress (ID
// 1ZV42Rj1KGGrc006O7lQPVsMYCn40XqL3XR8eNXkICJM, pestaña "Hoja 1") — para que
// cada inscripción nueva dispare la sincronización a Supabase al instante,
// en vez de esperar a un cron. Reemplaza a instalarTriggerSincronizacion()
// + sincronizarInscripcionesFormulario() del Código.gs actual: aquí solo se
// dispara la llamada, toda la lógica de dedup/insert sigue viviendo en la
// Edge Function `sincronizar-inscripciones-formulario` (no se duplica nada).
//
// ── Cómo instalarlo ──────────────────────────────────────────────────────
// 1. Abre el Sheet del formulario → menú Extensiones → Apps Script.
// 2. Pega esta función completa en Código.gs de ESE proyecto (uno nuevo o
//    uno existente, da igual el nombre del archivo).
// 3. Configura el secreto (NUNCA lo pegues directo en el código):
//    ⚙️ Configuración del proyecto (ícono de engranaje) → Propiedades del
//    script → Añadir propiedad del script:
//      Propiedad: SUPABASE_SECRET_KEY
//      Valor:     el API key "sb_secret_..." del proyecto Supabase
//                  (Dashboard → Project Settings → API Keys → Secret keys,
//                  o `supabase projects api-keys --reveal` en el CLI)
// 4. Instala el trigger: ícono de reloj (Activadores) en el panel izquierdo
//    → Añadir activador →
//      Función a ejecutar:        sincronizarASupabase
//      Fuente del evento:         Desde la hoja de cálculo
//      Tipo de evento:            Al cambiar
//    → Guardar → te pedirá autorizar el script (necesita permiso para
//    llamar a una URL externa) — es normal, autorízalo con tu cuenta.
// 5. Listo. Cada vez que el formulario de WordPress agregue una fila a este
//    Sheet, Supabase se entera en segundos. El cron de respaldo (si lo
//    instalamos más adelante) queda como red de seguridad, no como la vía
//    principal.
// ────────────────────────────────────────────────────────────────────────

function sincronizarASupabase() {
  const SUPABASE_FUNCTION_URL =
    'https://twdhsipvaitoclcxlltk.supabase.co/functions/v1/sincronizar-inscripciones-formulario';

  const secretKey = PropertiesService.getScriptProperties().getProperty('SUPABASE_SECRET_KEY');
  if (!secretKey) {
    Logger.log('⚠️ Falta configurar SUPABASE_SECRET_KEY en Propiedades del script.');
    return;
  }

  try {
    const respuesta = UrlFetchApp.fetch(SUPABASE_FUNCTION_URL, {
      method: 'post',
      headers: {
        apikey: secretKey,
        Authorization: 'Bearer ' + secretKey,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify({}),
      muteHttpExceptions: true,
    });
    Logger.log('Sincronización disparada: ' + respuesta.getResponseCode() + ' — ' + respuesta.getContentText());
  } catch (e) {
    Logger.log('❌ Error al llamar a Supabase: ' + e.message);
  }
}
