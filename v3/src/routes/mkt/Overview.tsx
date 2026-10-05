import type { CSSProperties } from "react";
import { ChevronRight, Gift, RefreshCw, Store, UserCheck, Users } from "lucide-react";
import { MetricCard, minutosDesde, SectionTitle } from "./shared";
import type { Metricas, View } from "./types";

export default function Overview({
  metricas, cargando, recargar, goTo,
}: { metricas: Metricas | null; cargando: boolean; recargar: () => void; goTo: (v: View) => void }) {
  if (!metricas) return <div className="empty-state">{cargando ? "Cargando…" : "Sin datos."}</div>;

  const pendientes = metricas.total - metricas.ingresados;
  const pct = metricas.total > 0 ? Math.round((metricas.ingresados / metricas.total) * 100) : 0;
  const totalVisitas = metricas.ranking.reduce((acc, s) => acc + s.visitas, 0);
  const top4 = [...metricas.ranking].sort((a, b) => b.visitas - a.visitas).slice(0, 4);
  const maxVisitas = top4[0]?.visitas || 1;
  const obsoletos = metricas.ranking.filter((s) => !s.ultimaVisita || minutosDesde(s.ultimaVisita) > 30);

  return (
    <div className="screen">
      <div className="welcome">
        <div>
          <p>Panel de marketing</p>
          <h2>Resumen del evento</h2>
          <span>Registro {metricas.registroAbierto ? "abierto" : "cerrado"} · Sorteo {metricas.sorteoAbierto ? "abierto" : "cerrado"}</span>
        </div>
        <button className="icon-button" onClick={recargar} aria-label="Actualizar">
          <RefreshCw size={17} />
        </button>
      </div>

      <div className="metrics-grid">
        <MetricCard label="Registrados" value={metricas.total} note="total inscritos" icon={Users} />
        <MetricCard label="Ingresaron" value={metricas.ingresados} note={`${pct}% de asistencia`} icon={UserCheck} tone="green" />
        <MetricCard label="Visitas a stands" value={totalVisitas} note={`en ${metricas.ranking.length} stands`} icon={Store} tone="blue" />
        <MetricCard label="Aptos para sorteo" value={metricas.aptos} note={`con ${metricas.umbralBoletos}+ boletos`} icon={Gift} tone="amber" />
      </div>

      <div className="overview-grid">
        <article className="card quick-status">
          <SectionTitle title="Estado del evento" />
          <div className="status-ring-wrap">
            <div className="status-ring" style={{ "--mkt-pct": `${pct}%` } as CSSProperties}>
              <div>
                <strong className="mono">{pct}%</strong>
                <span>asistencia</span>
              </div>
            </div>
            <div className="status-legend">
              <p><i className="dot purple" /><span>Ingresaron</span><strong className="mono">{metricas.ingresados}</strong></p>
              <p><i className="dot pale" /><span>Pendientes</span><strong className="mono">{pendientes}</strong></p>
            </div>
          </div>
        </article>
        <article className="card top-stands">
          <SectionTitle
            title="Stands más visitados"
            subtitle="Ranking en vivo"
            action={<button className="text-action" onClick={() => goTo("ranking")}>Ver ranking <ChevronRight size={15} /></button>}
          />
          <div className="stand-list">
            {top4.map((s, i) => (
              <div className="stand-row" key={s.nombre}>
                <span className={`rank rank-${i + 1}`}>{i + 1}</span>
                <div className="stand-logo">{s.nombre.slice(0, 2).toUpperCase()}</div>
                <div className="stand-name"><strong>{s.nombre}</strong><span>{s.tier}</span></div>
                <div className="mini-progress"><span style={{ width: `${(s.visitas / maxVisitas) * 100}%` }} /></div>
                <strong className="mono">{s.visitas}</strong>
              </div>
            ))}
            {top4.length === 0 && <p className="empty-state">Sin visitas todavía.</p>}
          </div>
        </article>
      </div>

      {obsoletos.length > 0 && (
        <article className="card" style={{ padding: 18 }}>
          <SectionTitle title="Stands sin actividad reciente" subtitle="Más de 30 minutos sin escaneos" />
          <div style={{ marginTop: 12 }}>
            {obsoletos.map((s) => (
              <div key={s.nombre} className="stale-row">
                <span>{s.nombre}</span>
                <span className="mono">{s.ultimaVisita ? `${minutosDesde(s.ultimaVisita)} min` : "sin escaneos"}</span>
              </div>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}
