// Autocompleta la razón social a partir del RUC en el registro manual de
// Attendees.tsx — botón aparte, nunca automático: el staff lo usa solo
// cuando quiere, si ya tiene el nombre correcto a mano no hace falta
// tocarlo. Acción de staff MKT, exige sesión real de Supabase Auth.
//
// Dos niveles de búsqueda:
//   1. Local: ¿ya se registró en este evento alguien con ese RUC?
//   2. Externo: RUC nuevo — se consulta la API de Decolecta (SUNAT).
//
// Failover de dos tokens de Decolecta: el plan gratuito tiene un límite
// de consultas/mes, y con ~215 asistentes es real que se agote a mitad
// de evento. Si el primer token devuelve 401/403/429/5xx (cupo agotado,
// token inválido, caído) se reintenta UNA vez con el segundo token antes
// de rendirse — nunca ante un 422 (RUC inválido), que es una respuesta
// válida de SUNAT, no una falla del token.
//
// Los tokens viven en secrets de Supabase, nunca en el cliente:
//   supabase secrets set DECOLECTA_API_TOKEN=xxx --project-ref hjdxrdptvlafjhtvdigp
//   supabase secrets set DECOLECTA_API_TOKEN_2=yyy --project-ref hjdxrdptvlafjhtvdigp
//
// Imports con especificador completo (npm:/jsr:) en vez de bare specifier +
// import map: así funciona igual desplegado por CLI que pegado directo en
// el Dashboard (que no lee deno.json).

import "jsr:@supabase/functions-js@^2/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";

type ResultadoDecolecta =
  | { tipo: "ok"; empresa: string }
  | { tipo: "ruc_invalido" }
  | { tipo: "no_encontrado" }
  | { tipo: "token_agotado" }
  | { tipo: "error"; mensaje: string };

async function consultarConToken(ruc: string, token: string): Promise<ResultadoDecolecta> {
  try {
    const respuesta = await fetch(`https://api.decolecta.com/v1/sunat/ruc?numero=${encodeURIComponent(ruc)}`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });

    if (respuesta.status === 422) return { tipo: "ruc_invalido" };
    if ([401, 403, 429].includes(respuesta.status) || respuesta.status >= 500) return { tipo: "token_agotado" };

    const cuerpo = await respuesta.json().catch(() => ({}));
    if (respuesta.status !== 200 || !cuerpo?.razon_social) return { tipo: "no_encontrado" };

    return { tipo: "ok", empresa: cuerpo.razon_social };
  } catch (e) {
    return { tipo: "error", mensaje: (e as Error).message };
  }
}

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

    // Nivel 2 (externo): RUC nuevo para el evento — se consulta Decolecta/SUNAT,
    // con failover al segundo token si el primero falla por cupo/caída.
    const tokens = [Deno.env.get("DECOLECTA_API_TOKEN"), Deno.env.get("DECOLECTA_API_TOKEN_2")]
      .filter((t): t is string => !!t);

    if (tokens.length === 0) {
      return Response.json({
        success: false,
        mensaje: "⚠️ RUC no encontrado localmente y la búsqueda en SUNAT no está configurada (falta el secret DECOLECTA_API_TOKEN).",
      });
    }

    let ultimoResultado: ResultadoDecolecta = { tipo: "no_encontrado" };
    for (const token of tokens) {
      const resultado = await consultarConToken(ruc, token);
      ultimoResultado = resultado;

      if (resultado.tipo === "ok") return Response.json({ success: true, empresa: resultado.empresa, origen: "sunat" });
      if (resultado.tipo === "ruc_invalido") return Response.json({ success: false, mensaje: "⚠️ RUC inválido." });
      if (resultado.tipo === "no_encontrado") return Response.json({ success: false, mensaje: "❌ RUC no encontrado en SUNAT." });
      // "token_agotado" o "error" de red: sigue al siguiente token, si queda alguno.
    }

    if (ultimoResultado.tipo === "error") {
      console.error("buscar-empresa-por-ruc (Decolecta):", ultimoResultado.mensaje);
      return Response.json({ success: false, mensaje: "❌ Error al consultar SUNAT: " + ultimoResultado.mensaje }, { status: 500 });
    }
    return Response.json({ success: false, mensaje: "❌ Los dos tokens de SUNAT fallaron (cupo agotado o servicio caído)." });
  }),
};
