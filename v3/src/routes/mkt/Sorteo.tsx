import { useEffect, useState } from "react";
import { CircleHelp, Download, Gift, RefreshCw, Sparkles, UserCheck } from "lucide-react";
import { sbMkt } from "../../lib/supabaseClient";
import { Button, SectionTitle } from "./shared";

type Candidato = { id: string; nombre: string; empresa: string; celular: string; boletosTotal: number; participaEn: string };

export default function Sorteo({ aptos }: { aptos: number }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [ganador, setGanador] = useState<Candidato | null>(null);
  const [nombreEnPantalla, setNombreEnPantalla] = useState("Todo listo para comenzar");

  useEffect(() => {
    sbMkt.from("event_config").select("sorteo_abierto").eq("id", 1).single().then(({ data }) => {
      if (data) setAbierto(data.sorteo_abierto);
    });
  }, []);

  async function toggleAbierto() {
    const nuevo = !abierto;
    setAbierto(nuevo);
    await sbMkt.from("event_config").update({ sorteo_abierto: nuevo }).eq("id", 1);
  }

  async function cargarCandidatos(): Promise<Candidato[]> {
    setCargando(true);
    const { data: res } = await sbMkt.rpc("obtener_lista_sorteo_mkt");
    setCargando(false);
    return res?.success ? (res.asistentes as Candidato[]) : [];
  }

  async function sortear() {
    // Siempre trae la lista fresca, no reusa la del sorteo anterior —
    // es una acción puntual al final del evento, no vale la pena cachear.
    const lista = await cargarCandidatos();
    if (lista.length === 0) return;
    setGanador(null);
    setRolling(true);
    let ticks = 0;
    const timer = window.setInterval(() => {
      setNombreEnPantalla(lista[Math.floor(Math.random() * lista.length)].nombre);
      ticks++;
      if (ticks > 24) {
        window.clearInterval(timer);
        const elegido = lista[Math.floor(Math.random() * lista.length)];
        setGanador(elegido);
        setNombreEnPantalla(elegido.nombre);
        setRolling(false);
      }
    }, 90);
  }

  async function exportar() {
    const lista = await cargarCandidatos();
    const filas = ["Nombre,Empresa,Celular,Boletos", ...lista.map((c) => `${c.nombre},${c.empresa},${c.celular},${c.boletosTotal}`)];
    const url = URL.createObjectURL(new Blob([filas.join("\n")], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "aptos-sorteo.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="screen draw-screen">
      <SectionTitle
        title="Sorteo del evento"
        subtitle="Elige un ganador entre los asistentes que confirmaron presencia y califican."
        action={<Button variant="secondary" onClick={exportar}><Download size={17} /> Exportar aptos</Button>}
      />
      <div className="draw-grid">
        <article className="draw-stage">
          <div className="draw-glow" />
          <div className="draw-icon"><Gift size={29} /></div>
          <p>{rolling ? "Seleccionando ganador..." : ganador ? "Tenemos un ganador" : "Sorteo Fiberlux ISP"}</p>
          <h2 className={rolling ? "rolling" : ""}>{nombreEnPantalla}</h2>
          {ganador ? (
            <span className="winner-company">{ganador.empresa} · <b className="mono">{ganador.boletosTotal} boletos</b></span>
          ) : (
            <span>La selección se realiza al azar entre quienes confirmaron participar y llegan al umbral de boletos.</span>
          )}
          <Button onClick={sortear} disabled={rolling || !abierto || cargando}>
            {rolling ? <><RefreshCw className="spin" size={19} /> Sorteando...</> : ganador ? <><RefreshCw size={19} /> Sortear nuevamente</> : <><Sparkles size={19} /> Realizar sorteo</>}
          </Button>
          {!abierto && <small>Abre la ventana del sorteo para comenzar.</small>}
        </article>
        <div className="draw-side">
          <article className="card qualified-card">
            <div className="qualified-icon"><UserCheck size={23} /></div>
            <div>
              <span>Participantes aptos</span>
              <strong className="mono">{aptos}</strong>
              <small>Llegaron al umbral de boletos</small>
            </div>
          </article>
          <article className="card draw-control">
            <div className="control-head">
              <div><span className={`live-dot ${abierto ? "" : "off"}`} /> Ventana del sorteo</div>
              <button className={`toggle ${abierto ? "toggle-on" : ""}`} onClick={toggleAbierto} role="switch" aria-checked={abierto} aria-label="Ventana del sorteo">
                <span />
              </button>
            </div>
            <h3>{abierto ? "Sorteo abierto" : "Sorteo cerrado"}</h3>
            <p>{abierto ? "Los asistentes pueden confirmar su participación desde su pase." : "No se admiten nuevas confirmaciones en este momento."}</p>
          </article>
          <article className="tip-card">
            <CircleHelp size={20} />
            <div>
              <strong>Antes de sortear</strong>
              <p>La lista de aptos se trae al momento — vuelve a tocar "Realizar sorteo" si quieres refrescarla antes de elegir.</p>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
