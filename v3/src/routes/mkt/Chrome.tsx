import {
  BarChart3, CircleHelp, Gift, LayoutDashboard, Menu, MoreHorizontal, Settings, Store, TicketCheck, Users, X,
  type LucideIcon,
} from "lucide-react";
import type { View } from "./types";

const nav: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "asistentes", label: "Asistentes", icon: Users },
  { id: "stands", label: "Stands", icon: Store },
  { id: "ranking", label: "Ranking", icon: BarChart3 },
  { id: "sorteo", label: "Sorteo", icon: Gift },
  { id: "configuracion", label: "Configuración", icon: Settings },
];

export function Topbar({ view, onMenu }: { view: View; onMenu: () => void }) {
  const title = nav.find((item) => item.id === view)?.label;
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onMenu} aria-label="Abrir menú">
        <Menu size={21} />
      </button>
      <div>
        <p className="eyebrow">Panel de marketing</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <div className="event-status">
          <span /> Evento en curso
        </div>
        <button className="icon-button desktop-only" aria-label="Ayuda">
          <CircleHelp size={20} />
        </button>
      </div>
    </header>
  );
}

export function Sidebar({
  view, setView, open, close, aptos, onLogout,
}: { view: View; setView: (v: View) => void; open: boolean; close: () => void; aptos: number; onLogout: () => void }) {
  return (
    <>
      {open && <button className="sidebar-backdrop" onClick={close} aria-label="Cerrar menú" />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <TicketCheck size={24} strokeWidth={2.4} />
          </div>
          <div>
            <strong>Fiberlux ISP</strong>
            <span>Encuentro Arequipa</span>
          </div>
          <button className="icon-button sidebar-close" onClick={close}>
            <X size={20} />
          </button>
        </div>
        <nav className="side-nav">
          <p>GESTIÓN</p>
          {nav.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => { setView(item.id); close(); }}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === "sorteo" && aptos > 0 && <i>{aptos}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">MK</div>
          <div>
            <strong>Marketing</strong>
            <span>Fiberlux ISP</span>
          </div>
          <button className="icon-button" onClick={onLogout} aria-label="Cerrar sesión">
            <MoreHorizontal size={19} />
          </button>
        </div>
      </aside>
    </>
  );
}

export function MobileNav({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <nav className="mobile-nav">
      {nav.slice(0, 5).map((item) => (
        <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
          <item.icon size={20} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
