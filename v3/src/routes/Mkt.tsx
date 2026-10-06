import { useCallback, useEffect, useState, type FormEvent } from "react";
import { sbMkt } from "../lib/supabaseClient";
import { Sidebar, Topbar } from "./mkt/Chrome";
import Overview from "./mkt/Overview";
import Attendees from "./mkt/Attendees";
import Stands from "./mkt/Stands";
import Ranking from "./mkt/Ranking";
import Sorteo from "./mkt/Sorteo";
import Configuracion from "./mkt/Configuracion";
import type { Metricas, View } from "./mkt/types";
import "./mkt/mkt.css";

// ⚠️ Pendiente de tu lado: crea este usuario en Supabase Auth (Dashboard
// → Authentication → Users → Add user) y agrégalo a `admin_users` (ver
// schema.sql) si todavía no lo hiciste.
const EMAIL_MKT_COMPARTIDO = "hola@fiberlux.pe";

export default function Mkt() {
  const [session, setSession] = useState<boolean | null>(null);
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [view, setView] = useState<View>("resumen");
  const [menuOpen, setMenuOpen] = useState(false);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [cargandoMetricas, setCargandoMetricas] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  useEffect(() => {
    sbMkt.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = sbMkt.auth.onAuthStateChange((_evt, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const cargarMetricas = useCallback(async () => {
    setCargandoMetricas(true);
    const { data: res } = await sbMkt.rpc("obtener_metricas_mkt");
    setCargandoMetricas(false);
    if (res?.success) { setMetricas(res as Metricas); setUltimaActualizacion(new Date()); }
    else if (res?.mensaje) { await sbMkt.auth.signOut(); setSession(false); }
  }, []);

  // Auto-refresco cada 5 min (no en vivo, no Realtime) + el botón
  // "Actualizar" de cada pantalla sigue sirviendo para forzar un refresco
  // antes de esos 5 min. Pausado con la pestaña en segundo plano, igual
  // que el resto del panel — cero invocaciones extra mientras nadie mira.
  useEffect(() => {
    if (!session) return;
    cargarMetricas();
    let intervalo: ReturnType<typeof setInterval> | null = null;
    const iniciar = () => { intervalo = setInterval(cargarMetricas, 5 * 60_000); };
    const detener = () => { if (intervalo) clearInterval(intervalo); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") { cargarMetricas(); iniciar(); } else detener();
    };
    iniciar();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { detener(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [session, cargarMetricas]);

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const { error } = await sbMkt.auth.signInWithPassword({ email: EMAIL_MKT_COMPARTIDO, password: pass });
    if (error) setLoginError("Contraseña incorrecta.");
    setPass("");
  }

  if (session === null) return null;

  if (!session) {
    return (
      <div className="mkt-app login-screen">
        <form onSubmit={login} className="login-card">
          <p className="eyebrow">Fiberlux ISP</p>
          <h1>Panel de Marketing</h1>
          <label>
            Contraseña
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="full" style={{ marginTop: 6, height: 46, border: "1px solid var(--mkt-line)", borderRadius: 12, padding: "0 13px", width: "100%" }} />
          </label>
          {loginError && <p style={{ color: "var(--mkt-danger)", fontSize: 11, marginTop: 8 }}>{loginError}</p>}
          <button className="button button-primary full" style={{ marginTop: 16 }}>Acceder al dashboard</button>
        </form>
      </div>
    );
  }

  return (
    <div className="mkt-app">
      <div className="app-shell">
        <Sidebar view={view} setView={setView} open={menuOpen} close={() => setMenuOpen(false)} aptos={metricas?.aptos ?? 0} onLogout={() => sbMkt.auth.signOut()} />
        <main className="main">
          <Topbar view={view} onMenu={() => setMenuOpen(true)} />
          <div className="content">
            {view === "resumen" && <Overview metricas={metricas} cargando={cargandoMetricas} recargar={cargarMetricas} goTo={setView} ultimaActualizacion={ultimaActualizacion} />}
            {view === "asistentes" && <Attendees />}
            {view === "stands" && <Stands />}
            {view === "ranking" && <Ranking metricas={metricas} cargando={cargandoMetricas} recargar={cargarMetricas} />}
            {view === "sorteo" && <Sorteo aptos={metricas?.aptos ?? 0} />}
            {view === "configuracion" && <Configuracion />}
          </div>
        </main>
      </div>
    </div>
  );
}
