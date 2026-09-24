// Registro manual de puerta — reemplaza a registroManualYAsistencia() y
// actualizarRegistroExistente() de Código.gs (unificadas en un solo
// endpoint con `mode: "crear" | "actualizar"`, igual que el botón único
// "GUARDAR NUEVO Y MARCAR" / "ACTUALIZAR DATOS Y MARCAR" del frontend).
//
// Por qué esto NO es un insert/update directo desde el cliente (a
// diferencia de marcarDirecto/procesarCheckInGeneral, que sí lo son): la
// generación del ID usa un correlativo basado en count(*) — si dos
// miembros de staff registran gente nueva al mismo segundo desde sus
// propios celulares, cada insert directo calcularía su propio conteo por
// separado y podría chocar. Centralizarlo aquí no elimina la carrera del
// todo, pero si choca, el segundo intento falla limpio (23505 en el PK de
// `id`) y devuelve un mensaje claro en vez de un error crudo de Postgres.
//
// auth: ["user"] + es_staff_mkt() explícito, mismo patrón que
// buscar-empresa-por-ruc y sincronizar-inscripciones-formulario.

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

export default {
  fetch: withSupabase({ auth: ["user"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ success: false, mensaje: "Método no permitido." }, { status: 405 });
    }

    const { data: esStaff, error: esStaffError } = await ctx.supabase.rpc("es_staff_mkt");
    if (esStaffError) {
      console.error("registro-manual (es_staff_mkt):", esStaffError);
      return Response.json({ success: false, mensaje: "❌ Error al validar la sesión." }, { status: 500 });
    }
    if (!esStaff) {
      return Response.json(
        { success: false, mensaje: "⛔ Sesión no autorizada o expirada. Vuelve a iniciar sesión en el panel MKT." },
        { status: 403 },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (_e) {
      return Response.json({ success: false, mensaje: "⚠️ Cuerpo de la petición inválido." }, { status: 400 });
    }

    const modo = (body?.mode ?? "").toString();
    const nombreStr = body?.nombreCompleto ? body.nombreCompleto.toString().trim() : "Usuario Sin Nombre";
    const emailStr = body?.email ? body.email.toString().trim() : "";
    const celularStr = body?.celular ? body.celular.toString().trim() : "";
    const empresaStr = body?.empresa ? body.empresa.toString().trim() : "";
    const rucStr = body?.ruc ? body.ruc.toString().trim() : "";

    if (modo === "crear") {
      // Dedup por nombre + correo — igual que el original, solo se valida si
      // trajo correo (un registro sin correo nunca se considera duplicado).
      if (normalizarTexto(emailStr) !== "") {
        const claveNueva = clavePersona(nombreStr, emailStr);
        const { data: existentes, error: existentesError } = await ctx.supabase
          .from("attendees")
          .select("nombre, email");

        if (existentesError) {
          console.error("registro-manual (lookup dedup):", existentesError);
          return Response.json({ success: false, mensaje: "❌ Error al validar duplicados." }, { status: 500 });
        }

        const yaExiste = (existentes ?? []).some((a) => clavePersona(a.nombre ?? "", a.email ?? "") === claveNueva);
        if (yaExiste) {
          return Response.json({
            success: false,
            mensaje: "⚠️ ERROR: Ya existe un asistente registrado con ese mismo nombre y correo. Búscalo y usa el botón de Editar (✏️).",
          });
        }
      }

      const { count: totalActual, error: countError } = await ctx.supabase
        .from("attendees")
        .select("id", { count: "exact", head: true });

      if (countError) {
        console.error("registro-manual (count):", countError);
        return Response.json({ success: false, mensaje: "❌ Error al calcular el ID." }, { status: 500 });
      }

      const numeroCorrelativo = String((totalActual ?? 0) + 1).padStart(4, "0");
      const idNuevo = generarIdAsistente(nombreStr, numeroCorrelativo);

      const { error: insertError } = await ctx.supabase.from("attendees").insert({
        id: idNuevo,
        nombre: nombreStr,
        email: emailStr || null,
        celular: celularStr || null,
        empresa: empresaStr || null,
        ruc: rucStr || null,
        asistencia_at: new Date().toISOString(),
        origen: "manual",
      });

      if (insertError) {
        console.error("registro-manual (insert):", insertError);
        if (insertError.code === "23505") {
          return Response.json({
            success: false,
            mensaje: "⏳ Choque al generar el ID (dos registros al mismo tiempo). Intenta guardar de nuevo.",
          });
        }
        return Response.json({ success: false, mensaje: "❌ Error interno en el servidor: " + insertError.message }, { status: 500 });
      }

      return Response.json({ success: true, mensaje: "✅ ¡Registro Nuevo Exitoso! ID: " + idNuevo, id: idNuevo });
    }

    if (modo === "actualizar") {
      const id = (body?.id ?? "").toString().trim();
      if (!id) {
        return Response.json({ success: false, mensaje: "❌ Falta el ID a actualizar." }, { status: 400 });
      }

      const cambios: Record<string, unknown> = {
        email: emailStr,
        celular: celularStr,
        empresa: empresaStr,
        ruc: rucStr || null,
        asistencia_at: new Date().toISOString(),
      };
      if (body?.nombreCompleto) cambios.nombre = nombreStr;

      const { data: actualizado, error: updateError } = await ctx.supabase
        .from("attendees")
        .update(cambios)
        .eq("id", id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("registro-manual (update):", updateError);
        if (updateError.code === "23505") {
          return Response.json({
            success: false,
            mensaje: "⚠️ Ese nombre + correo ya pertenece a otro asistente registrado.",
          });
        }
        return Response.json({ success: false, mensaje: "❌ Error interno en el servidor: " + updateError.message }, { status: 500 });
      }

      if (!actualizado) {
        return Response.json({ success: false, mensaje: "❌ ID no encontrado para actualizar." });
      }

      return Response.json({ success: true, mensaje: "✅ ¡Datos editados con éxito y asistencia registrada en puerta!", id });
    }

    return Response.json({ success: false, mensaje: "⚠️ mode debe ser 'crear' o 'actualizar'." }, { status: 400 });
  }),
};
