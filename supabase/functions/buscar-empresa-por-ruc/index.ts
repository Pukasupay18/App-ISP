// Autocompleta la razón social a partir del RUC — reemplaza a
// buscarEmpresaPorRuc() en Código.gs. Es una acción de staff MKT (estaba en
// ACCIONES_ADMIN, exigía sesión de admin), así que aquí exige un JWT real de
// Supabase Auth: auth: ["user"]. Se usa ctx.supabase (cliente con RLS, no
// admin) para la búsqueda local — si el usuario no es staff (sin fila en
// admin_users), es_staff_mkt() lo bloquea explícito antes de tocar nada.
//
// Dos niveles de búsqueda (el nivel 1 de Código.gs — CacheService de 1h para
// deduplicar consultas casi simultáneas del mismo RUC — se elimina: ya no
// hace falta, Postgres resuelve el nivel local al instante, sin el cuello de
// botella de getDataRange() que ese caché existía para evitar):
//   1. Local: ¿ya se registró en este evento alguien con ese RUC?
//   2. Externo: RUC nuevo — se consulta la API de Decolecta (SUNAT).
//
// El token de Decolecta vive en un secret de Supabase (DECOLECTA_API_TOKEN),
// nunca en el cliente ni en este código:
//   supabase secrets set DECOLECTA_API_TOKEN=xxx --project-ref twdhsipvaitoclcxlltk

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: ["user"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return Response.json({ success: false, mensaje: "Método no permitido." }, { status: 405 });
    }

    const { data: esStaff, error: esStaffError } = await ctx.supabase.rpc("es_staff_mkt");
    if (esStaffError) {
      console.error("buscar-empresa-por-ruc (es_staff_mkt):", esStaffError);
      return Response.json({ success: false, mensaje: "❌ Error al validar la sesión." }, { status: 500 });
    }
    if (!esStaff) {
      return Response.json(
        { success: false, mensaje: "⛔ Sesión no autorizada o expirada. Vuelve a iniciar sesión en el panel MKT." },
        { status: 403 },
      );
    }

    let ruc = "";
    try {
      const body = await req.json();
      ruc = (body?.ruc ?? "").toString().trim();
    } catch (_e) {
      return Response.json({ success: false, mensaje: "⚠️ Cuerpo de la petición inválido." }, { status: 400 });
    }

    if (!/^\d{11}$/.test(ruc)) {
      return Response.json({ success: false, mensaje: "⚠️ El RUC debe tener 11 dígitos." });
    }

    // Nivel 1 (local): ¿ya se registró antes en este evento alguien con ese RUC?
    const { data: existente, error: existenteError } = await ctx.supabase
      .from("attendees")
      .select("empresa")
      .eq("ruc", ruc)
      .not("empresa", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existenteError) {
      console.error("buscar-empresa-por-ruc (lookup local):", existenteError);
      return Response.json({ success: false, mensaje: "❌ Error al buscar el RUC localmente." }, { status: 500 });
    }

    if (existente?.empresa) {
      return Response.json({ success: true, empresa: existente.empresa, origen: "local" });
    }

    // Nivel 2 (externo): RUC nuevo para el evento — se consulta Decolecta/SUNAT.
    const token = Deno.env.get("DECOLECTA_API_TOKEN");
    if (!token) {
      return Response.json({
        success: false,
        mensaje: "⚠️ RUC no encontrado localmente y la búsqueda en SUNAT no está configurada (falta el secret DECOLECTA_API_TOKEN).",
      });
    }

    try {
      const respuesta = await fetch(`https://api.decolecta.com/v1/sunat/ruc?numero=${encodeURIComponent(ruc)}`, {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });

      const cuerpo = await respuesta.json().catch(() => ({}));

      if (respuesta.status === 422) {
        return Response.json({ success: false, mensaje: "⚠️ RUC inválido." });
      }
      if (respuesta.status !== 200 || !cuerpo?.razon_social) {
        return Response.json({ success: false, mensaje: "❌ RUC no encontrado en SUNAT." });
      }

      return Response.json({ success: true, empresa: cuerpo.razon_social, origen: "sunat" });
    } catch (e) {
      console.error("buscar-empresa-por-ruc (Decolecta):", e);
      return Response.json({ success: false, mensaje: "❌ Error al consultar SUNAT: " + (e as Error).message }, { status: 500 });
    }
  }),
};
