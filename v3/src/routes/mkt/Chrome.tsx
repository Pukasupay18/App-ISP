import { useState } from "react";
import {
  BarChart3, ChevronLeft, Gift, LayoutDashboard, LogOut, Menu, MoreHorizontal, Scan, Settings, Store,
  TicketCheck, UserSearch, Users, X, type LucideIcon,
} from "lucide-react";
import { sbMkt } from "../../lib/supabaseClient";
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
      </div>
    </header>
  );
}

type StandAtajo = { nombre: string; codigo: string };

export function Sidebar({
  view, setView, open, close, aptos, onLogout,
}: { view: View; setView: (v: View) => void; open: boolean; close: () => void; aptos: number; onLogout: () => void }) {
  const [menu, setMenu] = useState<"cerrado" | "principal" | "stands">("cerrado");
  const [stands, setStands] = useState<StandAtajo[] | null>(null);

  function cerrarMenu() { setMenu("cerrado"); }

  function verComoAsistente() {
    const codigo = window.prompt("Código del asistente (ej. CQ0427FX):");
    if (codigo?.trim()) window.open(`${window.location.origin}/#/pase/${codigo.trim().toUpperCase()}`, "_blank");
    cerrarMenu();
  }

  async function abrirApoyoStand() {
    if (!stands) {
      const { data } = await sbMkt.from("stands").select("nombre, codigo").eq("activo", true).eq("tier", "diamante").order("orden");
      setStands((data as StandAtajo[]) ?? []);
    }
    setMenu("stands");
  }

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
          <button
            className="icon-button"
            onClick={() => setMenu(menu === "cerrado" ? "principal" : "cerrado")}
            aria-label="Más opciones"
          >
            <MoreHorizontal size={19} />
          </button>

          {menu !== "cerrado" && (
            <>
              <button className="user-menu-backdrop" onClick={cerrarMenu} aria-label="Cerrar" />
              <div className="user-menu">
                {menu === "principal" ? (
                  <>
                    <button onClick={verComoAsistente}><UserSearch size={16} /> Vista como asistente</button>
                    <button onClick={abrirApoyoStand}><Scan size={16} /> Apoyo a un stand</button>
                    <hr />
                    <button className="danger" onClick={() => { cerrarMenu(); onLogout(); }}><LogOut size={16} /> Cerrar sesión</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setMenu("principal")}><ChevronLeft size={16} /> Volver</button>
                    <hr />
                    {stands === null && <p className="user-menu-empty">Cargando…</p>}
                    {stands?.length === 0 && <p className="user-menu-empty">Sin stands activos.</p>}
                    {stands?.map((s) => (
                      <button
                        key={s.codigo}
                        onClick={() => { window.open(`${window.location.origin}/#/stand/${s.codigo}`, "_blank"); cerrarMenu(); }}
                      >
                        <Store size={16} /> {s.nombre}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

