// Valida el PIN de un stand y devuelve su nombre + id — reemplaza a
// validarPinStand() en Código.gs. Se llama SIN sesión de staff (cualquiera
// en la puerta de un stand puede escribir el PIN que le dio Marketing), por
// eso auth es "publishable" (clave pública, sin login).
//
// El PIN vive en la tabla `stands`, que RLS bloquea para todo el mundo
// (ver supabase/schema.sql) — por eso esta función usa ctx.supabaseAdmin
// (service_role, se salta RLS) en vez del cliente normal. Es la ÚNICA forma
// en que el PIN se compara contra la base, nunca se expone la tabla entera.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ success: false, mensaje: "Método no permitido." }, { status: 405 });
    }

    let pin = "";
    try {
      const body = await req.json();
      pin = (body?.pin ?? "").toString().trim();
    } catch (_e) {
      return Response.json({ success: false, mensaje: "⚠️ Cuerpo de la petición inválido." }, { status: 400 });
    }

    if (!pin) {
      return Response.json({ success: false, mensaje: "⚠️ Ingresa un PIN." }, { status: 400 });
    }

    const { data, error } = await ctx.supabaseAdmin
      .from("stands")
      .select("id, nombre, activo")
      .eq("pin", pin)
      .maybeSingle();

    if (error) {
      console.error("validar-pin-stand:", error);
      return Response.json({ success: false, mensaje: "❌ Error al validar el PIN." }, { status: 500 });
    }

    if (!data || !data.activo) {
      return Response.json({ success: false, mensaje: "❌ PIN incorrecto." });
    }

    return Response.json({ success: true, standId: data.id, nombre: data.nombre });
  }),
};
