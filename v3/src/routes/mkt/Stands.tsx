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

  // codigo_sponsor es una columna nullable que solo se llena a mano en
  // el seed — un stand agregado después, o cuya fila nunca trajo ese
  // valor, puede terminar con panel_sponsor=true pero codigo_sponsor
  // vacío: el toggle se ve prendido pero resolver_stand/obtener_panel_sponsor
  // nunca exponen un link funcional (a propósito, por seguridad). Se
  // autogenera acá mismo, una sola vez, si hace falta.
  function generarCodigoSponsor(nombre: string): string {
    const slug = nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "").slice(0, 8);
    const sufijo = Math.random().toString(36).slice(2, 6);
    return `spn-${slug}-${sufijo}`;
  }

  async function actualizar(id: string, campo: "panel_sponsor" | "activo", valor: boolean) {
    const stand = stands.find((s) => s.id === id);
    const payload: Partial<StandRow> = { [campo]: valor };
    if (campo === "panel_sponsor" && valor && stand && !stand.codigo_sponsor) {
      payload.codigo_sponsor = generarCodigoSponsor(stand.nombre);
    }
    setStands((prev) => prev.map((s) => (s.id === id ? { ...s, ...payload } : s)));
    const { error } = await sbMkt.from("stands").update(payload).eq("id", id);
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
          // Un solo link por stand, no dos — para Diamante es el del
          // escáner (que ya trae su propio botón "Ver Panel Sponsor" si
          // lo tiene activo); para Oro/Complementario sin escaneo, el
          // único link útil es el del panel directamente, si lo tienen.
          const esDiamante = stand.tier === "diamante";
          const linkPrincipal = esDiamante || !stand.panel_sponsor || !linkSponsor ? linkStand : linkSponsor;
          const etiquetaLink = linkPrincipal === linkSponsor ? "Panel sponsor" : "Link del stand";
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
                  <span>{etiquetaLink}</span>
                  <p className="mono">{linkPrincipal}</p>
                  <button onClick={() => copiar(linkPrincipal)}>{copiado === linkPrincipal ? <Check size={15} /> : <Copy size={15} />}</button>
                </div>
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
