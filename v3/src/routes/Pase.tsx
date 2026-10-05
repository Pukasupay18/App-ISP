import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { sbPublic } from "../lib/supabaseClient";

type PaseData = {
  nombre: string;
  empresa: string;
  boletosTotal: number;
  umbralBoletos: number;
  aptoSorteo: boolean;
  participaSorteo: boolean;
  sorteoAbierto: boolean;
  stands: { nombre: string; visitado: boolean }[];
  boletosExtraHechos: string[];
};

const ACCIONES_BOLETO: { tipo: string; label: string }[] = [
  { tipo: "red_social", label: "Seguir redes sociales" },
  { tipo: "canal", label: "Unirse al canal de difusión" },
  { tipo: "resena", label: "Dejar una reseña" },
];

export default function Pase() {
  const { codigo } = useParams<{ codigo: string }>();
  const [data, setData] = useState<PaseData | null>(null);
  const [aptosEnVivo, setAptosEnVivo] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarPase = useCallback(async () => {
    if (!codigo) return;
    const { data: res, error: err } = await sbPublic.rpc("obtener_pase", { p_id: codigo });
    setCargando(false);
    if (err) { setError("Error de conexión. Intenta de nuevo."); return; }
    if (!res.success) { setError(res.mensaje); return; }
    setData(res as PaseData);
  }, [codigo]);

  // Snapshot público (aptos al sorteo en vivo) — misma fuente que el KPI
  // de Mkt, cacheado, refrescado cada 60s y SOLO con la pestaña visible.
  const cargarSnapshot = useCallback(async () => {
    const { data: res } = await sbPublic.rpc("obtener_snapshot_publico");
    if (res?.success) setAptosEnVivo(res.aptosSorteo);
  }, []);

  useEffect(() => {
    cargarPase();
    cargarSnapshot();
    let intervalo: ReturnType<typeof setInterval> | null = null;
    const iniciar = () => { intervalo = setInterval(cargarSnapshot, 60_000); };
    const detener = () => { if (intervalo) clearInterval(intervalo); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") { cargarSnapshot(); iniciar(); }
      else detener();
    };
    iniciar();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { detener(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [cargarPase, cargarSnapshot]);

  async function registrarBoleto(tipo: string) {
    if (!codigo) return;
    const { data: res } = await sbPublic.rpc("registrar_boleto_extra", { p_id: codigo, p_tipo: tipo });
    if (res?.success) cargarPase();
  }

  async function participar() {
    if (!codigo) return;
    const { data: res } = await sbPublic.rpc("participar_sorteo", { p_id: codigo });
    if (res) { setError(res.success ? null : res.mensaje); if (res.success) cargarPase(); }
  }

  if (cargando) return <CentroMensaje>Cargando tu pase…</CentroMensaje>;
  if (error && !data) return <CentroMensaje tono="danger">{error}</CentroMensaje>;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-[480px] px-4 py-5">
      <div className="rounded-media bg-gradient-to-br from-purple-deep to-purple-dark p-5 text-white shadow">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">Credencial verificada</p>
        <h1 className="mt-1 text-xl font-bold">{data.nombre}</h1>
        <p className="text-sm text-white/80">{data.empresa}</p>
      </div>

      {aptosEnVivo !== null && (
        <div className="mt-4 rounded-banner bg-purple/10 px-4 py-3 text-sm font-semibold text-purple">
          🔥 Ya califican al sorteo <span className="font-mono">{aptosEnVivo}</span> personas
        </div>
      )}

      <div className="mt-4 rounded-content bg-card p-5 text-center shadow">
        <p className="font-mono text-3xl font-bold">{data.boletosTotal}/{data.umbralBoletos}</p>
        <p className="text-[11px] uppercase tracking-wide text-gray">boletos acumulados</p>
        {data.aptoSorteo ? (
          <p className="mt-3 rounded-banner bg-success-tint px-3 py-2 text-sm font-semibold text-success">
            ¡Apto para el sorteo!
          </p>
        ) : (
          <p className="mt-3 rounded-banner bg-gray-line/50 px-3 py-2 text-sm text-gray">
            Te faltan {Math.max(0, data.umbralBoletos - data.boletosTotal)} boletos para calificar
          </p>
        )}
      </div>

      {data.sorteoAbierto && (
        <div className="mt-4 rounded-content bg-card p-5 text-center shadow">
          {data.participaSorteo ? (
            <p className="font-semibold text-success">✅ Ya estás participando del sorteo</p>
          ) : (
            <button
              onClick={participar}
              className="h-[52px] w-full rounded-[29px] bg-gradient-to-br from-purple to-purple-dark font-semibold text-white shadow"
            >
              Participar en el sorteo
            </button>
          )}
        </div>
      )}

      <div className="mt-4 rounded-content bg-card p-5 shadow">
        <h2 className="mb-3 text-sm font-bold">Suma boletos</h2>
        <div className="space-y-2">
          {ACCIONES_BOLETO.map((a) => {
            const hecho = data.boletosExtraHechos.includes(a.tipo);
            return (
              <button
                key={a.tipo}
                disabled={hecho}
                onClick={() => registrarBoleto(a.tipo)}
                className="flex w-full items-center justify-between rounded-input border border-gray-line px-4 py-3 text-left text-sm disabled:opacity-50"
              >
                <span>{a.label}</span>
                <span>{hecho ? "✅" : "+1"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-content bg-card p-5 shadow">
        <h2 className="mb-3 text-sm font-bold">Recorrido por stands</h2>
        <div className="divide-y divide-gray-line">
          {data.stands.map((s) => (
            <div key={s.nombre} className="flex items-center justify-between py-2 text-sm">
              <span>{s.nombre}</span>
              <span className={s.visitado ? "text-success" : "text-text-faint"}>
                {s.visitado ? "Completado" : "Pendiente"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CentroMensaje({ children, tono }: { children: ReactNode; tono?: "danger" }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className={tono === "danger" ? "text-danger" : "text-gray"}>{children}</p>
    </div>
  );
}
