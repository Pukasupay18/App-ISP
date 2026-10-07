import { useEffect, useState } from "react";
import { Calendar, Check, ExternalLink, Plus, Settings, Trash2 } from "lucide-react";
import { sbMkt } from "../../lib/supabaseClient";
import { Button, SectionTitle, Toggle } from "./shared";
import type { CronogramaRow, EventConfig } from "./types";

export default function Configuracion() {
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const [cronograma, setCronograma] = useState<CronogramaRow[] | null>(null);
  const [guardandoCrono, setGuardandoCrono] = useState(false);
  const [guardadoCrono, setGuardadoCrono] = useState(false);
  const [borrarIds, setBorrarIds] = useState<number[]>([]);

  useEffect(() => {
    sbMkt.from("event_config").select("*").eq("id", 1).single().then(({ data }) => {
      if (data) setConfig(data as EventConfig);
    });
    sbMkt.from("cronograma").select("*").order("orden").then(({ data }) => {
      setCronograma((data as CronogramaRow[]) ?? []);
    });
  }, []);

  function editarFila(id: number, campo: "hora" | "actividad" | "expositor", valor: string) {
    setCronograma((prev) => prev?.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)) ?? null);
  }

  function agregarFila() {
    const siguienteOrden = (cronograma?.length ?? 0) + 1;
    const idTemporal = -Date.now(); // negativo = todavía no existe en la base
    setCronograma((prev) => [...(prev ?? []), { id: idTemporal, hora: "", actividad: "", expositor: "", orden: siguienteOrden }]);
  }

  function quitarFila(id: number) {
    setCronograma((prev) => prev?.filter((f) => f.id !== id) ?? null);
    if (id > 0) setBorrarIds((prev) => [...prev, id]);
  }

  async function guardarCronograma() {
    if (!cronograma) return;
    setGuardandoCrono(true);

    if (borrarIds.length > 0) {
      await sbMkt.from("cronograma").delete().in("id", borrarIds);
    }

    const existentes = cronograma.filter((f) => f.id > 0).map((f, i) => ({ ...f, orden: i + 1 }));
    const nuevas = cronograma.filter((f) => f.id < 0).map((f, i) => ({
      hora: f.hora, actividad: f.actividad, expositor: f.expositor || null, orden: existentes.length + i + 1,
    }));

    let fallo = false;
    if (existentes.length > 0) {
      const { error } = await sbMkt.from("cronograma").upsert(existentes.map((f) => ({ ...f, expositor: f.expositor || null })));
      if (error) fallo = true;
    }
    if (!fallo && nuevas.length > 0) {
      const { error } = await sbMkt.from("cronograma").insert(nuevas);
      if (error) fallo = true;
    }

    setGuardandoCrono(false);
    setBorrarIds([]);
    if (!fallo) {
      const { data } = await sbMkt.from("cronograma").select("*").order("orden");
      setCronograma((data as CronogramaRow[]) ?? []);
      setGuardadoCrono(true);
      setTimeout(() => setGuardadoCrono(false), 2500);
    }
  }

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
              <Toggle
                checked={config.sorteo_abierto}
                onChange={() => setConfig({ ...config, sorteo_abierto: !config.sorteo_abierto })}
                label="Sorteo abierto"
              />
            </div>
          </div>

          <label className="wide-label">
            <span>Umbral de puntos para el sorteo</span>
            <small>Cantidad mínima de puntos para calificar como apto.</small>
            <div className="number-input">
              <input
                type="number"
                min={1}
                value={config.umbral_boletos}
                onChange={(e) => setConfig({ ...config, umbral_boletos: Number(e.target.value) })}
              />
              <span>puntos</span>
            </div>
          </label>
        </div>

        <div className="config-section">
          <div className="config-section-title">
            <div className="config-icon"><ExternalLink size={20} /></div>
            <div>
              <h2>Recursos externos</h2>
              <p>Enlace de referencia para el equipo organizador — no se sincroniza solo, el cronograma se edita abajo.</p>
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

      <article className="card config-card">
        <div className="config-section">
          <div className="config-section-title">
            <div className="config-icon"><Calendar size={20} /></div>
            <div>
              <h2>Cronograma</h2>
              <p>Lo que ve el asistente en su pase. El orden de las filas es el orden en que se muestran.</p>
            </div>
          </div>

          <div className="crono-editor">
            {cronograma?.map((fila) => (
              <div className="crono-row" key={fila.id}>
                <input
                  className="crono-hora"
                  value={fila.hora}
                  onChange={(e) => editarFila(fila.id, "hora", e.target.value)}
                  placeholder="09:30 - 10:00"
                />
                <input
                  className="crono-actividad"
                  value={fila.actividad}
                  onChange={(e) => editarFila(fila.id, "actividad", e.target.value)}
                  placeholder="Actividad"
                />
                <input
                  className="crono-expositor"
                  value={fila.expositor ?? ""}
                  onChange={(e) => editarFila(fila.id, "expositor", e.target.value)}
                  placeholder="Expositor (opcional)"
                />
                <button type="button" className="icon-button" onClick={() => quitarFila(fila.id)} aria-label="Quitar fila">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {cronograma?.length === 0 && <p className="empty-state">Sin filas todavía.</p>}
          </div>

          <Button variant="secondary" onClick={agregarFila}><Plus size={16} /> Agregar fila</Button>
        </div>

        <div className="config-footer">
          <span>{guardadoCrono && <><Check size={16} /> Cronograma guardado</>}</span>
          <Button onClick={guardarCronograma} disabled={guardandoCrono}>{guardandoCrono ? "Guardando…" : "Guardar cronograma"}</Button>
        </div>
      </article>
    </div>
  );
}
