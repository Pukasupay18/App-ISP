// Trae los inscritos del formulario web (arequipa.isp.fiberlux.pe) hacia
// `attendees` — mismo patrón que sincronizar-inscripciones-formulario en V2,
// adaptado a la hoja real de Arequipa: "BBDD Arequipa ISP", pestaña "Hoja 1".
//
// Columnas de esa hoja (A→H): Nombre, correo, empresa, cargo, ruc, telefono,
// utm, date. `cargo`, `utm` y `date` no se guardan — no hay campo para ellos
// en `attendees` y no los necesita ningún flujo de la app. El RUC ya viene
// capturado en el formulario, así que a diferencia de buscar-empresa-por-ruc
// aquí NUNCA se llama a Decolecta: solo se copia el valor tal cual.
//
// Se lee el CSV público de la hoja (debe estar compartida como "cualquiera
// con el enlace puede ver" — igual que en V2). Pensada para correr en dos
// modos:
//   - "secret": llamada interna disparada por pg_cron (ver v3/supabase/cron.sql)
//     cada 15-30 min — no hace falta que sea instantáneo, son inscripciones
//     previas al evento, no check-in en vivo.
//   - "user": botón manual "Sincronizar ahora" en el panel Mkt, exige
//     es_staff_mkt() igual que el resto de acciones de staff.
// Ambos caminos respetan event_config.registro_abierto: si Marketing apagó
// el registro, esta sincronización deja de sumar inscritos nuevos aunque el
// formulario siga recibiendo respuestas.

const SHEET_ID_INSCRIPCIONES = "1OYoty1hxAsGUlMSTHfsBeLbc2lNALFJj4sJLbYTbjdM";
const PESTANA_INSCRIPCIONES = "Hoja 1";

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

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

function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let dentroComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') dentroComillas = false;
      else campo += c;
    } else if (c === '"') {
      dentroComillas = true;
    } else if (c === ",") {
      fila.push(campo); campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); filas.push(fila); fila = []; campo = "";
    } else {
      campo += c;
    }
  }
  if (campo !== "" || fila.length > 0) { fila.push(campo); filas.push(fila); }
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
        console.error("sincronizar-inscripciones (es_staff_mkt):", esStaffError);
        return Response.json({ success: false, mensaje: "❌ Error al validar la sesión." }, { status: 500 });
      }
      if (!esStaff) {
        return Response.json(
          { success: false, mensaje: "⛔ Sesión no autorizada o expirada. Vuelve a iniciar sesión en el panel MKT." },
          { status: 403 },
        );
      }
    }
    // ctx.authMode === "secret": llamada interna de pg_cron, sigue directo.

    const { data: config, error: configError } = await ctx.supabaseAdmin
      .from("event_config")
      .select("registro_abierto")
      .eq("id", 1)
      .maybeSingle();

    if (configError) {
      console.error("sincronizar-inscripciones (event_config):", configError);
      return Response.json({ success: false, mensaje: "❌ Error al leer la configuración del evento." }, { status: 500 });
    }

    if (config && config.registro_abierto === false) {
      return Response.json({
        success: true, nuevos: 0,
        mensaje: "ℹ️ El registro está cerrado (event_config.registro_abierto = false) — no se importó nada.",
      });
    }

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID_INSCRIPCIONES}/gviz/tq?tqx=out:csv&sheet=${
        encodeURIComponent(PESTANA_INSCRIPCIONES)
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

      const { data: existentes, error: existentesError } = await ctx.supabaseAdmin
        .from("attendees")
        .select("nombre, email");

      if (existentesError) {
        console.error("sincronizar-inscripciones (lookup existentes):", existentesError);
        return Response.json({ success: false, mensaje: "❌ Error al leer asistentes existentes." }, { status: 500 });
      }

      const clavesExistentes = new Set<string>(
        (existentes ?? []).map((a) => clavePersona(a.nombre ?? "", a.email ?? "")),
      );

      // Columnas reales de "BBDD Arequipa ISP": Nombre, correo, empresa,
      // cargo, ruc, telefono, utm, date — índices 0..7. cargo/utm/date se
      // leen (f[3], f[6], f[7]) pero no se usan: no hay dónde guardarlos.
      type Candidato = { nombre: string; correo: string; empresa: string; ruc: string; telefono: string };
      const candidatos: Candidato[] = [];

      for (let i = 1; i < filas.length; i++) {
        const f = filas[i];
        const nombre = (f[0] ?? "").trim();
        const correo = (f[1] ?? "").trim();
        const empresa = (f[2] ?? "").trim();
        const ruc = (f[4] ?? "").trim();
        const telefono = (f[5] ?? "").trim();

        if (!nombre) continue;

        const clave = clavePersona(nombre, correo);
        if (clavesExistentes.has(clave)) continue;

        candidatos.push({ nombre, correo, empresa, ruc, telefono });
        clavesExistentes.add(clave);
      }

      if (candidatos.length === 0) {
        return Response.json({ success: true, nuevos: 0, mensaje: "✅ Sincronización completa: 0 nuevos asistentes." });
      }

      const { count: totalActual, error: countError } = await ctx.supabaseAdmin
        .from("attendees")
        .select("id", { count: "exact", head: true });

      if (countError) {
        console.error("sincronizar-inscripciones (count):", countError);
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
          origen: "sync_sheet",
        };
      });

      const { error: insertError } = await ctx.supabaseAdmin.from("attendees").insert(filasNuevas);

      if (insertError) {
        console.error("sincronizar-inscripciones (insert):", insertError);
        return Response.json({ success: false, mensaje: "❌ Error al sincronizar: " + insertError.message }, { status: 500 });
      }

      const mensaje = `✅ Sincronización completa: ${filasNuevas.length} nuevos asistentes.`;
      return Response.json({ success: true, nuevos: filasNuevas.length, mensaje });
    } catch (e) {
      console.error("sincronizar-inscripciones:", e);
      return Response.json({ success: false, mensaje: "❌ Error al sincronizar: " + (e as Error).message }, { status: 500 });
    }
  }),
};
