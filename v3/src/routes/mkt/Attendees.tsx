import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Building2, Check, ChevronRight, CloudDownload, Edit3, Loader2, Plus, Printer, RefreshCw, Search, UserCheck, X,
} from "lucide-react";
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

  const rucRef = useRef<HTMLInputElement>(null);
  const empresaRef = useRef<HTMLInputElement>(null);
  const [consultandoRuc, setConsultandoRuc] = useState(false);
  const [rucMensaje, setRucMensaje] = useState<string | null>(null);

  const [sincronizando, setSincronizando] = useState(false);
  const [syncMensaje, setSyncMensaje] = useState<string | null>(null);

  // El botón "Actualizar" (ícono) solo vuelve a pedir lo que YA está en
  // Supabase — no toca el Sheet. Este botón sí dispara la Edge Function
  // que lee el Sheet de inscripciones; el cron la corre sola cada 5 min,
  // esto es para cuando alguien no quiere esperar. El cooldown de 30s
  // contra doble clic vive del lado del servidor (event_config.
  // ultima_sincronizacion), así que no hace falta duplicarlo acá.
  async function sincronizarInscripciones() {
    setSincronizando(true);
    setSyncMensaje(null);
    const { data: res, error } = await sbMkt.functions.invoke("sincronizar-inscripciones", { body: {} });
    setSincronizando(false);
    if (error || !res?.success) { setSyncMensaje(res?.mensaje ?? "❌ Error al sincronizar."); return; }
    setSyncMensaje(res.mensaje);
    if (res.nuevos > 0) cargar();
  }

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

  function cerrarModal() { setModal(null); setGuardado(null); setErrorForm(null); setRucMensaje(null); }

  const [marcandoId, setMarcandoId] = useState<string | null>(null);

  // Botón aparte de "Editar": marca el ingreso de alguien que ya estaba
  // en la lista y abre de una vez la vista de imprimir su etiqueta —
  // editar datos ya NO marca asistencia de rebote (antes sí, confundía).
  async function marcarAsistencia(persona: Asistente) {
    setMarcandoId(persona.id);
    const { data: res } = await sbMkt.rpc("marcar_asistencia_mkt", { p_id: persona.id });
    setMarcandoId(null);
    if (!res?.success) return;
    setModal(persona);
    setGuardado({ id: res.id, nombre: res.nombre, empresa: res.empresa });
    cargar();
    if (autoPrint) setTimeout(() => window.print(), 300);
  }

  // Reimprimir no toca el servidor — es solo para cuando alguien que YA
  // ingresó perdió su gafete y necesita una copia nueva de la etiqueta.
  function reimprimirGafete(persona: Asistente) {
    setModal(persona);
    setGuardado({ id: persona.id, nombre: persona.nombre, empresa: persona.empresa || "---" });
  }

  // Botón aparte, nunca automático: si el staff ya tiene el nombre
  // correcto a mano, no hace falta tocarlo. Nivel 1 busca localmente
  // (alguien de este evento ya registrado con ese RUC); nivel 2 consulta
  // SUNAT vía Decolecta, con failover de dos tokens del lado del server.
  async function consultarRuc() {
    const ruc = rucRef.current?.value.trim() ?? "";
    if (!/^\d{11}$/.test(ruc)) { setRucMensaje("⚠️ El RUC debe tener 11 dígitos."); return; }
    setConsultandoRuc(true);
    setRucMensaje(null);
    const { data: res, error } = await sbMkt.functions.invoke("buscar-empresa-por-ruc", { body: { ruc } });
    setConsultandoRuc(false);
    if (error || !res?.success) { setRucMensaje(res?.mensaje ?? "❌ Error al consultar el RUC."); return; }
    if (empresaRef.current) empresaRef.current.value = res.empresa;
    setRucMensaje("✅ Empresa encontrada.");
  }

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
        <Button variant="secondary" onClick={sincronizarInscripciones} disabled={sincronizando} title="Traer inscripciones nuevas del Sheet">
          {sincronizando ? <Loader2 size={17} className="spin" /> : <CloudDownload size={17} />}
        </Button>
        <Button variant="secondary" onClick={cargar} title="Recargar la lista">
          <RefreshCw size={17} />
        </Button>
      </div>
      {syncMensaje && <p className="sync-feedback">{syncMensaje}</p>}

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
              <span>Puntos</span>
              <strong className="mono">{persona.boletosTotal}</strong>
            </div>
            <div className={`person-meta ${persona.ingresado ? "entered" : "pending"}`}>
              <span>Estado</span>
              <strong>{persona.ingresado ? "Ingresó" : "Pendiente"}</strong>
            </div>
            <div className="attendee-actions">
              <button
                className="icon-button"
                onClick={() => marcarAsistencia(persona)}
                disabled={persona.ingresado || marcandoId === persona.id}
                aria-label={persona.ingresado ? `${persona.nombre} ya ingresó` : `Marcar asistencia de ${persona.nombre}`}
                title={persona.ingresado ? "Ya ingresó" : "Marcar asistencia e imprimir"}
              >
                {marcandoId === persona.id ? <Loader2 size={17} className="spin" /> : <UserCheck size={17} />}
              </button>
              <button
                className="icon-button"
                onClick={() => reimprimirGafete(persona)}
                aria-label={`Reimprimir gafete de ${persona.nombre}`}
                title="Reimprimir gafete"
              >
                <Printer size={17} />
              </button>
              <button className="icon-button edit" onClick={() => setModal(persona)} aria-label={`Editar a ${persona.nombre}`} title="Editar datos">
                <Edit3 size={17} />
              </button>
            </div>
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
                  <div className="input-with-action">
                    <input ref={rucRef} name="ruc" defaultValue={modal === "new" ? "" : modal.ruc} placeholder="20123456789" />
                    <button type="button" onClick={consultarRuc} disabled={consultandoRuc} aria-label="Consultar RUC en SUNAT">
                      {consultandoRuc ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
                    </button>
                  </div>
                  {rucMensaje && (
                    <small style={{ color: rucMensaje.startsWith("✅") ? "var(--mkt-success)" : "var(--mkt-danger)" }}>
                      {rucMensaje}
                    </small>
                  )}
                </label>
                <label>
                  Empresa
                  <input ref={empresaRef} name="empresa" defaultValue={modal === "new" ? "" : modal.empresa} placeholder="Nombre de la empresa" />
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
                <p>Etiqueta lista para imprimir.</p>
                <div className="print-label">
                  {/* El QR codifica el link completo a /pase/:id, no solo el
                      código — así, cuando el propio asistente escanea su
                      gafete con la cámara nativa del teléfono, va directo a
                      su pase, sin pasar por la pantalla de "ingresa tu
                      código". El escáner de stand (Stand.tsx) acepta ambos
                      formatos, por si alguna vez hay un QR con el código
                      plano. level="L" ya es la densidad más baja posible —
                      el tamaño (92px) es lo más grande que entra en el
                      alto real de la etiqueta (29mm) sin pisar el margen
                      seguro de impresión, ver el padding reducido de
                      .print-label dentro de @media print en mkt.css. */}
                  <QRCodeSVG value={`${window.location.origin}/#/pase/${guardado.id}`} size={92} level="L" />
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
