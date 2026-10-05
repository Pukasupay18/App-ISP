import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Dos clientes a propósito, no uno compartido:
//
// `sbPublic` — /pase, /stand, /sponsor. Sin sesión: estas rutas se
// identifican por el código en la URL, nunca por login. persistSession
// en false evita que cada uno de los ~300 teléfonos mantenga un
// refresh de token corriendo de fondo sin necesidad (ver discusión de
// optimización de free tier).
export const sbPublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// `sbMkt` — /mkt, el único rol con login real (Supabase Auth). Sesión
// persistida + autoRefresh. `startAutoRefresh()`/`stopAutoRefresh()` se
// llaman explícitamente al volver de segundo plano (ver App.tsx) porque
// los navegadores móviles congelan temporizadores en background — sin
// esto, el staff puede volver a la pestaña con el token ya vencido y
// quedar forzado a reloguearse (el mismo problema reportado en V2).
export const sbMkt = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
