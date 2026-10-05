import { useEffect, useState } from "react";
import { sbMkt } from "../lib/supabaseClient";

// ⚠️ Pendiente de tu lado: crea este usuario en Supabase Auth (Dashboard
// → Authentication → Users → Add user) y agrégalo a `admin_users` (ver
// schema.sql) — todavía no existe ninguna cuenta de staff Mkt en el
// proyecto real. Cambia este email por el que decidas usar.
const EMAIL_MKT_COMPARTIDO = "hola@fiberlux.pe";

type Metricas = {
  total: number;
  ingresados: number;
  aptos: number;
  umbralBoletos: number;
  registroAbierto: boolean;
  sorteoAbierto: boolean;
  ranking: { nombre: string; tier: string; panelSponsor: boolean; visitas: number; ultimaVisita: string | null }[];
};

const PESTANAS = ["Resumen", "Asistentes", "Stands", "Ranking", "Sorteo", "Configuración"] as const;

export default function Mkt() {
  const [session, setSession] = useState<boolean | null>(null);
  const [pass, setPass] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]>("Resumen");
  const [metricas, setMetricas] = useState<Metricas | null>(null);

  useEffect(() => {
    sbMkt.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = sbMkt.auth.onAuthStateChange((_evt, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) cargarMetricas();
  }, [session]);

  async function cargarMetricas() {
    const { data: res } = await sbMkt.rpc("obtener_metricas_mkt");
    if (res?.success) setMetricas(res as Metricas);
    else if (res?.mensaje) { await sbMkt.auth.signOut(); setSession(false); }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    const { error } = await sbMkt.auth.signInWithPassword({ email: EMAIL_MKT_COMPARTIDO, password: pass });
    if (error) setLoginError("Contraseña incorrecta.");
    setPass("");
  }

  if (session === null) return null;

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <form onSubmit={login} className="w-full max-w-sm rounded-content bg-card p-6 shadow">
          <h1 className="mb-4 text-lg font-bold">Panel Marketing</h1>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Contraseña"
            className="w-full rounded-input border border-gray-line px-3 py-3 text-sm"
          />
          {loginError && <p className="mt-2 text-sm text-danger">{loginError}</p>}
          <button className="mt-4 h-12 w-full rounded-[29px] bg-gradient-to-br from-purple to-purple-dark text-sm font-semibold text-white">
            Acceder al dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Panel Marketing</h1>
        <button onClick={() => sbMkt.auth.signOut()} className="text-sm text-gray">Cerrar sesión</button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {PESTANAS.map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            className={`whitespace-nowrap rounded-[29px] px-4 py-2 text-sm font-semibold ${
              pestana === p ? "bg-purple text-white" : "bg-card text-ink"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {pestana === "Resumen" && metricas && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Inscritos" valor={metricas.total} />
            <Kpi label="Ingresados" valor={metricas.ingresados} />
            <Kpi label={`Aptos (≥${metricas.umbralBoletos})`} valor={metricas.aptos} />
            <Kpi label="Registro" valor={metricas.registroAbierto ? "Abierto" : "Cerrado"} />
          </div>

          <div className="mt-5 rounded-content bg-card p-5 shadow">
            <h2 className="mb-3 text-sm font-bold">Stands sin actividad reciente</h2>
            <div className="space-y-2">
              {metricas.ranking
                .filter((s) => !s.ultimaVisita || minutosDesde(s.ultimaVisita) > 30)
                .map((s) => (
                  <div key={s.nombre} className="flex items-center justify-between rounded-banner bg-warning-tint px-3 py-2 text-sm">
                    <span>{s.nombre}</span>
                    <span className="text-warning">
                      {s.ultimaVisita ? `${minutosDesde(s.ultimaVisita)} min sin escaneos` : "Sin escaneos aún"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {pestana !== "Resumen" && (
        <div className="rounded-content bg-card p-8 text-center text-gray shadow">
          <p className="font-semibold">{pestana} — próximamente</p>
          <p className="mt-1 text-sm">Esta pestaña todavía no está construida.</p>
        </div>
      )}
    </div>
  );
}

function minutosDesde(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
}

function Kpi({ label, valor }: { label: string; valor: string | number }) {
  return (
    <div className="rounded-content bg-card p-4 text-center shadow">
      <p className="font-mono text-2xl font-bold">{valor}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray">{label}</p>
    </div>
  );
}
