import { useEffect, useState } from "react";
import { Check, ExternalLink, Settings } from "lucide-react";
import { sbMkt } from "../../lib/supabaseClient";
import { Button, SectionTitle, Toggle } from "./shared";
import type { EventConfig } from "./types";

export default function Configuracion() {
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    sbMkt.from("event_config").select("*").eq("id", 1).single().then(({ data }) => {
      if (data) setConfig(data as EventConfig);
    });
  }, []);

  async function guardar() {
    if (!config) return;
    setGuardando(true);
    const { error } = await sbMkt
      .from("event_config")
      .update({
        registro_abierto: config.registro_abierto,
        sorteo_abierto: config.sorteo_abierto,
        umbral_boletos: config.umbral_boletos,
        cronograma_sheet_url: config.cronograma_sheet_url,
      })
      .eq("id", 1);
    setGuardando(false);
    if (!error) { setGuardado(true); setTimeout(() => setGuardado(false), 2500); }
  }

  if (!config) return <div className="empty-state">Cargando…</div>;

  return (
    <div className="screen config-screen">
      <SectionTitle title="Configuración del evento" subtitle="Administra los parámetros generales y accesos del evento." />
      <article className="card config-card">
        <div className="config-section">
          <div className="config-section-title">
            <div className="config-icon"><Settings size={20} /></div>
            <div>
              <h2>Parámetros generales</h2>
              <p>Estos cambios se aplican de inmediato en la experiencia del evento.</p>
            </div>
          </div>

          <div className="setting-row">
            <div>
              <strong>Registro de asistentes</strong>
              <span>Permite que la sincronización desde el Sheet siga sumando inscritos nuevos.</span>
            </div>
            <div className="setting-control">
              <b className={config.registro_abierto ? "on" : ""}>{config.registro_abierto ? "Abierto" : "Cerrado"}</b>
              <Toggle
                checked={config.registro_abierto}
                onChange={() => setConfig({ ...config, registro_abierto: !config.registro_abierto })}
                label="Registro abierto"
              />
            </div>
          </div>

          <div className="setting-row">
            <div>
              <strong>Ventana del sorteo</strong>
              <span>También se puede prender/apagar desde la pestaña Sorteo.</span>
            </div>
            <div className="setting-control">
              <b className={config.sorteo_abierto ? "on" : ""}>{config.sorteo_abierto ? "Abierto" : "Cerrado"}</b>
              <Toggle
                checked={config.sorteo_abierto}
                onChange={() => setConfig({ ...config, sorteo_abierto: !config.sorteo_abierto })}
                label="Sorteo abierto"
              />
            </div>
          </div>

          <label className="wide-label">
            <span>Umbral de boletos para el sorteo</span>
            <small>Cantidad mínima de boletos para calificar como apto.</small>
            <div className="number-input">
              <input
                type="number"
                min={1}
                value={config.umbral_boletos}
                onChange={(e) => setConfig({ ...config, umbral_boletos: Number(e.target.value) })}
              />
              <span>boletos</span>
            </div>
          </label>
        </div>

        <div className="config-section">
          <div className="config-section-title">
            <div className="config-icon"><ExternalLink size={20} /></div>
            <div>
              <h2>Recursos externos</h2>
              <p>Enlaces de referencia para el equipo organizador (todavía no se usa en el frontend).</p>
            </div>
          </div>
          <label className="wide-label">
            <span>Sheet del cronograma</span>
            <small>Enlace de Google Sheets con el cronograma del evento.</small>
            <div className="url-input">
              <input
                value={config.cronograma_sheet_url ?? ""}
                onChange={(e) => setConfig({ ...config, cronograma_sheet_url: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/..."
              />
              {config.cronograma_sheet_url && (
                <button type="button" onClick={() => window.open(config.cronograma_sheet_url!, "_blank")}>
                  <ExternalLink size={17} />
                </button>
              )}
            </div>
          </label>
        </div>

        <div className="config-footer">
          <span>{guardado && <><Check size={16} /> Cambios guardados</>}</span>
          <Button onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</Button>
        </div>
      </article>
    </div>
  );
}
