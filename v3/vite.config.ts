import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// HashRouter en App.tsx + base relativo: la app queda servible desde
// cualquier subruta de Vercel sin configurar rewrites del lado del
// servidor — todo el ruteo por rol vive en el hash (#/pase/:codigo, etc.).
export default defineConfig({
  plugins: [react()],
});
