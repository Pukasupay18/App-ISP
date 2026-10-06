import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X } from "lucide-react";

// Entrada pública para quien no tiene a mano el QR de su gafete (lo
// escanean normalmente con la cámara nativa del teléfono y el QR los
// manda directo a /pase/:codigo) — esta pantalla es el respaldo: otro
// dispositivo, perdió el gafete, prefiere escribir el código a mano. El
// botón "Escanear mi QR" cubre el caso de quien SÍ tiene el gafete a
// mano pero está en esta pantalla (por ejemplo, llegó por el link base
// del evento en vez de escanear directo) — mismo lector que usan los
// stands (Stand.tsx), aceptando tanto el link completo como el código
// plano del QR.
function extraerCodigo(textoEscaneado: string): string {
  const limpio = textoEscaneado.trim();
  const match = limpio.match(/\/pase\/([A-Za-z0-9]+)/);
  return (match ? match[1] : limpio).toUpperCase();
}

export default function Selector() {
  const [codigo, setCodigo] = useState("");
  const [escaneando, setEscaneando] = useState(false);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = "reader-selector";

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = codigo.trim().toUpperCase();
    if (limpio) navigate(`/pase/${limpio}`);
  }

  const alEscanear = useCallback((texto: string) => {
    navigate(`/pase/${extraerCodigo(texto)}`);
  }, [navigate]);

  useEffect(() => {
    if (!escaneando) return;
    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 260, height: 260 } },
        (texto) => alEscanear(texto),
        () => { /* "no se detectó QR en este frame" — ruido normal mientras escanea */ },
      )
      .catch(() => setErrorCamara("No se pudo acceder a la cámara. Revisa los permisos del navegador."));

    return () => {
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [escaneando, alEscanear]);

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center px-6">
      <div className="w-full rounded-content bg-card p-6 text-center shadow">
        <h1 className="text-lg font-bold">Encuentro Fiberlux ISP</h1>

        {escaneando ? (
          <div className="mt-5">
            <p className="mb-3 text-sm text-gray">Apunta la cámara al QR de tu gafete</p>
            <div id={readerId} className="overflow-hidden rounded-media bg-black" />
            {errorCamara && <p className="mt-3 text-xs text-danger">{errorCamara}</p>}
            <button
              onClick={() => { setEscaneando(false); setErrorCamara(null); }}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[29px] border border-gray-line text-sm font-semibold"
            >
              <X size={16} /> Cancelar
            </button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-gray">Ingresa el código de tu gafete para ver tu pase</p>
            <button
              onClick={() => setEscaneando(true)}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[29px] bg-gradient-to-br from-purple to-purple-dark text-sm font-semibold text-white"
            >
              <Camera size={18} /> Escanear mi QR
            </button>

            <div className="my-4 flex items-center gap-3 text-[11px] text-gray">
              <span className="h-px flex-1 bg-gray-line" /> o <span className="h-px flex-1 bg-gray-line" />
            </div>

            <form onSubmit={entrar}>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ej. CQ0427FX"
                className="w-full rounded-input border border-gray-line px-4 py-3 text-center font-mono text-sm uppercase tracking-wide"
              />
              <button className="mt-3 h-12 w-full rounded-[29px] border border-purple text-sm font-semibold text-purple">
                Ver mi pase
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
