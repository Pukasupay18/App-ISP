import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { sbPublic } from "../lib/supabaseClient";

type PanelSponsor = {
  nombre: string;
  visitasHoy: number;
  totalVisitas: number;
  ultimosVisitantes: { nombre: string; empresa: string; nota: string | null; visitedAt: string }[];
};

export default function Sponsor() {
  const { codigo } = useParams<{ codigo: string }>();
  const [panel, setPanel] = useState<PanelSponsor | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!codigo) return;
    const { data: res, error: err } = await sbPublic.rpc("obtener_panel_sponsor", { p_codigo_sponsor: codigo });
    if (err) { setError("Error de conexión."); return; }
    if (!res.success) { setError(res.mensaje); return; }
    setPanel(res as PanelSponsor);
  }, [codigo]);

  // Snapshot cacheado, no en vivo: refresco cada 90s, solo con la
  // pestaña visible — son pocos dispositivos pero igual se evita
  // Realtime (regla de arquitectura del brief).
  useEffect(() => {
    cargar();
    let intervalo: ReturnType<typeof setInterval> | null = null;
    const iniciar = () => { intervalo = setInterval(cargar, 90_000); };
    const detener = () => { if (intervalo) clearInterval(intervalo); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") { cargar(); iniciar(); } else detener();
    };
    iniciar();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { detener(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [cargar]);

  if (error) return <div className="flex min-h-screen items-center justify-center px-6 text-center text-danger">{error}</div>;
  if (!panel) return <div className="flex min-h-screen items-center justify-center text-gray">Cargando…</div>;

  return (
    <div className="mx-auto max-w-[680px] px-4 py-5">
      <h1 className="mb-4 text-lg font-bold">Panel Sponsor — {panel.nombre}</h1>

      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Visitas hoy" valor={panel.visitasHoy} />
        <Kpi label="Visitas totales" valor={panel.totalVisitas} />
      </div>

      <div className="mt-5 rounded-content bg-card p-5 shadow">
        <h2 className="mb-3 text-sm font-bold">Últimos visitantes</h2>
        <div className="divide-y divide-gray-line">
          {panel.ultimosVisitantes.map((v, i) => (
            <div key={i} className="py-2 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold">{v.nombre}</span>
                <span className="font-mono text-xs text-gray">{new Date(v.visitedAt).toLocaleTimeString("es-PE")}</span>
              </div>
              <p className="text-xs text-gray">{v.empresa}</p>
              {v.nota && <p className="mt-1 text-xs italic text-purple">"{v.nota}"</p>}
            </div>
          ))}
          {panel.ultimosVisitantes.length === 0 && <p className="py-2 text-sm text-gray">Sin visitas todavía.</p>}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, valor }: { label: string; valor: string | number }) {
  return (
    <div className="rounded-content bg-card p-4 text-center shadow">
      <p className="font-mono text-2xl font-bold">{valor}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray">{label}</p>
    </div>
  );
}
