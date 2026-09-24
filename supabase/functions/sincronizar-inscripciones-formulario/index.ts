// Sincroniza los inscritos del formulario de WordPress hacia `attendees` —
// reemplaza a sincronizarInscripcionesFormulario() en Código.gs. Ese
// formulario vive en OTRO Google Sheet que no administramos (no se toca);
// esta función solo lo LEE (vía el CSV público de Google Sheets — el Sheet
// está compartido como "cualquiera con el enlace puede ver", así que no
// hace falta cuenta de servicio ni credenciales de Google) y agrega como
// filas nuevas de `attendees` a quienes todavía no existen aquí.
//
// Pensada para correr en dos modos:
//   - "secret": llamada interna, disparada por un cron (pg_cron / Scheduled
//     Functions) cada varios minutos — sin sesión de usuario.
//   - "user": botón manual "Sincronizar ahora" desde el futuro panel MKT,
//     exige es_staff_mkt() igual que buscar-empresa-por-ruc.
// Ambos caminos, una vez autorizados, escriben con ctx.supabaseAdmin
// (bypassa RLS) — el modo "secret" no tiene sesión de la que la RLS pudiera
// colgar un permiso.
//
// El ID del Sheet antiguo y su pestaña son fijos aquí (no son secretos: sin
// el Sheet en "cualquiera con el enlace puede ver" no otorgan ningún acceso
// nuevo) — mismo trato que ID_HOJA_INSCRIPCIONES_ANTIGUA en Código.gs.
const SHEET_ID_INSCRIPCIONES_ANTIGUA = "1ZV42Rj1KGGrc006O7lQPVsMYCn40XqL3XR8eNXkICJM";
const PESTANA_INSCRIPCIONES_ANTIGUA = "Hoja 1";

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// --- Helpers portados 1:1 de Código.gs ---

function normalizarTexto(t: string): string {
  return t
    ? t.toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim()
    : "";
}

function clavePersona(nombre: string, correo: string): string {
  return `${normalizarTexto(nombre)}|${normalizarTexto(correo)}`;
}

function generarIdAsistente(nombreCompleto: string, numeroCorrelativo: string): string {
  const partesNombre = nombreCompleto.toString().trim().split(/\s+/);
  let iniciales: string;
  if (partesNombre.length >= 2) {
    iniciales = (partesNombre[0].charAt(0) + partesNombre[1].charAt(0)).toUpperCase();
  } else {
    iniciales = partesNombre[0].substring(0, 2).toUpperCase().padEnd(2, "X");
  }
  return `${iniciales}${numeroCorrelativo}FX`;
}

// Parser CSV mínimo pero correcto (RFC4180): respeta comas y saltos de línea
// dentro de campos entre comillas, y comillas escapadas como "".
function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let dentroDeComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (dentroDeComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroDeComillas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      dentroDeComillas = true;
    } else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  // Última fila (si el archivo no termina en salto de línea).
  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.length > 1 || f[0] !== "");
}

export default {
  fetch: withSupabase({ auth: ["user", "secret"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ success: false, mensaje: "Método no permitido." }, { status: 405 });
    }

    if (ctx.authMode === "user") {
      const { data: esStaff, error: esStaffError } = await ctx.supabase.rpc("es_staff_mkt");
      if (esStaffError) {
        console.error("sincronizar-inscripciones-formulario (es_staff_mkt):", esStaffError);
        return Response.json({ success: false, mensaje: "❌ Error al validar la sesión." }, { status: 500 });
      }
      if (!esStaff) {
        return Response.json(
          { success: false, mensaje: "⛔ Sesión no autorizada o expirada. Vuelve a iniciar sesión en el panel MKT." },
          { status: 403 },
        );
      }
    }
    // ctx.authMode === "secret": llamada interna confiable (cron), sigue directo.

    try {
      // 1) LECTURA — CSV público del Sheet del formulario de WordPress.
      const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID_INSCRIPCIONES_ANTIGUA}/gviz/tq?tqx=out:csv&sheet=${
        encodeURIComponent(PESTANA_INSCRIPCIONES_ANTIGUA)
      }`;
      const respuestaCsv = await fetch(csvUrl);
      if (!respuestaCsv.ok) {
        return Response.json({
          success: false,
          mensaje: `❌ No se pudo leer el Sheet de inscripciones (HTTP ${respuestaCsv.status}). ¿Sigue compartido como "cualquiera con el enlace puede ver"?`,
        }, { status: 502 });
      }
      const textoCsv = await respuestaCsv.text();
      const filas = parsearCsv(textoCsv);

      if (filas.length <= 1) {
        return Response.json({ success: true, nuevos: 0, mensaje: "✅ Sincronización completa: 0 nuevos asistentes." });
      }

      // 2) DEDUP — asistentes ya presentes en `attendees` (nombre+correo, no
      //    solo correo: varias empresas inscriben gente bajo el correo de un
      //    único contacto).
      const { data: existentes, error: existentesError } = await ctx.supabaseAdmin
        .from("attendees")
        .select("nombre, email");

      if (existentesError) {
        console.error("sincronizar-inscripciones-formulario (lookup existentes):", existentesError);
        return Response.json({ success: false, mensaje: "❌ Error al leer asistentes existentes." }, { status: 500 });
      }

      const clavesExistentes = new Set<string>(
        (existentes ?? []).map((a) => clavePersona(a.nombre ?? "", a.email ?? "")),
      );

      type Candidato = { nombre: string; correo: string; empresa: string; ruc: string; telefono: string };
      const candidatos: Candidato[] = [];

      for (let i = 1; i < filas.length; i++) {
        const f = filas[i];
        const nombre = (f[0] ?? "").trim();
        const correo = (f[1] ?? "").trim();
        const empresa = (f[2] ?? "").trim();
        // f[3] = "cargo", no se usa (igual que en Código.gs).
        const ruc = (f[4] ?? "").trim();
        const telefono = (f[5] ?? "").trim();

        if (!nombre) continue; // fila vacía o incompleta

        const clave = clavePersona(nombre, correo);
        if (clavesExistentes.has(clave)) continue; // ya sincronizado antes

        candidatos.push({ nombre, correo, empresa, ruc, telefono });
        clavesExistentes.add(clave); // por si el Sheet antiguo repite la misma fila
      }

      if (candidatos.length === 0) {
        return Response.json({ success: true, nuevos: 0, mensaje: "✅ Sincronización completa: 0 nuevos asistentes." });
      }

      // 3) ESCRITURA — un solo insert por lote. El correlativo del ID usa el
      //    conteo actual de la tabla como punto de partida (equivalente al
      //    getLastRow() del Sheet original, sin depender de números de fila).
      const { count: totalActual, error: countError } = await ctx.supabaseAdmin
        .from("attendees")
        .select("id", { count: "exact", head: true });

      if (countError) {
        console.error("sincronizar-inscripciones-formulario (count):", countError);
        return Response.json({ success: false, mensaje: "❌ Error al calcular el correlativo." }, { status: 500 });
      }

      let correlativo = (totalActual ?? 0) + 1;
      const filasNuevas = candidatos.map((c) => {
        const numeroCorrelativo = String(correlativo++).padStart(4, "0");
        return {
          id: generarIdAsistente(c.nombre, numeroCorrelativo),
          nombre: c.nombre,
          email: c.correo || null,
          celular: c.telefono || null,
          empresa: c.empresa || null,
          ruc: c.ruc || null,
          origen: "sync_formulario",
        };
      });

      const { error: insertError } = await ctx.supabaseAdmin.from("attendees").insert(filasNuevas);

      if (insertError) {
        console.error("sincronizar-inscripciones-formulario (insert):", insertError);
        return Response.json({ success: false, mensaje: "❌ Error al sincronizar: " + insertError.message }, { status: 500 });
      }

      const mensaje = `✅ Sincronización completa: ${filasNuevas.length} nuevos asistentes.`;
      return Response.json({ success: true, nuevos: filasNuevas.length, mensaje });
    } catch (e) {
      console.error("sincronizar-inscripciones-formulario:", e);
      return Response.json({ success: false, mensaje: "❌ Error al sincronizar: " + (e as Error).message }, { status: 500 });
    }
  }),
};
