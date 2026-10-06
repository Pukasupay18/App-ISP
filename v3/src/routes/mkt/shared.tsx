import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { Check, RefreshCw } from "lucide-react";

export function Button({
  children, variant = "primary", className = "", onClick, disabled = false, type = "button", title,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} title={title} className={`button button-${variant} ${className}`}>
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button className={`toggle ${checked ? "toggle-on" : ""}`} onClick={onChange} role="switch" aria-checked={checked} aria-label={label}>
      <span />
    </button>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label, value, note, icon: Icon, tone = "purple",
}: { label: string; value: string | number; note: string; icon: ElementType; tone?: string }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon tone-${tone}`}>
        <Icon size={21} />
      </div>
      <div className="metric-copy">
        <p>{label}</p>
        <strong className="mono">{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const esDiamante = tier === "diamante";
  return (
    <span className={`tier tier-${tier}`}>
      {esDiamante && "✦ "}
      {tier[0].toUpperCase() + tier.slice(1)}
    </span>
  );
}

// Botón "Actualizar" con feedback real: gira mientras carga, y al
// terminar muestra "Actualizado ✓" un par de segundos — sin esto no hay
// forma de saber si el clic realmente trajo datos nuevos o no pasó nada.
export function RefreshButton({ cargando, onClick }: { cargando: boolean; onClick: () => void }) {
  const [recienActualizado, setRecienActualizado] = useState(false);
  const eraCargando = useRef(false);

  useEffect(() => {
    if (eraCargando.current && !cargando) {
      setRecienActualizado(true);
      const t = setTimeout(() => setRecienActualizado(false), 2000);
      return () => clearTimeout(t);
    }
    eraCargando.current = cargando;
  }, [cargando]);

  return (
    <Button variant="secondary" onClick={onClick} disabled={cargando}>
      {cargando ? (
        <><RefreshCw size={17} className="spin" /> Actualizando…</>
      ) : recienActualizado ? (
        <><Check size={17} /> Actualizado</>
      ) : (
        <><RefreshCw size={17} /> Actualizar</>
      )}
    </Button>
  );
}

export function minutosDesde(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
}
