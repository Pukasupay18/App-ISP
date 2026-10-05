import type { ElementType, ReactNode } from "react";

export function Button({
  children, variant = "primary", className = "", onClick, disabled = false, type = "button",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`button button-${variant} ${className}`}>
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

export function minutosDesde(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
}
