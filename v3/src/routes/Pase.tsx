import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { Clock, Facebook, Instagram, Linkedin, Megaphone, Music2, Star } from "lucide-react";
import { sbPublic } from "../lib/supabaseClient";

type ItemCronograma = { hora: string; actividad: string; expositor: string | null };

type PaseData = {
  nombre: string;
  empresa: string;
  boletosTotal: number;
  umbralBoletos: number;
  aptoSorteo: boolean;
  participaSorteo: boolean;
  sorteoAbierto: boolean;
  boletosExtraHechos: string[];
};

// Pesos de cada acción — deben coincidir EXACTO con total_boletos() en
// rpc_funciones.sql (una sola fuente de verdad del lado del servidor;
// esto acá es solo para mostrar el "+N" correcto en cada botón).
const REDES_SOCIALES = [
  { tipo: "red_facebook", nombre: "Facebook", icon: Facebook, url: "https://www.facebook.com/p/Fiberlux-ISP-61590764393700/", puntos: 2 },
  { tipo: "red_instagram", nombre: "Instagram", icon: Instagram, url: "https://www.instagram.com/fiberluxisp/", puntos: 2 },
  { tipo: "red_linkedin", nombre: "LinkedIn", icon: Linkedin, url: "https://www.linkedin.com/company/fiberlux-isp/", puntos: 2 },
  { tipo: "red_tiktok", nombre: "TikTok", icon: Music2, url: "https://www.tiktok.com/@fiberlux.isp", puntos: 2 },
];
const CANAL_WHATSAPP = "https://whatsapp.com/channel/0029VbDLDQT0bIdoli8lXy0v";
const RESENA_MAPS = "https://maps.app.goo.gl/pEQcWQDMJLGC43m56";

// Minutos desde medianoche en hora de Lima (GMT-5), calculado con el reloj
// del propio navegador — no hay llamada al servidor para saber qué hora es.
function minutosLima(): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const h = Number(partes.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(partes.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

function minutosDesdeHora(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

// item.hora viene como "08:30 - 09:00". Un bloque que cruza medianoche
// (ej. termina a las 00:30) no aplica en este evento, así que no hace
// falta contemplarlo.
function estaEnCurso(item: ItemCronograma, minutoActual: number): boolean {
  const [inicio, fin] = item.hora.split("-").map((h) => h.trim());
  if (!inicio || !fin) return false;
  return minutoActual >= minutosDesdeHora(inicio) && minutoActual < minutosDesdeHora(fin);
}

export default function Pase() {
  const { codigo } = useParams<{ codigo: string }>();
  const [data, setData] = useState<PaseData | null>(null);
  const [aptosEnVivo, setAptosEnVivo] = useState<number | null>(null);
  const [cronograma, setCronograma] = useState<ItemCronograma[]>([]);
  const [minutoActual, setMinutoActual] = useState(() => minutosLima());
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargarPase = useCallback(async () => {
    if (!codigo) return;
    const { data: res, error: err } = await sbPublic.rpc("obtener_pase", { p_id: codigo });
    setCargando(false);
    if (err) { setError("Error de conexión. Intenta de nuevo."); return; }
    if (!res.success) { setError(res.mensaje); return; }
    setData(res as PaseData);
  }, [codigo]);

  // Snapshot público (aptos al sorteo en vivo) — misma fuente que el KPI
  // de Mkt, cacheado, refrescado cada 60s y SOLO con la pestaña visible.
  const cargarSnapshot = useCallback(async () => {
    const { data: res } = await sbPublic.rpc("obtener_snapshot_publico");
    if (res?.success) setAptosEnVivo(res.aptosSorteo);
  }, []);

  // Cronograma: contenido estático del evento, una sola carga al entrar
  // — sin polling, a diferencia del snapshot de aptos al sorteo. Lo que SÍ
  // se actualiza solo es qué actividad está "en curso": eso es puro reloj
  // del navegador (America/Lima), cero llamadas de red.
  useEffect(() => {
    sbPublic.rpc("obtener_cronograma").then(({ data: res }) => {
      if (Array.isArray(res)) setCronograma(res as ItemCronograma[]);
    });
    const intervalo = setInterval(() => setMinutoActual(minutosLima()), 30_000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    cargarPase();
    cargarSnapshot();
    let intervalo: ReturnType<typeof setInterval> | null = null;
    const iniciar = () => { intervalo = setInterval(cargarSnapshot, 60_000); };
    const detener = () => { if (intervalo) clearInterval(intervalo); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") { cargarSnapshot(); iniciar(); }
      else detener();
    };
    iniciar();
    document.addEventListener("visibilitychange", onVisibility);
    return () => { detener(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [cargarPase, cargarSnapshot]);

  async function registrarBoleto(tipo: string) {
    if (!codigo) return;
    const { data: res } = await sbPublic.rpc("registrar_boleto_extra", { p_id: codigo, p_tipo: tipo });
    if (res?.success) cargarPase();
  }

  // Abre el link real (red social / canal / reseña) en una pestaña nueva Y
  // de paso marca el boleto — una sola acción para la persona, no dos
  // pasos separados. Idempotente del lado del servidor (PK compuesta en
  // boletos_extra), así que no pasa nada si ya estaba hecho.
  function abrirYRegistrar(url: string, tipo: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    registrarBoleto(tipo);
  }

  async function participar() {
    if (!codigo) return;
    const { data: res } = await sbPublic.rpc("participar_sorteo", { p_id: codigo });
    if (res) { setError(res.success ? null : res.mensaje); if (res.success) cargarPase(); }
  }

  if (cargando) return <CentroMensaje>Cargando tu pase…</CentroMensaje>;
  if (error && !data) return <CentroMensaje tono="danger">{error}</CentroMensaje>;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-[480px] px-4 py-5">
      <div className="rounded-media bg-gradient-to-br from-purple-deep to-purple-dark p-5 text-white shadow">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">Credencial verificada</p>
        <h1 className="mt-1 text-xl font-bold">{data.nombre}</h1>
        <p className="text-sm text-white/80">{data.empresa}</p>
      </div>

      {aptosEnVivo !== null && (
        <div className="mt-4 rounded-banner bg-purple/10 px-4 py-3 text-sm font-semibold text-purple">
          🔥 Ya califican al sorteo <span className="font-mono">{aptosEnVivo}</span> personas
        </div>
      )}

      <div className="mt-4 rounded-content bg-card p-5 text-center shadow">
        <p className="font-mono text-3xl font-bold">{data.boletosTotal}/{data.umbralBoletos}</p>
        <p className="text-[11px] uppercase tracking-wide text-gray">puntos acumulados</p>
        {data.aptoSorteo ? (
          <p className="mt-3 rounded-banner bg-success-tint px-3 py-2 text-sm font-semibold text-success">
            ¡Apto para el sorteo!
          </p>
        ) : (
          <p className="mt-3 rounded-banner bg-gray-line/50 px-3 py-2 text-sm text-gray">
            Te faltan {Math.max(0, data.umbralBoletos - data.boletosTotal)} puntos para calificar
          </p>
        )}
      </div>

      {data.sorteoAbierto && (
        <div className="mt-4 rounded-content bg-card p-5 text-center shadow">
          {data.participaSorteo ? (
            <p className="font-semibold text-success">✅ Ya estás participando del sorteo</p>
          ) : (
            <button
              onClick={participar}
              className="h-[52px] w-full rounded-[29px] bg-gradient-to-br from-purple to-purple-dark font-semibold text-white shadow"
            >
              Participar en el sorteo
            </button>
          )}
        </div>
      )}

      <div className="mt-4 rounded-content bg-card p-5 shadow">
        <h2 className="text-sm font-bold">Suma puntos</h2>
        <p className="mt-1 text-xs text-gray">
          Cada acción suma puntos para el sorteo. Tócala para abrir el link — queda registrada al instante, no hace falta volver aquí a confirmar.
        </p>

        <div className="mt-3 space-y-2">
          <button
            onClick={() => abrirYRegistrar(CANAL_WHATSAPP, "canal")}
            className="flex w-full items-center justify-between rounded-input border border-gray-line px-4 py-3 text-left text-sm"
          >
            <span className="flex items-center gap-2"><Megaphone size={16} /> Unirse al canal de difusión de WhatsApp</span>
            <span>{data.boletosExtraHechos.includes("canal") ? "✅" : "+3"}</span>
          </button>

          {/* Cada red social es independiente: tocar una abre esa red Y
              registra solo esa acción (ya no comparten un único boleto). */}
          {REDES_SOCIALES.map((r) => (
            <button
              key={r.tipo}
              onClick={() => abrirYRegistrar(r.url, r.tipo)}
              className="flex w-full items-center justify-between rounded-input border border-gray-line px-4 py-3 text-left text-sm"
            >
              <span className="flex items-center gap-2"><r.icon size={16} /> Seguir en {r.nombre}</span>
              <span>{data.boletosExtraHechos.includes(r.tipo) ? "✅" : `+${r.puntos}`}</span>
            </button>
          ))}

          <button
            onClick={() => abrirYRegistrar(RESENA_MAPS, "resena")}
            className="flex w-full items-center justify-between rounded-input border border-gray-line px-4 py-3 text-left text-sm"
          >
            <span className="flex items-center gap-2"><Star size={16} /> Dejar una reseña</span>
            <span>{data.boletosExtraHechos.includes("resena") ? "✅" : "+1"}</span>
          </button>
        </div>
      </div>

      {cronograma.length > 0 && (
        <div className="mt-4 rounded-content bg-card p-5 shadow">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Clock size={16} /> Cronograma</h2>
          <div className="divide-y divide-gray-line">
            {cronograma.map((item, i) => {
              const enCurso = estaEnCurso(item, minutoActual);
              return (
                <div key={i} className={`-mx-2 px-2 py-2 text-sm ${enCurso ? "bg-purple/10" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={`font-mono text-xs ${enCurso ? "font-semibold text-purple" : "text-gray"}`}>
                      {enCurso && "● "}{item.hora}
                    </span>
                    <span className={`text-right font-medium ${enCurso ? "text-purple" : ""}`}>{item.actividad}</span>
                  </div>
                  {item.expositor && <p className="mt-0.5 text-right text-xs text-purple">{item.expositor}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CentroMensaje({ children, tono }: { children: ReactNode; tono?: "danger" }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <p className={tono === "danger" ? "text-danger" : "text-gray"}>{children}</p>
    </div>
  );
}
