// Link a la encuesta de satisfacción post-evento (Typeform). Se repite en
// dos lugares a propósito: justo bajo el certificado descargado (el
// momento en que la persona ya tuvo su "premio" y es más probable que
// responda) y en la pantalla principal, bajo el acceso al certificado.
const ENCUESTA_URL = "https://form.typeform.com/to/CeDa2Jrb";

export default function EncuestaCTA({ variante = "card" }: { variante?: "card" | "link" }) {
  if (variante === "link") {
    return (
      <a
        href={ENCUESTA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block text-center text-xs font-semibold text-purple underline"
      >
        ¿Cómo te fue en el Encuentro Fiberlux ISP Arequipa? Cuéntanos
      </a>
    );
  }

  return (
    <a
      href={ENCUESTA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 flex items-center justify-between rounded-input border border-purple/30 bg-purple/5 px-4 py-3 text-left text-sm text-purple"
    >
      <span className="font-medium">¿Cómo te fue en el Encuentro Fiberlux ISP Arequipa? Cuéntanos</span>
      <span aria-hidden>→</span>
    </a>
  );
}
