import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Entrada pública para quien no tiene a mano el QR de su gafete (lo
// escanean normalmente con la cámara nativa del teléfono y el QR los
// manda directo a /pase/:codigo — esta pantalla es el respaldo manual:
// otro dispositivo, perdió el gafete, etc.
export default function Selector() {
  const [codigo, setCodigo] = useState("");
  const navigate = useNavigate();

  function entrar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = codigo.trim().toUpperCase();
    if (limpio) navigate(`/pase/${limpio}`);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center px-6">
      <div className="w-full rounded-content bg-card p-6 text-center shadow">
        <h1 className="text-lg font-bold">Encuentro Fiberlux ISP</h1>
        <p className="mt-1 text-sm text-gray">Ingresa el código de tu gafete para ver tu pase</p>
        <form onSubmit={entrar} className="mt-5">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ej. CQ0427FX"
            className="w-full rounded-input border border-gray-line px-4 py-3 text-center font-mono text-sm uppercase tracking-wide"
            autoFocus
          />
          <button className="mt-3 h-12 w-full rounded-[29px] bg-gradient-to-br from-purple to-purple-dark text-sm font-semibold text-white">
            Ver mi pase
          </button>
        </form>
      </div>
    </div>
  );
}
