import { RefreshButton, SectionTitle, TierBadge, minutosDesde } from "./shared";
import type { Metricas } from "./types";

export default function Ranking({
  metricas, cargando, recargar,
}: { metricas: Metricas | null; cargando: boolean; recargar: () => void }) {
  if (!metricas) return <div className="empty-state">Cargando…</div>;

  const ordenado = [...metricas.ranking].sort((a, b) => b.visitas - a.visitas);
  const max = ordenado[0]?.visitas || 1;
  const totalVisitas = ordenado.reduce((acc, s) => acc + s.visitas, 0);
  const promedio = ordenado.length > 0 ? Math.round(totalVisitas / ordenado.length) : 0;
  const fechasVisita = ordenado.map((s) => s.ultimaVisita).filter((v): v is string => !!v).sort();
  const ultima = fechasVisita[fechasVisita.length - 1];

  return (
    <div className="screen">
      <SectionTitle
        title="Ranking de stands"
        subtitle="Rendimiento por cantidad de visitas registradas — uso interno, nunca se expone al público."
        action={<RefreshButton cargando={cargando} onClick={recargar} />}
      />

      <div className="ranking-summary">
        <div><span>Total de visitas</span><strong className="mono">{totalVisitas}</strong></div>
        <div><span>Promedio por stand</span><strong className="mono">{promedio}</strong></div>
        <div>
          <span>Última visita</span>
          <strong className="mono small-time">{ultima ? `${minutosDesde(ultima)} min` : "—"}</strong>
        </div>
      </div>

      <article className="card ranking-card">
        <div className="ranking-header">
          <span>Posición y stand</span><span>Rendimiento</span><span>Visitas</span>
        </div>
        {ordenado.map((s, i) => (
          <div className={`ranking-row ${i < 3 ? "podium" : ""}`} key={s.nombre}>
            <div className="ranking-identity">
              <span className={`rank rank-${i + 1}`}>{i + 1}</span>
              <div className="stand-logo">{s.nombre.slice(0, 2).toUpperCase()}</div>
              <div><strong>{s.nombre}</strong><TierBadge tier={s.tier} /></div>
            </div>
            <div className="ranking-progress"><span style={{ width: `${(s.visitas / max) * 100}%` }} /></div>
            <div className="ranking-value"><strong className="mono">{s.visitas}</strong><span>visitas</span></div>
          </div>
        ))}
      </article>
    </div>
  );
}
