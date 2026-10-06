import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Camera } from "lucide-react";
import { sbPublic } from "../lib/supabaseClient";

// El QR del gafete codifica el link completo (".../#/pase/CQ0427FX"), no
// solo el código — así el propio asistente, al escanear su gafete con la
// cámara nativa, va directo a su pase. Esta función acepta ese formato Y
// el código plano (por si queda algún QR viejo o alguien escribe el
// código a mano en otro flujo), siempre devolviendo solo el código.
function extraerCodigoAsistente(textoEscaneado: string): string {
  const limpio = textoEscaneado.trim();
  const match = limpio.match(/\/pase\/([A-Za-z0-9]+)/);
  return (match ? match[1] : limpio).toUpperCase();
}

type StandInfo = {
  standId: string;
  nombre: string;
  tier: string;
  panelSponsor: boolean;
  codigoSponsor: string | null;
};

type ResultadoEscaneo = {
  mensaje: string;
  ok: boolean;
  attendeeId: string;
} | null;

export default function Stand() {
  const { codigo } = useParams<{ codigo: string }>();
  const [stand, setStand] = useState<StandInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoEscaneo>(null);
  const [nota, setNota] = useState("");
  const [notaGuardada, setNotaGuardada] = useState(false);
  const [contadorHoy, setContadorHoy] = useState(0);
  const [escaneando, setEscaneando] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const procesandoRef = useRef(false);
  const readerId = "reader-stand";

  useEffect(() => {
    if (!codigo) return;
    sbPublic.rpc("resolver_stand", { p_codigo: codigo }).then(({ data: res, error: err }) => {
      if (err) { setError("Error de conexión."); return; }
      if (!res.success) { setError(res.mensaje); return; }
      setStand(res as StandInfo);
    });
  }, [codigo]);

  const procesarEscaneo = useCallback(async (attendeeId: string) => {
    if (procesandoRef.current || !codigo) return;
    procesandoRef.current = true;
    scannerRef.current?.pause(true);

    const { data: res } = await sbPublic.rpc("marcar_visita_stand", {
      p_codigo_stand: codigo,
      p_attendee_id: attendeeId,
    });

    if (res?.success) {
      setResultado({ mensaje: res.mensaje, ok: true, attendeeId });
      setContadorHoy((n) => n + (res.yaEstaba ? 0 : 1));
      setNota("");
      setNotaGuardada(false);
    } else {
      setResultado({ mensaje: res?.mensaje ?? "Error de red.", ok: false, attendeeId });
    }

    setTimeout(() => {
      procesandoRef.current = false;
      scannerRef.current?.resume();
    }, 2000);
  }, [codigo]);

  // La cámara NO arranca sola al cargar la página: en un navegador recién
  // abierto (nunca dio permiso antes), pedir la cámara apenas monta la
  // pantalla suele demorar o directamente no disparar el prompt — se
  // siente como que "no carga". Arrancarla recién al tocar un botón (gesto
  // real del usuario) es más rápido y confiable en todos los navegadores.
  const [errorCamara, setErrorCamara] = useState<string | null>(null);

  useEffect(() => {
    if (!stand || !escaneando) return;
    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 260, height: 260 } },
        (texto) => { procesarEscaneo(extraerCodigoAsistente(texto)); },
        () => { /* callback de "no se detectó QR en este frame" — se ignora, es ruido normal mientras escanea */ },
      )
      .catch(() => { setErrorCamara("No se pudo acceder a la cámara. Revisa los permisos del navegador."); setEscaneando(false); });

    return () => {
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [stand, escaneando, procesarEscaneo]);

  async function guardarNota() {
    if (!codigo || !resultado) return;
    const { data: res } = await sbPublic.rpc("anotar_visita_stand", {
      p_codigo_stand: codigo,
      p_attendee_id: resultado.attendeeId,
      p_nota: nota,
    });
    if (res?.success) setNotaGuardada(true);
  }

  if (error) return <div className="flex min-h-screen items-center justify-center px-6 text-center text-danger">{error}</div>;
  if (!stand) return <div className="flex min-h-screen items-center justify-center text-gray">Cargando…</div>;

  return (
    <div className="mx-auto max-w-[480px] px-4 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">{stand.nombre}</h1>
        <span className="font-mono text-sm text-gray">{contadorHoy} escaneos</span>
      </div>

      {stand.panelSponsor && stand.codigoSponsor && (
        <Link
          to={`/sponsor/${stand.codigoSponsor}`}
          className="mb-3 block rounded-[29px] border-2 border-purple py-3 text-center text-sm font-semibold text-purple"
        >
          Ver Panel Sponsor
        </Link>
      )}

      {stand.tier !== "diamante" ? (
        <div className="flex h-[260px] w-full flex-col items-center justify-center gap-2 rounded-media border-2 border-dashed border-gray-line bg-card px-6 text-center text-sm text-gray">
          Este stand no tiene función de escaneo — solo los stands Diamante escanean asistentes.
        </div>
      ) : escaneando ? (
        <div id={readerId} className="overflow-hidden rounded-media bg-black" />
      ) : (
        <button
          onClick={() => { setErrorCamara(null); setEscaneando(true); }}
          className="flex h-[260px] w-full flex-col items-center justify-center gap-3 rounded-media border-2 border-dashed border-gray-line bg-card text-sm font-semibold text-purple"
        >
          <Camera size={28} />
          Empezar a escanear asistentes
        </button>
      )}
      {errorCamara && <p className="mt-2 text-center text-xs text-danger">{errorCamara}</p>}

      {resultado && (
        <div className={`mt-3 rounded-banner p-4 ${resultado.ok ? "bg-success-tint text-success" : "bg-danger-tint text-danger"}`}>
          <p className="text-sm font-semibold">{resultado.mensaje}</p>
          {resultado.ok && (
            <div className="mt-3">
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Nota comercial (opcional)"
                className="w-full rounded-input border border-gray-line bg-card px-3 py-2 text-sm text-ink"
              />
              <button
                onClick={guardarNota}
                disabled={notaGuardada}
                className="mt-2 h-10 w-full rounded-[29px] bg-ink text-sm font-semibold text-white disabled:opacity-50"
              >
                {notaGuardada ? "Nota guardada ✓" : "Guardar nota"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
