import { useEffect, useState } from "react";
import { generarCertificadoPNG, nombreArchivoCertificado } from "../lib/certificado";

// Genera y muestra UN certificado (preview + link de descarga) para el
// nombre recibido. Se usa tanto en /pase (ya sabemos quién es) como en
// /certificado (puede haber más de un resultado, uno de estos por fila).
export default function CertificadoDescarga({ nombre }: { nombre: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelado = false;
    generarCertificadoPNG(nombre)
      .then((blob) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => { if (!cancelado) setError(true); });
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [nombre]);

  if (error) {
    return <p className="text-sm text-danger">No se pudo generar el certificado. Intenta de nuevo.</p>;
  }

  return (
    <div className="rounded-input border border-gray-line bg-page p-3 text-left">
      <p className="mb-2 text-sm font-semibold">{nombre}</p>
      {url ? (
        <>
          <img src={url} alt={`Certificado de ${nombre}`} className="mb-2 w-full rounded-input border border-gray-line" />
          <a
            href={url}
            download={nombreArchivoCertificado(nombre)}
            className="flex h-11 w-full items-center justify-center rounded-[29px] bg-gradient-to-br from-purple to-purple-dark text-sm font-semibold text-white"
          >
            Descargar certificado
          </a>
        </>
      ) : (
        <p className="py-6 text-center text-xs text-gray">Generando tu constancia…</p>
      )}
    </div>
  );
}
