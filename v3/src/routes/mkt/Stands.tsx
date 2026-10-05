import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { sbMkt } from "../../lib/supabaseClient";
import { RefreshButton, SectionTitle, Toggle, TierBadge } from "./shared";
import type { StandRow } from "./types";

export default function Stands() {
  const [stands, setStands] = useState<StandRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const { data } = await sbMkt.from("stands").select("*").order("orden");
    setCargando(false);
    if (data) setStands(data as StandRow[]);
  }

  useEffect(() => { cargar(); }, []);

  async function actualizar(id: string, campo: "panel_sponsor" | "activo", valor: boolean) {
    setStands((prev) => prev.map((s) => (s.id === id ? { ...s, [campo]: valor } : s)));
    const { error } = await sbMkt.from("stands").update({ [campo]: valor }).eq("id", id);
    if (error) cargar(); // revierte el optimismo si falló
  }

  function copiar(valor: string) {
    navigator.clipboard?.writeText(`${window.location.origin}/#${valor}`);
    setCopiado(valor);
    setTimeout(() => setCopiado(null), 1500);
  }

  const activos = stands.filter((s) => s.activo).length;
  const conPanel = stands.filter((s) => s.panel_sponsor).length;

  return (
    <div className="screen">
      <SectionTitle
        title="Stands del evento"
        subtitle="Administra la visibilidad y accesos de los espacios participantes."
        action={<RefreshButton cargando={cargando} onClick={cargar} />}
      />

      <div className="inline-stats">
        <span><strong className="mono">{stands.length}</strong> stands</span>
        <i />
        <span><strong className="mono">{activos}</strong> activos</span>
        <i />
        <span><strong className="mono">{conPanel}</strong> con panel sponsor</span>
      </div>

      <div className="stands-grid">
        {stands.map((stand) => {
          const linkStand = `/stand/${stand.codigo}`;
          const linkSponsor = stand.codigo_sponsor ? `/sponsor/${stand.codigo_sponsor}` : null;
          return (
            <article className={`stand-card card ${!stand.activo ? "disabled" : ""}`} key={stand.id}>
              <div className="stand-card-head">
                <div className="stand-logo large">{stand.nombre.slice(0, 2).toUpperCase()}</div>
                <div>
                  <strong>{stand.nombre}</strong>
                  <TierBadge tier={stand.tier} />
                </div>
              </div>
              <div className="links">
                <div>
                  <span>Link público</span>
                  <p className="mono">{linkStand}</p>
                  <button onClick={() => copiar(linkStand)}>{copiado === linkStand ? <Check size={15} /> : <Copy size={15} />}</button>
                </div>
                {stand.panel_sponsor && linkSponsor && (
                  <div>
                    <span>Panel sponsor</span>
                    <p className="mono">{linkSponsor}</p>
                    <button onClick={() => copiar(linkSponsor)}>{copiado === linkSponsor ? <Check size={15} /> : <Copy size={15} />}</button>
                  </div>
                )}
              </div>
              <div className="stand-controls">
                <div>
                  <span>Panel sponsor <i className="stand-control-hint" title="Habilita el link /sponsor/:codigo con KPIs de la marca (visitas, % de asistentes, últimos visitantes).">?</i></span>
                  <Toggle checked={stand.panel_sponsor} onChange={() => actualizar(stand.id, "panel_sponsor", !stand.panel_sponsor)} label="Panel sponsor" />
                </div>
                <div>
                  <span>Stand activo</span>
                  <Toggle checked={stand.activo} onChange={() => actualizar(stand.id, "activo", !stand.activo)} label="Stand activo" />
                </div>
              </div>
            </article>
          );
        })}
        {!cargando && stands.length === 0 && <p className="empty-state">Sin stands.</p>}
      </div>
    </div>
  );
}
