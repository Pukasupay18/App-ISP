import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X } from "lucide-react";
import { sbPublic } from "../lib/supabaseClient";
import { extraerCodigoPase } from "../lib/qr";
import CertificadoDescarga from "../components/CertificadoDescarga";

type Modo = "inicio" | "escaneando" | "buscando" | "resultado";

// Entrada para quien quiere su certificado pero ya no tiene a mano el
// gafete (lo perdió, no se lo imprimieron, vino sin celular con la
// cámara libre). Tres formas de identificarse, todas opcionales entre
// sí — basta con una: escanear el QR del gafete, escribir su código, o
// los datos con los que se inscribió (RUC, celular, correo). El
// resultado solo aparece si la persona ya hizo check-in en el evento —
// ver buscar_certificado() en rpc_funciones.sql.
export default function Certificado() {
  const [modo, setModo] = useState<Modo>("inicio");
  const [codigo, setCodigo] = useState("");
  const [ruc, setRuc] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombres, setNombres] = useState<string[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerId = "reader-certificado";

  const buscar = useCallback(async (params: { p_id?: string; p_celular?: string; p_email?: string; p_ruc?: string }) => {
    setModo("buscando");
    setError(null);
    const { data, error: err } = await sbPublic.rpc("buscar_certificado", {
      p_id: params.p_id || null,
      p_celular: params.p_celular || null,
      p_email: params.p_email || null,
      p_ruc: params.p_ruc || null,
    });
    if (err) {
      setError("Error de conexión. Intenta de nuevo.");
      setModo("inicio");
      return;
    }
    const resultados = (data as Array<{ nombre: string }>) || [];
    if (resultados.length === 0) {
      setError("No encontramos un registro con asistencia confirmada con esos datos. Si acabas de llegar, puede que tu check-in aún no se haya registrado.");
      setModo("inicio");
      return;
    }
    setNombres(resultados.map((r) => r.nombre));
    setModo("resultado");
  }, []);

  const alEscanear = useCallback((texto: string) => {
    detenerEscaner();
    buscar({ p_id: extraerCodigoPase(texto) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar]);

  useEffect(() => {
    if (modo !== "escaneando") return;
    const scanner = new Html5Qrcode(readerId);
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 12, qrbox: { width: 260, height: 260 } },
        (texto) => alEscanear(texto),
        () => { /* ruido normal mientras escanea */ },
      )
      .catch(() => setErrorCamara("No se pudo acceder a la cámara. Revisa los permisos del navegador."));

    return () => {
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [modo, alEscanear]);

  function detenerEscaner() {
    setModo("inicio");
    setErrorCamara(null);
  }

  function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    const limpio = codigo.trim();
    if (!limpio) return;
    buscar({ p_id: limpio });
  }

  function enviarDatos(e: React.FormEvent) {
    e.preventDefault();
    const rucVal = ruc.trim();
    const celularVal = celular.trim();
    const emailVal = email.trim();

    if (!rucVal && !celularVal && !emailVal) {
      setError("Completa al menos el RUC, el celular o el correo.");
      return;
    }
    // El RUC identifica una empresa, no a una persona — varios asistentes
    // de la misma empresa lo comparten. Por seguridad, el servidor no
    // busca por RUC solo: tiene que venir acompañado de tu celular o tu
    // correo. Se valida acá también para no hacerle esperar un viaje al
    // servidor solo para decirle lo mismo.
    if (rucVal && !celularVal && !emailVal) {
      setError("El RUC solo funciona junto con tu celular o tu correo — agrega uno de los dos.");
      return;
    }
    buscar({ p_ruc: rucVal, p_celular: celularVal, p_email: emailVal });
  }

  function reiniciar() {
    setModo("inicio");
    setCodigo(""); setRuc(""); setCelular(""); setEmail("");
    setError(null); setNombres([]);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center px-6 py-10">
      <div className="w-full rounded-content bg-card p-6 shadow">
        <h1 className="text-center text-lg font-bold">Certificado de participación</h1>

        {modo === "resultado" ? (
          <>
            <p className="mt-1 mb-4 text-center text-sm text-gray">
              {nombres.length > 1 ? "Encontramos estos registros:" : "¡Listo! Encontramos tu registro:"}
            </p>
            <div className="space-y-3">
              {nombres.map((n, i) => <CertificadoDescarga key={`${n}-${i}`} nombre={n} />)}
            </div>
            <button
              onClick={reiniciar}
              className="mt-4 h-11 w-full rounded-[29px] border border-gray-line text-sm font-semibold"
            >
              Nueva búsqueda
            </button>
          </>
        ) : modo === "escaneando" ? (
          <div className="mt-5">
            <p className="mb-3 text-center text-sm text-gray">Apunta la cámara al QR de tu gafete</p>
            <div id={readerId} className="overflow-hidden rounded-media bg-black" />
            {errorCamara && <p className="mt-3 text-center text-xs text-danger">{errorCamara}</p>}
            <button
              onClick={detenerEscaner}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[29px] border border-gray-line text-sm font-semibold"
            >
              <X size={16} /> Cancelar
            </button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-center text-sm text-gray">
              Identifícate para descargar tu certificado. Solo disponible si ya hiciste check-in en el evento.
            </p>

            {error && <p className="mt-3 rounded-banner bg-danger-tint px-3 py-2 text-center text-xs text-danger">{error}</p>}

            {modo === "buscando" ? (
              <p className="mt-6 text-center text-sm text-gray">Buscando tu certificado…</p>
            ) : (
              <>
                <button
                  onClick={() => setModo("escaneando")}
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[29px] bg-gradient-to-br from-purple to-purple-dark text-sm font-semibold text-white"
                >
                  <Camera size={18} /> Escanear mi gafete
                </button>

                <div className="my-4 flex items-center gap-3 text-[11px] text-gray">
                  <span className="h-px flex-1 bg-gray-line" /> o <span className="h-px flex-1 bg-gray-line" />
                </div>

                <form onSubmit={enviarCodigo}>
                  <input
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Código de tu gafete, ej. CQ0427FX"
                    className="w-full rounded-input border border-gray-line px-4 py-3 text-center font-mono text-sm uppercase tracking-wide"
                  />
                  <button className="mt-3 h-12 w-full rounded-[29px] border border-purple text-sm font-semibold text-purple">
                    Buscar con mi código
                  </button>
                </form>

                <div className="my-4 flex items-center gap-3 text-[11px] text-gray">
                  <span className="h-px flex-1 bg-gray-line" /> o con mis datos <span className="h-px flex-1 bg-gray-line" />
                </div>

                <form onSubmit={enviarDatos} className="space-y-3">
                  <div className="text-left">
                    <label className="mb-1 block text-xs font-medium text-gray">RUC</label>
                    <input
                      value={ruc}
                      onChange={(e) => setRuc(e.target.value)}
                      placeholder="20123456789"
                      className="w-full rounded-input border border-gray-line px-4 py-3 text-sm"
                    />
                    <p className="mt-1 text-[11px] text-gray">Solo funciona junto con tu celular o tu correo.</p>
                  </div>
                  <div className="text-left">
                    <label className="mb-1 block text-xs font-medium text-gray">Celular</label>
                    <input
                      value={celular}
                      onChange={(e) => setCelular(e.target.value)}
                      placeholder="987654321"
                      className="w-full rounded-input border border-gray-line px-4 py-3 text-sm"
                    />
                  </div>
                  <div className="text-left">
                    <label className="mb-1 block text-xs font-medium text-gray">Correo</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nombre@empresa.com"
                      className="w-full rounded-input border border-gray-line px-4 py-3 text-sm"
                    />
                  </div>
                  <button className="h-12 w-full rounded-[29px] bg-gradient-to-br from-purple to-purple-dark text-sm font-semibold text-white">
                    Buscar certificado
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
