import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, Check, ChevronRight, Edit3, Plus, RefreshCw, Search, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { sbMkt } from "../../lib/supabaseClient";
import { Button, SectionTitle } from "./shared";
import type { Asistente } from "./types";

export default function Attendees() {
  const [asistentes, setAsistentes] = useState<Asistente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<Asistente | "new" | null>(null);
  const [guardado, setGuardado] = useState<{ id: string; nombre: string; empresa: string } | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const { data: res } = await sbMkt.rpc("obtener_lista_asistentes_mkt");
    setCargando(false);
    if (res?.success) setAsistentes(res.asistentes as Asistente[]);
  }

  useEffect(() => {
    cargar();
    try { setAutoPrint(localStorage.getItem("mkt-auto-print") === "true"); } catch { /* noop */ }
  }, []);

  function togglePrint() {
    const next = !autoPrint;
    setAutoPrint(next);
    try { localStorage.setItem("mkt-auto-print", String(next)); } catch { /* noop */ }
  }

  const filtrados = useMemo(() => {
    const q = query.toLowerCase();
    return asistentes.filter((a) => `${a.nombre} ${a.email} ${a.empresa}`.toLowerCase().includes(q));
  }, [asistentes, query]);

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorForm(null);
    setGuardando(true);
    const form = new FormData(e.currentTarget);
    const editId = modal !== "new" && modal ? modal.id : "";
    const { data: res } = await sbMkt.rpc("registro_manual", {
      p_mode: editId ? "actualizar" : "crear",
      p_id: editId,
      p_nombre_completo: form.get("nombre") as string,
      p_email: form.get("email") as string,
      p_celular: form.get("celular") as string,
      p_empresa: form.get("empresa") as string,
      p_ruc: form.get("ruc") as string,
    });
    setGuardando(false);
    if (!res?.success) { setErrorForm(res?.mensaje ?? "Error de conexión."); return; }
    setGuardado({
      id: editId || res.id,
      nombre: (form.get("nombre") as string) || (modal !== "new" && modal ? modal.nombre : ""),
      empresa: (form.get("empresa") as string) || "---",
    });
    cargar();
    if (autoPrint) setTimeout(() => window.print(), 300);
  }

  function cerrarModal() { setModal(null); setGuardado(null); setErrorForm(null); }

  return (
    <div className="screen">
      <SectionTitle
        title="Gestión de asistentes"
        subtitle="Busca, registra o actualiza la información de los invitados."
        action={<Button onClick={() => setModal("new")}><Plus size={18} /> Registro manual</Button>}
      />

      <div className="toolbar card">
        <label className="search-box">
          <Search size={19} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, email o empresa" />
          {query && <button onClick={() => setQuery("")}><X size={16} /></button>}
        </label>
        <Button variant="secondary" onClick={cargar}><RefreshCw size={17} /></Button>
      </div>

      <div className="results-heading">
        <p><strong className="mono">{filtrados.length}</strong> asistentes encontrados</p>
        <span><i /> Ingresó al evento</span>
      </div>

      <div className="attendee-list">
        {filtrados.map((persona) => (
          <article className="attendee-card card" key={persona.id}>
            <div className={`person-avatar ${persona.ingresado ? "checked" : ""}`}>
              {persona.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              {persona.ingresado && <Check size={11} />}
            </div>
            <div className="person-main">
              <strong>{persona.nombre}</strong>
              <span>{persona.email}</span>
              <small><Building2 size={13} /> {persona.empresa}</small>
            </div>
            <div className="person-meta">
              <span>Boletos</span>
              <strong className="mono">{persona.boletosTotal}</strong>
            </div>
            <div className="person-meta entered">
              <span>Estado</span>
              <strong>{persona.ingresado ? "Ingresó" : "Pendiente"}</strong>
            </div>
            <button className="icon-button edit" onClick={() => setModal(persona)} aria-label={`Editar a ${persona.nombre}`}>
              <Edit3 size={17} />
            </button>
          </article>
        ))}
        {!cargando && filtrados.length === 0 && <p className="empty-state">Sin resultados.</p>}
      </div>

      {modal && (
        <div className="modal-layer">
          <button className="modal-backdrop" onClick={cerrarModal} aria-label="Cerrar" />
          <aside className="drawer">
            <div className="drawer-head">
              <div>
                <p className="eyebrow">{guardado ? "Etiqueta lista" : modal === "new" ? "Nuevo asistente" : "Editar asistente"}</p>
                <h2>{guardado ? "Registro completado" : "Registro manual"}</h2>
              </div>
              <button className="icon-button" onClick={cerrarModal}><X size={20} /></button>
            </div>

            {!guardado ? (
              <form className="form" onSubmit={guardar}>
                <label>
                  Nombre completo
                  <input name="nombre" defaultValue={modal === "new" ? "" : modal.nombre} placeholder="Ej. María Fernanda López" required />
                </label>
                <label>
                  Email
                  <input name="email" type="email" defaultValue={modal === "new" ? "" : modal.email} placeholder="nombre@empresa.com" />
                </label>
                <label>
                  Celular
                  <input name="celular" defaultValue={modal === "new" ? "" : modal.celular} placeholder="+51 999 999 999" />
                </label>
                <label>
                  RUC
                  <input name="ruc" defaultValue={modal === "new" ? "" : modal.ruc} placeholder="20123456789" />
                  {/* Autocompletado de empresa por RUC: pendiente — falta portar
                      buscar-empresa-por-ruc de V2 a este proyecto. */}
                </label>
                <label>
                  Empresa
                  <input name="empresa" defaultValue={modal === "new" ? "" : modal.empresa} placeholder="Nombre de la empresa" />
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={autoPrint} onChange={togglePrint} />
                  <span>
                    <strong>Imprimir automáticamente al guardar</strong>
                    <small>Usa el diálogo de impresión del navegador</small>
                  </span>
                </label>
                {errorForm && <p style={{ color: "var(--mkt-danger)", fontSize: 11 }}>{errorForm}</p>}
                <Button type="submit" className="full" disabled={guardando}>
                  {guardando ? "Guardando…" : modal === "new" ? "Guardar y generar etiqueta" : "Actualizar asistente"} <ChevronRight size={18} />
                </Button>
              </form>
            ) : (
              <div className="label-preview">
                <div className="success-badge"><Check size={20} /></div>
                <p>El asistente fue guardado correctamente.</p>
                <div className="print-label">
                  <QRCodeSVG value={guardado.id} size={88} level="L" />
                  <div>
                    <strong>{guardado.nombre}</strong>
                    <span>{guardado.empresa}</span>
                    <small className="mono">ID {guardado.id}</small>
                  </div>
                </div>
                <Button className="full" onClick={() => window.print()}>Imprimir etiqueta</Button>
                <Button variant="ghost" className="full" onClick={cerrarModal}>Volver a la lista</Button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
