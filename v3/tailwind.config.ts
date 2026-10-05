import type { Config } from "tailwindcss";

// Tokens propios (no el config por defecto) — paleta magenta Fiberlux ISP
// heredada 1:1 de v2/DESIGN.md (colores ya confirmados, no se reinventan).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        purple: { DEFAULT: "#96237a", dark: "#6e1a5b", deep: "#4a1240" },
        ink: "#1c1522",
        gray: { DEFAULT: "#5f6368", line: "#e4e0e6" },
        page: "#f7f4f7",
        card: "#ffffff",
        "text-faint": "#a89fa5",
        success: { DEFAULT: "#1a9a54", tint: "#e3f9ed" },
        danger: { DEFAULT: "#d5254e", tint: "#fde8ec" },
        warning: { DEFAULT: "#a65d05", tint: "#fdf0dc" },
        info: { DEFAULT: "#0369a1", tint: "#e0f2fe" },
      },
      fontFamily: {
        sans: ["Poppins", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        content: "16px",
        media: "18px",
        banner: "14px",
        input: "12px",
      },
    },
  },
  plugins: [],
} satisfies Config;
