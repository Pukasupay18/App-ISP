import type { ReactNode } from "react";
import { X } from "lucide-react";

// Overlay genérico para las páginas públicas (Pase, Certificado) — estas
// rutas no tienen el modal-layer oscuro del panel Mkt (mkt.css), así que
// usan este wrapper claro, consistente con el resto de .rounded-content.
export default function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[90vh] w-full max-w-[420px] overflow-y-auto rounded-content bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">{titulo}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-gray">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
