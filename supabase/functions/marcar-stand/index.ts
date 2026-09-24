// Registra la visita de un asistente a un stand — reemplaza a
// marcarAsistenciaStand() en Código.gs. Igual que ese endpoint original,
// recibe el PIN en cada llamada (no un token aparte): el PIN vive en
// memoria del navegador del stand durante el evento, nunca en disco, y
// esta función lo revalida contra la base en cada escaneo. Por eso auth es
// "publishable" (clave pública, sin login de staff) — el PIN es el único
// secreto que autoriza la escritura.
//
// `stands` está bloqueada por RLS para todo el mundo (ver supabase/schema.sql),
// por eso se usa ctx.supabaseAdmin (service_role, se salta RLS) para validar
// el PIN — igual que en validar-pin-stand.
//
// El anti-duplicado ya NO es un LockService global: la PK compuesta
// (attendee_id, stand_id) de stand_visits hace que dos escaneos del mismo
// QR en el mismo stand choquen contra la constraint. Se usa upsert con
// ignoreDuplicates para que el segundo escaneo no falle, solo no inserte de
// nuevo — y así se puede avisar al staff que ya estaba registrado.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ success: false, mensaje: "Método no permitido." }, { status: 405 });
    }

    let pin = "";
    let attendeeId = "";
    try {
      const body = await req.json();
      pin = (body?.pin ?? "").toString().trim();
      attendeeId = (body?.attendeeId ?? "").toString().trim().toUpperCase();
    } catch (_e) {
      return Response.json({ success: false, mensaje: "⚠️ Cuerpo de la petición inválido." }, { status: 400 });
    }

    if (!pin || !attendeeId) {
      return Response.json({ success: false, mensaje: "⚠️ Falta el PIN o el código de asistente." }, { status: 400 });
    }

    const { data: stand, error: standError } = await ctx.supabaseAdmin
      .from("stands")
      .select("id, nombre, activo")
      .eq("pin", pin)
      .maybeSingle();

    if (standError) {
      console.error("marcar-stand (validar pin):", standError);
      return Response.json({ success: false, mensaje: "❌ Error al validar el PIN." }, { status: 500 });
    }

    if (!stand || !stand.activo) {
      return Response.json({ success: false, mensaje: "❌ PIN de Stand incorrecto." });
    }

    const { data: attendee, error: attendeeError } = await ctx.supabaseAdmin
      .from("attendees")
      .select("id, nombre")
      .eq("id", attendeeId)
      .maybeSingle();

    if (attendeeError) {
      console.error("marcar-stand (buscar asistente):", attendeeError);
      return Response.json({ success: false, mensaje: "❌ Error al buscar al asistente." }, { status: 500 });
    }

    if (!attendee) {
      return Response.json({ success: false, mensaje: "❌ Código de asistente no válido." });
    }

    const { data: inserted, error: insertError } = await ctx.supabaseAdmin
      .from("stand_visits")
      .upsert(
        { attendee_id: attendee.id, stand_id: stand.id },
        { onConflict: "attendee_id,stand_id", ignoreDuplicates: true },
      )
      .select();

    if (insertError) {
      console.error("marcar-stand (insertar visita):", insertError);
      return Response.json({ success: false, mensaje: "❌ Error al registrar la visita." }, { status: 500 });
    }

    const yaEstaba = !inserted || inserted.length === 0;
    const mensaje = yaEstaba
      ? `ℹ️ ${attendee.nombre} ya estaba registrado en ${stand.nombre}.`
      : `✅ ${stand.nombre} registró a: ${attendee.nombre}`;

    return Response.json({ success: true, yaEstaba, mensaje, standNombre: stand.nombre, attendeeNombre: attendee.nombre });
  }),
};
