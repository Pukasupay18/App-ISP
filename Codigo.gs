/**
 * SISTEMA DE GESTIÓN DE ASISTENCIA - FIBERLUX ISP 2026
 * Desarrollado para control interno, métricas de marketing y gamificación de stands.
 *
 * v2.0 — Seguridad y concurrencia:
 * - La contraseña de admin y los PIN de stand ya NO viven en el HTML/JS del cliente.
 *   Se validan aquí, en el servidor, que nunca se envía al navegador.
 * - Las acciones sensibles (métricas, lista de asistentes, registro manual, check-in
 *   de puerta) exigen un token de sesión emitido por validarAdmin().
 * - LockService evita condiciones de carrera cuando dos miembros de staff escriben
 *   casi al mismo tiempo (p.ej. dos registros manuales generando el mismo ID).
 * - CacheService evita recorrer toda la hoja en cada refresh del dashboard.
 *
 * v2.1 — Sincronización de inscripciones:
 * - El formulario de inscripción online vive en WordPress y escribe en OTRO Sheet
 *   (no lo administramos nosotros, así que no lo modificamos). sincronizarInscripcionesFormulario()
 *   lee ese Sheet y copia hacia este los asistentes que todavía no existen aquí,
 *   generando su ID de credencial igual que el registro manual de puerta.
 *
 * v2.3 — Columna RUC (junto a Empresa) + autocompletado de Empresa por RUC:
 * - Nueva columna F "RUC" (todo lo que estaba desde Asistencia en adelante se
 *   corrió una columna a la derecha — ver comentarios en INFO_STANDS).
 * - buscarEmpresaPorRuc() resuelve el nombre de empresa a partir del RUC: primero
 *   busca en asistentes ya registrados en este Sheet (gratis, instantáneo) y si
 *   no lo encuentra consulta la API de Decolecta/SUNAT (requiere Script Property
 *   DECOLECTA_API_TOKEN — nunca se expone al cliente).
 *
 * v2.4 — Se eliminó la generación de QR en Drive (quickchart.io): la impresora
 * Brother genera su propio QR a partir del ID al momento de imprimir, así que
 * pre-renderizar y guardar un PNG por asistente era trabajo redundante. Solo el
 * ID es indispensable. Se quitaron las columnas "QR generado" y "QR url".
 */

// 1. CONFIGURACIÓN
const CONTRASENA_ADMIN_POR_DEFECTO = 'ADMIN2026'; // Solo se usa si no configuras Script Properties (ver README abajo)
const DURACION_SESION_SEGUNDOS = 6 * 60 * 60; // 6 horas (máximo permitido por CacheService)

// Sheet antiguo del formulario de WordPress (archivo DISTINTO a este). Solo se lee, nunca se escribe.
// El ID es el fragmento de la URL entre "/d/" y "/edit": https://docs.google.com/spreadsheets/d/ESTE_ID/edit
const ID_HOJA_INSCRIPCIONES_ANTIGUA = 'PEGA_AQUI_EL_ID_DEL_SHEET_ANTIGUO';
const NOMBRE_PESTANA_INSCRIPCIONES_ANTIGUA = ''; // Déjalo vacío para usar la primera pestaña del archivo

// Acciones que EXIGEN una sesión de admin válida (token emitido por validarAdmin)
const ACCIONES_ADMIN = [
  'marcarAsistencia',
  'registroManual',
  'actualizarRegistroExistente',
  'obtenerMetricasMKT',
  'obtenerListaAsistentesMKT',
  'obtenerRegistros',
  'buscarEmpresaPorRuc',
  'marcarStandAdmin'
];

// Token de la API de Decolecta (https://decolecta.com/profile) para autocompletar
// la Empresa a partir del RUC. Configúralo en Script Properties (Configuración del
// proyecto → Propiedades del script → agregar DECOLECTA_API_TOKEN), NUNCA aquí en
// el código ni en el cliente — así nunca queda expuesto en el navegador.

// Mapa único de PINes de stand → nunca se expone al cliente, solo el resultado de validarlo.
//
// v2.2 — 16 stands (se agregó NVL, Wurfel, Lieferant, Lanly, Peplink, Brothers,
// Optictimes y Optronics; se dieron de baja Hayex Technology, Mic y Planex):
// - Las marcas que CONTINÚAN conservan su PIN tal cual, para no invalidar
//   credenciales/check-ins ya impresos.
//
// v2.4 — Se eliminaron las columnas "QR generado" y "QR url" (ya no se pre-genera
// QR, ver nota arriba), así que todas las columnas de stands se corrieron -2.
// Las columnas 12, 17 y 18 (antes Hayex, Mic y Planex) quedan en desuso: el
// código ya NO las lee ni las escribe. Puedes ocultarlas o dejarlas vacías.
const INFO_STANDS = {
  "529147": { nombre: "TP-Link & Ring Ring",   col: 9 },  // continúa (antes "TpLink/Ring Ring")
  "831604": { nombre: "Wanglink",              col: 10 }, // continúa
  "294715": { nombre: "Digicorp & Huawei eKit",col: 11 }, // continúa (antes "Digicorp/Huawei eKit")
  "165948": { nombre: "Innovastec",            col: 13 }, // continúa
  "603825": { nombre: "Transworld",            col: 14 }, // continúa
  "419256": { nombre: "Macrotel",              col: 15 }, // continúa
  "872143": { nombre: "Latic",                 col: 16 }, // continúa
  "147362": { nombre: "Fiberlux",              col: 19 }, // continúa
  "482619": { nombre: "NVL",                   col: 20 }, // nuevo
  "917355": { nombre: "Wurfel",                col: 21 }, // nuevo
  "638274": { nombre: "Lieferant",             col: 22 }, // nuevo
  "705918": { nombre: "Lanly",                 col: 23 }, // nuevo
  "394827": { nombre: "Peplink",               col: 24 }, // nuevo
  "561094": { nombre: "Brothers",              col: 25 }, // nuevo
  "748263": { nombre: "Optictimes",            col: 26 }, // nuevo
  "205917": { nombre: "Optronics",             col: 27 }  // nuevo
};

// Devuelve la lista de stands ordenada por columna — fuente única de verdad para
// todo lo que necesite iterar "todos los stands" (progreso, métricas), en vez
// de asumir columnas contiguas (ya no lo son: hay huecos en 13, 18 y 19).
function obtenerListaStands_() {
  return Object.keys(INFO_STANDS)
    .map(pin => INFO_STANDS[pin])
    .sort((a, b) => a.col - b.col);
}

// Creación del menú personalizado en la hoja de cálculo
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🛠️ Menú Marketing')
    .addItem('Generar IDs faltantes', 'generarIdsFaltantes')
    .addSeparator()
    .addItem('Sincronizar inscripciones ahora', 'sincronizarInscripcionesDesdeMenu_')
    .addItem('Activar sincronización automática (cada 5 min)', 'instalarTriggerSincronizacion')
    .addSeparator()
    .addItem('🧹 Recortar filas/columnas vacías (rendimiento)', 'limpiarFilasVaciasSheet')
    .addToUi();
}

// ---------------------------------------------------------------------
// 🔐 SEGURIDAD: contraseña admin y sesiones (nada de esto llega al cliente)
// ---------------------------------------------------------------------
function getAdminPassword_() {
  const configurada = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  return configurada || CONTRASENA_ADMIN_POR_DEFECTO;
}

function crearSesionAdmin_() {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('admin_' + token, 'ok', DURACION_SESION_SEGUNDOS);
  return token;
}

function validarSesionAdmin_(token) {
  if (!token) return false;
  return CacheService.getScriptCache().get('admin_' + token) === 'ok';
}

function validarAdmin(clave) {
  if (clave && clave === getAdminPassword_()) {
    return { success: true, token: crearSesionAdmin_() };
  }
  return { success: false, mensaje: '❌ Contraseña incorrecta.' };
}

function validarPinStand(pin) {
  const stand = INFO_STANDS[pin];
  if (!stand) return { success: false, mensaje: '❌ PIN incorrecto.' };
  return { success: true, nombre: stand.nombre };
}

// ---------------------------------------------------------------------
// 🧰 UTILIDADES COMPARTIDAS (dedup de texto y generación de ID de credencial)
// ---------------------------------------------------------------------
function normalizarTexto_(t) {
  return t ? t.toString().toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").replace(/\s+/g, ' ').trim() : "";
}

// Clave de deduplicación de asistentes: nombre + correo (no solo correo). Varias
// empresas inscriben a distintas personas bajo el correo de un único contacto,
// así que el correo solo no alcanza para identificar a alguien de forma única.
function clavePersona_(nombre, correo) {
  return normalizarTexto_(nombre) + '|' + normalizarTexto_(correo);
}

function generarIdAsistente_(nombreCompleto, numeroCorrelativo) {
  const partesNombre = nombreCompleto.toString().trim().split(/\s+/);
  let iniciales = "";
  if (partesNombre.length >= 2) {
    iniciales = (partesNombre[0].charAt(0) + partesNombre[1].charAt(0)).toUpperCase();
  } else {
    iniciales = partesNombre[0].substring(0, 2).toUpperCase().padEnd(2, 'X');
  }
  return `${iniciales}${numeroCorrelativo}FX`;
}

// Enrutador principal de peticiones API (Netlify -> Sheets)
function doGet(e) {
  if (!e || !e.parameter || !e.parameter.action) {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Check-in Fiberlux ISP 2026')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const action = e.parameter.action;

  // 🔒 Puerta de seguridad: las acciones administrativas exigen sesión válida
  if (ACCIONES_ADMIN.indexOf(action) !== -1 && !validarSesionAdmin_(e.parameter.token)) {
    return responderJSON_({
      status: 'error',
      success: false,
      mensaje: '⛔ Sesión no autorizada o expirada. Vuelve a iniciar sesión en el panel MKT.'
    });
  }

  let resultado;

  if (action === 'obtenerRegistros') {
    resultado = obtenerRegistros();
  }
  else if (action === 'marcarAsistencia') {
    resultado = marcarAsistencia(e.parameter.id);
  }
  else if (action === 'registroManual') {
    const datos = {
      nombreCompleto: e.parameter.nombreCompleto,
      email: e.parameter.email,
      celular: e.parameter.celular,
      empresa: e.parameter.empresa,
      ruc: e.parameter.ruc
    };
    resultado = registroManualYAsistencia(datos);
  }
  else if (action === 'actualizarRegistroExistente') {
    resultado = actualizarRegistroExistente(e.parameter);
  }
  else if (action === 'buscarEmpresaPorRuc') {
    resultado = buscarEmpresaPorRuc(e.parameter.ruc);
  }
  else if (action === 'marcarStand') {
    resultado = marcarAsistenciaStand(e.parameter.id, e.parameter.pin);
  }
  else if (action === 'marcarStandAdmin') {
    resultado = marcarStandAdmin(e.parameter.id, e.parameter.nombreStand);
  }
  else if (action === 'validarPinStand') {
    resultado = validarPinStand(e.parameter.pin);
  }
  else if (action === 'validarAdmin') {
    resultado = validarAdmin(e.parameter.clave);
  }
  else if (action === 'obtenerProgresoAsistente') {
    resultado = obtenerProgresoAsistente(e.parameter.id);
  }
  else if (action === 'obtenerMetricasMKT') {
    resultado = obtenerMetricasMKT();
  }
  else if (action === 'obtenerListaAsistentesMKT') {
    resultado = obtenerListaAsistentesMKT();
  }
  else {
    resultado = { status: "error", mensaje: "Acción no reconocida en el servidor: " + action };
  }

  return responderJSON_(resultado);
}

function responderJSON_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

// Devuelve el estado detallado de todos los stands para un asistente
function obtenerProgresoAsistente(idAsistente) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const stands = obtenerListaStands_();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == idAsistente.toUpperCase().trim()) {
      let standsVisitados = [];
      let conteoNum = 0;

      stands.forEach(stand => {
        const celdaFecha = data[i][stand.col - 1]; // col es 1-indexado en la hoja
        const visitado = celdaFecha !== "" && celdaFecha !== undefined;
        if (visitado) conteoNum++;
        standsVisitados.push({ nombre: stand.nombre, visitado: visitado });
      });

      return {
        success: true,
        nombre: data[i][1],
        empresa: data[i][4] || "---",
        total: conteoNum,
        maxStands: stands.length,
        aptoSorteo: conteoNum === stands.length,
        detalle: standsVisitados
      };
    }
  }

  return { success: false, mensaje: "❌ Código ID no encontrado." };
}

// Valida el PIN y marca la columna correspondiente (con bloqueo anticolisión)
function marcarAsistenciaStand(idAsistente, pinStand) {
  const stand = INFO_STANDS[pinStand];
  if (!stand) return "❌ PIN de Stand incorrecto.";

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
  } catch (e) {
    return "⏳ Sistema ocupado, intenta escanear de nuevo en un segundo.";
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == idAsistente.toUpperCase().trim()) {
        sheet.getRange(i + 1, stand.col).setValue(new Date());
        return "✅ " + stand.nombre + " registró a: " + data[i][1];
      }
    }
    return "❌ Código de asistente no válido.";
  } finally {
    lock.releaseLock();
  }
}

// Apoyo MKT sin PIN: el staff ya autenticado como admin (token de validarAdmin)
// marca la asistencia de cualquier stand sin pedir el PIN individual de ese
// stand. Recibe el NOMBRE del stand (no un índice numérico) para no depender de
// que dos arreglos —este y NOMBRES_STANDS en el cliente— mantengan el mismo
// orden para siempre; eso fue justo la causa de que esta acción nunca llegara
// a funcionar (el endpoint no existía en absoluto).
function marcarStandAdmin(idAsistente, nombreStand) {
  const stand = obtenerListaStands_().find(s => s.nombre === nombreStand);
  if (!stand) return "❌ Stand no reconocido: " + nombreStand;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
  } catch (e) {
    return "⏳ Sistema ocupado, intenta escanear de nuevo en un segundo.";
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == idAsistente.toUpperCase().trim()) {
        sheet.getRange(i + 1, stand.col).setValue(new Date());
        return "✅ " + stand.nombre + " registró a: " + data[i][1];
      }
    }
    return "❌ Código de asistente no válido.";
  } finally {
    lock.releaseLock();
  }
}

// Obtiene los últimos 10 registros
function obtenerRegistros() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1).map(row => ({
    id: row[0],
    nombre: row[1],
    empresa: row[4] || "---",
    asistencia: row[6] ? Utilities.formatDate(new Date(row[6]), "GMT-5", "HH:mm") : "---"
  })).reverse().slice(0, 10);
}

// ---------------------------------------------------------------------
// 🔍 MOTOR FLEXIBLE (El Frontend maneja la interfaz de duplicados)
// ---------------------------------------------------------------------
function registroManualYAsistencia(datos) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
  } catch (e) {
    return { status: "error", mensaje: "⏳ Sistema ocupado procesando otro registro. Intenta de nuevo en un segundo." };
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();

    const nombreStr = datos.nombreCompleto ? datos.nombreCompleto.toString().trim() : "Usuario Sin Nombre";
    const emailStr = datos.email ? datos.email.toString().trim() : "";
    const celularStr = datos.celular ? datos.celular.toString().trim() : "";
    const empresaStr = datos.empresa ? datos.empresa.toString().trim() : "";
    const rucStr = datos.ruc ? datos.ruc.toString().trim() : "";

    // Dedup por nombre + correo (no solo correo): varias empresas inscriben a
    // distintas personas bajo el correo de un único contacto.
    const claveNueva = clavePersona_(nombreStr, emailStr);

    if (normalizarTexto_(emailStr) !== "") {
      for (let i = 1; i < data.length; i++) {
        if (clavePersona_(data[i][1], data[i][2]) === claveNueva) {
          return { status: "error", mensaje: `⚠️ ERROR: Ya existe un asistente registrado con ese mismo nombre y correo. Búscalo y usa el botón de Editar (✏️).` };
        }
      }
    }

    const ultimaFila = sheet.getLastRow();
    const numeroCorrelativo = (ultimaFila).toString().padStart(4, '0');
    const idCifrado = generarIdAsistente_(nombreStr, numeroCorrelativo);

    sheet.appendRow([
      idCifrado, nombreStr, emailStr, celularStr, empresaStr, rucStr,
      new Date(), numeroCorrelativo
    ]);

    return { status: "success", mensaje: "✅ ¡Registro Nuevo Exitoso! ID: " + idCifrado, id_nuevo: idCifrado };
  } catch(e) {
    return { status: "error", mensaje: "❌ Error interno en el servidor: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

function actualizarRegistroExistente(datos) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
  } catch (e) {
    return { status: "error", mensaje: "⏳ Sistema ocupado. Intenta de nuevo en un segundo." };
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === datos.id) {
        if (datos.nombreCompleto) sheet.getRange(i + 1, 2).setValue(datos.nombreCompleto);
        sheet.getRange(i + 1, 3).setValue(datos.email);
        sheet.getRange(i + 1, 4).setValue(datos.celular);
        sheet.getRange(i + 1, 5).setValue(datos.empresa);
        sheet.getRange(i + 1, 6).setValue(datos.ruc || "");
        sheet.getRange(i + 1, 7).setValue(new Date());

        return { status: "success", mensaje: "✅ ¡Datos editados con éxito y asistencia registrada en puerta!", id_nuevo: datos.id };
      }
    }
    return { status: "error", mensaje: "❌ ID no encontrado para actualizar." };
  } finally {
    lock.releaseLock();
  }
}

// Revisa la base de datos y completa el ID de credencial de filas que llegaron sin
// uno (p. ej. pegadas directamente en la hoja, fuera del flujo de la app). El QR
// ya NO se pre-genera aquí: la Brother lo genera ella misma a partir del ID al
// momento de imprimir, así que solo el ID es indispensable.
function generarIdsFaltantes() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();

  let idsGenerados = 0;

  for (let i = 1; i < data.length; i++) {
    const idCifrado = data[i][0];
    const nombreCompleto = data[i][1];
    const email = data[i][2];

    if ((!idCifrado || idCifrado.toString().trim() === "") && nombreCompleto && email) {
      const numCorrelativo = i.toString().padStart(4, '0');
      const nuevoId = generarIdAsistente_(nombreCompleto, numCorrelativo);

      sheet.getRange(i + 1, 1).setValue(nuevoId);
      sheet.getRange(i + 1, 8).setValue(numCorrelativo);
      idsGenerados++;
    }
  }

  SpreadsheetApp.getUi().alert(`✅ Proceso completado\n\nIDs nuevos generados: ${idsGenerados}`);
  return "IDs generados: " + idsGenerados;
}

// Recorta filas y columnas vacías "fantasma" del Sheet. Si Ctrl+Fin salta mucho
// más allá del último asistente real, Sheets sigue tratando esas celdas vacías
// como "usadas" (por formato o validación de datos heredada, típico en sheets
// vinculados a Forms) y getDataRange()/getLastRow() las incluye en CADA lectura
// — eso vuelve lentas todas las consultas (métricas, buscador, progreso) a
// medida que el rango fantasma es más grande. Ejecuta esto una vez cuando notes
// que las métricas tardan mucho o dan "Error al cargar métricas".
function limpiarFilasVaciasSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ui = SpreadsheetApp.getUi();

  // Última fila con un ID real en columna A — fuente de verdad de "aquí hay un asistente".
  const columnaId = sheet.getRange(1, 1, sheet.getMaxRows(), 1).getValues();
  let ultimaFilaReal = 1; // fila 1 = encabezado
  for (let i = 0; i < columnaId.length; i++) {
    if (columnaId[i][0] && columnaId[i][0].toString().trim() !== "") {
      ultimaFilaReal = i + 1;
    }
  }

  const maxFilas = sheet.getMaxRows();
  const filasSobrantes = maxFilas - ultimaFilaReal;
  if (filasSobrantes > 0) {
    sheet.deleteRows(ultimaFilaReal + 1, filasSobrantes);
  }

  // Última columna realmente en uso: la mayor entre el correlativo (col 8) y la
  // columna de stand más lejana — calculado dinámicamente, no hardcodeado, para
  // que siga funcionando si cambia otra vez la cantidad de stands.
  const ultimaColumnaNecesaria = Math.max(8, ...obtenerListaStands_().map(s => s.col));
  const maxColumnas = sheet.getMaxColumns();
  const columnasSobrantes = maxColumnas - ultimaColumnaNecesaria;
  if (columnasSobrantes > 0) {
    sheet.deleteColumns(ultimaColumnaNecesaria + 1, columnasSobrantes);
  }

  ui.alert(`✅ Sheet recortado\n\nFilas eliminadas: ${filasSobrantes > 0 ? filasSobrantes : 0}\nColumnas eliminadas: ${columnasSobrantes > 0 ? columnasSobrantes : 0}\n\nEsto debería acelerar las consultas. Si seguía lento, revisa si tienes formato condicional o validación de datos aplicada a columnas/filas completas.`);
}

// Escáner de ingreso general: Registra la marca de tiempo en la columna G (con bloqueo)
function marcarAsistencia(idEscaneado) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
  } catch (e) {
    return "⏳ Sistema ocupado, intenta escanear de nuevo en un segundo.";
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == idEscaneado.toUpperCase().trim()) {
        sheet.getRange(i + 1, 7).setValue(new Date());
        return "✅ Asistencia registrada para: " + data[i][1];
      }
    }
    return "❌ El código escaneado no existe.";
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------
// 📊 MÉTRICAS MKT (con caché corto para absorber ráfagas de refresh)
// ---------------------------------------------------------------------
function obtenerMetricasMKT() {
  const cache = CacheService.getScriptCache();
  const cacheado = cache.get('metricas_mkt');
  if (cacheado) return JSON.parse(cacheado);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();

  let totalRegistrados = 0;
  let totalIngresados = 0;
  let aptosSorteo = 0;

  const stands = obtenerListaStands_();
  let conteoStands = {};
  stands.forEach(s => conteoStands[s.nombre] = 0);

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0] !== "") {
      totalRegistrados++;

      if (data[i][6] !== "" && data[i][6] !== undefined) {
        totalIngresados++;
      }

      let visitados = 0;
      stands.forEach(stand => {
        if (data[i][stand.col - 1] !== "" && data[i][stand.col - 1] !== undefined) {
          conteoStands[stand.nombre]++; visitados++;
        }
      });
      if (visitados === stands.length) aptosSorteo++;
    }
  }

  const resultado = {
    success: true,
    total: totalRegistrados,
    ingresados: totalIngresados,
    aptos: aptosSorteo,
    maxStands: stands.length,
    ranking: stands.map(s => ({ nombre: s.nombre, visitas: conteoStands[s.nombre] })).sort((a, b) => b.visitas - a.visitas)
  };

  cache.put('metricas_mkt', JSON.stringify(resultado), 15); // 15s: fresco para el evento, protege Sheets de ráfagas
  return resultado;
}

// Devuelve un consolidado para el buscador web (cacheado igual que las métricas)
function obtenerListaAsistentesMKT() {
  const cache = CacheService.getScriptCache();
  const cacheado = cache.get('lista_asistentes_mkt');
  if (cacheado) return JSON.parse(cacheado);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, asistentes: [] };

  const stands = obtenerListaStands_();
  const lista = data.slice(1).map((row) => {
    let standsVisitados = 0;
    stands.forEach(stand => {
      const val = row[stand.col - 1];
      if (val !== "" && val !== undefined) standsVisitados++;
    });

    return {
      id: row[0],
      nombre: row[1],
      email: row[2] || "---",
      celular: row[3] || "---",
      empresa: row[4] || "---",
      ruc: row[5] || "---",
      totalStands: standsVisitados
    };
  });

  const resultado = { success: true, asistentes: lista, maxStands: stands.length };
  // Nota: si guardas esto en caché, un registro nuevo tarda hasta 15s en aparecer en el buscador MKT.
  // Es un balance intencional para no golpear Sheets en cada tecla del buscador.
  cache.put('lista_asistentes_mkt', JSON.stringify(resultado), 15);
  return resultado;
}

// ---------------------------------------------------------------------
// 🔄 SINCRONIZACIÓN DE INSCRIPCIONES DESDE EL FORMULARIO ANTIGUO (WordPress)
// ---------------------------------------------------------------------
// El formulario vive en WordPress y escribe directamente en OTRO Google Sheet
// que no administramos (por eso no podemos usar un trigger onFormSubmit ni
// confiar en onEdit — ninguno de los dos se dispara quando otro sistema escribe
// por API). En su lugar, un trigger por tiempo revisa ese Sheet cada pocos
// minutos y copia hacia este Sheet solo lo que falta, generando ID igual
// que el registro manual de puerta. Nunca escribe en el Sheet antiguo.
//
// Estructura FIJA del Sheet antiguo (no se toca, solo se lee):
//   A: Nombre | B: correo | C: empresa | D: cargo | E: ruc | F: telefono
// "cargo" no se usa porque la app no tiene ese campo. El RUC sí se copia.

// Wrapper SOLO para el menú: sincronizarInscripcionesFormulario() no puede llamar
// a SpreadsheetApp.getUi() porque también la ejecuta el trigger por tiempo cada
// 5 min, y un trigger no tiene UI (eso rompería la ejecución automática). Por
// eso el clic en el menú pasa por aquí, que sí puede mostrar el resultado.
function sincronizarInscripcionesDesdeMenu_() {
  const resultado = sincronizarInscripcionesFormulario();
  SpreadsheetApp.getUi().alert(resultado.mensaje || 'Sincronización finalizada sin mensaje.');
}

function sincronizarInscripcionesFormulario() {
  try {
    // 1) LECTURA Y CÁLCULO — sin candado. Es de solo lectura, así que no hay
    //    riesgo de choque, y así el evento en vivo (staff escaneando en puerta
    //    y stands) nunca queda bloqueado detrás de la parte más lenta de este
    //    proceso, que crece con el tamaño total de ambos Sheets, no con cuánta
    //    gente nueva se registró en esta pasada.
    const hojaOrigen = obtenerHojaInscripcionesAntigua_();
    const datosOrigen = hojaOrigen.getDataRange().getValues();

    const sheetApp = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const datosApp = sheetApp.getDataRange().getValues();

    // Asistentes ya presentes en el Sheet de la app, para no duplicar en cada pasada.
    // Clave = nombre + correo (no solo correo): varias empresas inscriben a
    // distintas personas bajo el correo de un único contacto.
    const clavesExistentes = new Set();
    for (let i = 1; i < datosApp.length; i++) {
      clavesExistentes.add(clavePersona_(datosApp[i][1], datosApp[i][2]));
    }

    const candidatos = [];
    for (let i = 1; i < datosOrigen.length; i++) {
      const fila = datosOrigen[i];
      const nombreStr = (fila[0] || "").toString().trim();
      const correoStr = (fila[1] || "").toString().trim();
      const empresaStr = (fila[2] || "").toString().trim();
      const rucStr = (fila[4] || "").toString().trim();
      const telefonoStr = (fila[5] || "").toString().trim();

      if (!nombreStr) continue; // fila vacía o incompleta

      const clave = clavePersona_(nombreStr, correoStr);
      if (clavesExistentes.has(clave)) continue; // ya sincronizado antes (mismo nombre y correo)

      candidatos.push({ nombreStr, correoStr, empresaStr, rucStr, telefonoStr });
      clavesExistentes.add(clave); // por si el Sheet antiguo repite la misma fila
    }

    if (candidatos.length === 0) {
      Logger.log('Sincronización completa: 0 nuevos asistentes.');
      return { status: "success", mensaje: "✅ Sincronización completa: 0 nuevos asistentes." };
    }

    // 2) ESCRITURA — candado SOLO alrededor de esto, que es lo único que debe
    //    ser exclusivo (asignar ID/correlativo sin choques con otra escritura
    //    concurrente). Una sola llamada a setValues() para todo el lote, en vez
    //    de un appendRow + getLastRow por persona (eso eran decenas de viajes
    //    de red uno por uno dentro del candado — la causa de las ejecuciones
    //    de 15-25s).
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(20000);
    } catch (e) {
      Logger.log('Sincronización omitida: sistema ocupado con otra escritura.');
      return { status: "error", mensaje: "⏳ Sistema ocupado, se reintentará en la siguiente pasada." };
    }

    try {
      let filaActual = sheetApp.getLastRow(); // se relee fresco, ya adentro del candado
      const filasNuevas = candidatos.map(c => {
        filaActual++;
        const numeroCorrelativo = filaActual.toString().padStart(4, '0');
        const idCifrado = generarIdAsistente_(c.nombreStr, numeroCorrelativo);
        // No se marca asistencia (col G) ni stands: la persona aún no llega al evento.
        return [idCifrado, c.nombreStr, c.correoStr, c.telefonoStr, c.empresaStr, c.rucStr, "", numeroCorrelativo];
      });

      const filaInicio = sheetApp.getLastRow() + 1;
      sheetApp.getRange(filaInicio, 1, filasNuevas.length, filasNuevas[0].length).setValues(filasNuevas);

      Logger.log('Sincronización completa: ' + filasNuevas.length + ' nuevos asistentes.');
      return { status: "success", mensaje: "✅ Sincronización completa: " + filasNuevas.length + " nuevos asistentes." };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    Logger.log('Error en sincronizarInscripcionesFormulario: ' + e.message);
    return { status: "error", mensaje: "❌ Error al sincronizar: " + e.message };
  }
}

// ---------------------------------------------------------------------
// 🔎 AUTOCOMPLETAR EMPRESA A PARTIR DEL RUC (registro manual de puerta)
// ---------------------------------------------------------------------
// Al staff le es más fácil anotar/escanear el RUC (números) que escribir bien
// el nombre de la empresa. Estrategia en dos niveles:
//   1. Primero busca en los asistentes YA registrados en este mismo Sheet
//      (gratis, instantáneo, sin llamar a nada externo).
//   2. Si el RUC no aparece todavía, consulta la API de Decolecta (SUNAT) —
//      requiere el token en Script Properties (DECOLECTA_API_TOKEN). El token
//      nunca sale del servidor: el cliente solo llama a esta acción y recibe
//      el nombre de la empresa, nunca el token.
function buscarEmpresaPorRuc(ruc) {
  const rucLimpio = (ruc || "").toString().trim();
  if (!/^\d{11}$/.test(rucLimpio)) {
    return { success: false, mensaje: "⚠️ El RUC debe tener 11 dígitos." };
  }

  // Nivel 1: caché corto de esta misma consulta (varios miembros del staff
  // podrían escribir el mismo RUC casi al mismo tiempo).
  const cache = CacheService.getScriptCache();
  const cacheKey = "ruc_" + rucLimpio;
  const cacheado = cache.get(cacheKey);
  if (cacheado) return JSON.parse(cacheado);

  // Nivel 2: ¿ya se registró antes en este evento alguien con ese RUC?
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if ((data[i][5] || "").toString().trim() === rucLimpio && data[i][4]) {
      const resultadoLocal = { success: true, empresa: data[i][4], origen: "local" };
      cache.put(cacheKey, JSON.stringify(resultadoLocal), 3600);
      return resultadoLocal;
    }
  }

  // Nivel 3: RUC nuevo para el evento — se consulta la API externa de SUNAT.
  const token = PropertiesService.getScriptProperties().getProperty('DECOLECTA_API_TOKEN');
  if (!token) {
    return { success: false, mensaje: "⚠️ RUC no encontrado localmente y la búsqueda en SUNAT no está configurada (falta DECOLECTA_API_TOKEN)." };
  }

  try {
    const respuesta = UrlFetchApp.fetch('https://api.decolecta.com/v1/sunat/ruc?numero=' + encodeURIComponent(rucLimpio), {
      method: 'get',
      headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    });

    const codigo = respuesta.getResponseCode();
    const cuerpo = JSON.parse(respuesta.getContentText() || '{}');

    if (codigo === 422) return { success: false, mensaje: "⚠️ RUC inválido." };
    if (codigo !== 200 || !cuerpo.razon_social) {
      return { success: false, mensaje: "❌ RUC no encontrado en SUNAT." };
    }

    const resultadoApi = { success: true, empresa: cuerpo.razon_social, origen: "sunat" };
    cache.put(cacheKey, JSON.stringify(resultadoApi), 3600); // 1h: la razón social no cambia en el día del evento
    return resultadoApi;
  } catch (e) {
    return { success: false, mensaje: "❌ Error al consultar SUNAT: " + e.message };
  }
}

function obtenerHojaInscripcionesAntigua_() {
  // Nota: se valida solo que no esté vacío (no se compara contra el texto de
  // relleno original) para que un reemplazo manual del placeholder nunca deje
  // esta condición comparándose contra sí misma por accidente.
  if (!ID_HOJA_INSCRIPCIONES_ANTIGUA) {
    throw new Error('Configura ID_HOJA_INSCRIPCIONES_ANTIGUA con el ID real del Sheet del formulario (ver constante en la parte superior del archivo).');
  }
  const libro = SpreadsheetApp.openById(ID_HOJA_INSCRIPCIONES_ANTIGUA);
  const hoja = NOMBRE_PESTANA_INSCRIPCIONES_ANTIGUA
    ? libro.getSheetByName(NOMBRE_PESTANA_INSCRIPCIONES_ANTIGUA)
    : libro.getSheets()[0];
  if (!hoja) {
    throw new Error('No se encontró la pestaña "' + NOMBRE_PESTANA_INSCRIPCIONES_ANTIGUA + '" en el Sheet antiguo.');
  }
  return hoja;
}

// Instala (una sola vez) el trigger por tiempo que llama a sincronizarInscripcionesFormulario
// cada 5 minutos. Ejecuta esta función manualmente una vez desde el editor de Apps Script
// (▶ Run) para autorizar el trigger — no se puede autoinstalar desde el propio Web App.
function instalarTriggerSincronizacion() {
  const yaExiste = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'sincronizarInscripcionesFormulario');
  if (yaExiste) {
    Logger.log('El trigger de sincronización ya estaba instalado. No se creó uno nuevo.');
    return;
  }
  ScriptApp.newTrigger('sincronizarInscripcionesFormulario')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('Trigger instalado: sincronizarInscripcionesFormulario se ejecutará cada 5 minutos.');
}
