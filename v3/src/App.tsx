import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { sbMkt } from "./lib/supabaseClient";
import Pase from "./routes/Pase";
import Stand from "./routes/Stand";
import Sponsor from "./routes/Sponsor";
import Mkt from "./routes/Mkt";

export default function App() {
  // Forzar un refresh de sesión al volver a primer plano: los navegadores
  // móviles congelan el temporizador interno de supabase-js cuando la
  // pestaña queda en segundo plano un rato largo, así que confiar solo en
  // el autoRefresh de fondo deja al staff con el token vencido al volver
  // (el mismo "se cae la sesión" que pasaba en V2). Esto es un no-op si
  // ya no hay sesión (nadie logueado en /mkt en ese momento).
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sbMkt.auth.startAutoRefresh();
      } else {
        sbMkt.auth.stopAutoRefresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/pase/:codigo" element={<Pase />} />
        <Route path="/stand/:codigo" element={<Stand />} />
        <Route path="/sponsor/:codigo" element={<Sponsor />} />
        <Route path="/mkt" element={<Mkt />} />
        <Route path="*" element={<Navigate to="/mkt" replace />} />
      </Routes>
    </HashRouter>
  );
}
