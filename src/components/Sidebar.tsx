import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface NavItem { label: string; route: string; icon: React.ReactNode }

const ROLE_CONFIG: Record<string, { label: string; accent: string; soft: string; border: string }> = {
  tutor:                     { label: 'Tutor',                  accent: '#0e7490', soft: '#ecfeff', border: '#a5f3fc' },
  tutorado:                  { label: 'Tutorado',               accent: '#ea580c', soft: '#fff7ed', border: '#fed7aa' },
  coordinador_institucional: { label: 'Coord. Institucional',   accent: '#7c3aed', soft: '#f5f3ff', border: '#c4b5fd' },
  coordinador_departamental: { label: 'Coord. Departamental',   accent: '#b45309', soft: '#fffbeb', border: '#fcd34d' },
  jefe_departamento:         { label: 'Jefe de Departamento',   accent: '#be185d', soft: '#fdf2f8', border: '#f9a8d4' },
  jefe_desarrollo_academico: { label: 'Jefe Des. Académico',    accent: '#be185d', soft: '#fdf2f8', border: '#f9a8d4' },
  director:                  { label: 'Director',               accent: '#374151', soft: '#f9fafb', border: '#d1d5db' },
  subdirector:               { label: 'Subdirector',            accent: '#374151', soft: '#f9fafb', border: '#d1d5db' },
}

const I = {
  dashboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  tutorados:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  evidencias: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/></svg>,
  subir:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
  asistencia: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  desempeno:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  actividad:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>,
  acreditacion:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>,
  usuarios:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  tutores:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  estrategico:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
  fechas:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  logout:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  tutor: [
    { label: 'Mis tutorados',      route: '/gestionar-tutorados',  icon: I.tutorados },
    { label: 'Fechas por grupo',   route: '/fechas-grupo',         icon: I.fechas },
    { label: 'Consultar tutorados',route: '/consultar-tutorados',  icon: I.tutores },
    { label: 'Capturar asistencia',route: '/capturar-asistencia',  icon: I.asistencia },
    { label: 'Evaluar evidencias', route: '/evaluar-evidencias',   icon: I.evidencias },
    { label: 'Seguimiento y reporte', route: '/evaluar-desempeno', icon: I.desempeno },
  ],
  tutorado: [
    { label: 'Mis evidencias',     route: '/subir-evidencias',     icon: I.subir },
  ],
  coordinador_institucional: [
    { label: 'Asignar usuario',      route: '/asignar-usuario',       icon: I.usuarios },
    { label: 'Actividades del PT',   route: '/registrar-actividades', icon: I.actividad },
    { label: 'Imprimir acreditación',route: '/imprimir-acreditacion', icon: I.acreditacion },
  ],
  coordinador_departamental: [
    { label: 'Asignar tutorado',     route: '/asignar-tutorado',      icon: I.tutorados },
    { label: 'Consultar tutorados',  route: '/consultar-tutorados',   icon: I.tutores },
    { label: 'Imprimir acreditación',route: '/imprimir-acreditacion', icon: I.acreditacion },
  ],
  jefe_departamento: [
    { label: 'Asignar tutor',        route: '/asignar-tutor',         icon: I.usuarios },
    { label: 'Consultar tutores',    route: '/consultar-tutores',     icon: I.tutores },
    { label: 'Imprimir acreditación',route: '/imprimir-acreditacion', icon: I.acreditacion },
  ],
  jefe_desarrollo_academico: [
    { label: 'Consultar tutorados',  route: '/consultar-tutorados',          icon: I.tutorados },
    { label: 'Tutores estratégico',  route: '/consultar-tutores-estrategico',icon: I.estrategico },
  ],
  director:    [{ label: 'Consultar tutores', route: '/consultar-tutores', icon: I.tutores }],
  subdirector: [{ label: 'Consultar tutores', route: '/consultar-tutores', icon: I.tutores }],
}

interface SidebarProps { isOpen: boolean; onClose: () => void }

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { perfil, rol, signOut } = useAuth()
  const navigate = useNavigate()

  const cfg      = ROLE_CONFIG[rol ?? ''] ?? ROLE_CONFIG.director
  const navItems = NAV_BY_ROLE[rol ?? ''] ?? []

  async function handleLogout() {
    await signOut()
    onClose()
    navigate('/login')
  }

  return (
    <>
      <style>{`
        @keyframes sbSlide { from { transform:translateX(-100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
        @keyframes sbFadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes sbPulse  { 0%,100%{box-shadow:0 0 0 0 currentColor} 50%{box-shadow:0 0 0 4px transparent} }

        .sb-overlay {
          position:fixed; inset:0; background:rgba(15,23,42,0.4); backdrop-filter:blur(8px);
          z-index:60; animation:sbFadeIn 0.25s ease;
        }
        .sb-aside {
          position:fixed; top:0; left:0; height:100%; width:280px; max-width:92vw;
          background:#ffffff; z-index:70; display:flex; flex-direction:column;
          border-right:1px solid #f1f5f9;
          box-shadow:20px 0 60px rgba(15,23,42,0.12);
          animation:sbSlide 0.3s cubic-bezier(0.16,1,0.3,1);
          font-family:'Inter','Segoe UI',sans-serif;
        }
        .sb-top {
          padding:1.1rem 1rem 0.85rem;
          border-bottom:1px solid #f1f5f9;
        }
        .sb-close-row { display:flex; align-items:center; gap:0.6rem; margin-bottom:0.85rem; }
        .sb-close-btn {
          width:32px; height:32px; border-radius:9px; border:1px solid #e2e8f0;
          background:#f8fafc; cursor:pointer; display:grid; place-items:center;
          color:#64748b; transition:all 0.18s; flex-shrink:0;
        }
        .sb-close-btn:hover { background:#fee2e2; border-color:#fca5a5; color:#dc2626; transform:rotate(90deg); }
        .sb-brand { font-size:0.88rem; font-weight:800; color:#0f172a; letter-spacing:-0.02em; }
        .sb-period { font-size:0.7rem; color:#94a3b8; font-weight:500; margin-top:1px; }
        .sb-user-row { display:flex; align-items:center; gap:0.65rem; }
        .sb-avatar {
          width:36px; height:36px; border-radius:10px; flex-shrink:0; display:grid; place-items:center;
          font-weight:800; font-size:0.9rem; color:#fff;
          background:linear-gradient(135deg, var(--sb-accent), color-mix(in srgb, var(--sb-accent) 60%, #000));
        }
        .sb-user-info { min-width:0; flex:1; }
        .sb-user-name { font-size:0.84rem; font-weight:700; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sb-role-tag {
          display:inline-flex; align-items:center; gap:0.3rem;
          font-size:0.65rem; font-weight:800; padding:2px 7px; border-radius:6px; margin-top:2px;
          background:var(--sb-soft); color:var(--sb-accent); border:1px solid var(--sb-border);
          letter-spacing:0.03em; text-transform:uppercase;
        }
        .sb-dot { width:5px; height:5px; border-radius:50%; background:currentColor; display:inline-block; animation:sbPulse 2s infinite; }
        .sb-nav { flex:1; overflow-y:auto; padding:0.75rem 0.65rem; }
        .sb-section-label {
          font-size:0.62rem; font-weight:900; letter-spacing:0.14em; text-transform:uppercase;
          color:#cbd5e1; margin:0.5rem 0 0.35rem 0.6rem; display:block;
        }
        .sb-link {
          display:flex; align-items:center; gap:0.6rem;
          padding:0.6rem 0.7rem; border-radius:10px;
          text-decoration:none; font-size:0.84rem; font-weight:600;
          color:#64748b; transition:all 0.18s cubic-bezier(0.4,0,0.2,1);
          position:relative; margin-bottom:1px; border:1px solid transparent;
        }
        .sb-link:hover {
          background:#f8fafc; color:#0f172a; transform:translateX(3px);
        }
        .sb-link.active {
          background:var(--sb-soft); color:var(--sb-accent);
          border-color:var(--sb-border); font-weight:700;
        }
        .sb-link.active::before {
          content:''; position:absolute; left:0; top:50%;
          transform:translateY(-50%); width:3px; height:60%;
          background:var(--sb-accent); border-radius:0 3px 3px 0;
        }
        .sb-link.active .sb-icon { transform:scale(1.08); }
        .sb-icon { flex-shrink:0; display:inline-flex; transition:transform 0.2s cubic-bezier(0.34,1.56,0.64,1); }
        .sb-link:hover .sb-icon { transform:scale(1.12) translateX(1px); }
        .sb-link:not(.active):hover::before {
          content:''; position:absolute; left:0; top:50%;
          transform:translateY(-50%); width:2px; height:40%;
          background:#e2e8f0; border-radius:0 2px 2px 0;
        }
        .sb-bottom { padding:0.75rem; border-top:1px solid #f1f5f9; }
        .sb-logout {
          width:100%; display:flex; align-items:center; justify-content:center; gap:0.5rem;
          padding:0.7rem 1rem; border:1px solid #fecaca; border-radius:11px;
          background:#fff; cursor:pointer; color:#dc2626;
          font-size:0.82rem; font-weight:700; transition:all 0.18s;
        }
        .sb-logout:hover { background:#fef2f2; border-color:#fca5a5; transform:translateY(-1px); box-shadow:0 4px 12px rgba(220,38,38,0.12); }
      `}</style>

      {isOpen && (
        <>
          <div className="sb-overlay" onClick={onClose} />
          <aside
            className="sb-aside"
            style={{
              '--sb-accent': cfg.accent,
              '--sb-soft':   cfg.soft,
              '--sb-border': cfg.border,
            } as React.CSSProperties}
          >
            <div className="sb-top">
              <div className="sb-close-row">
                <button type="button" className="sb-close-btn" onClick={onClose} aria-label="Cerrar menú">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <div>
                  <div className="sb-brand">Programa de Tutorías</div>
                </div>
              </div>

              <div className="sb-user-row">
                <div className="sb-avatar">
                  {perfil?.nombre_completo?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div className="sb-user-info">
                  <div className="sb-user-name">{perfil?.nombre_completo ?? '—'}</div>
                  <div>
                    <span className="sb-role-tag">
                      <span className="sb-dot" />
                      {cfg.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <nav className="sb-nav">
              <span className="sb-section-label">Principal</span>
              <NavLink
                to="/dashboard"
                onClick={onClose}
                className={({ isActive }) => `sb-link${isActive ? ' active' : ''}`}
              >
                <span className="sb-icon">{I.dashboard}</span>
                Dashboard
              </NavLink>

              {navItems.length > 0 && (
                <>
                  <span className="sb-section-label">Mi área</span>
                  {navItems.map((item) => (
                    <NavLink
                      key={item.route}
                      to={item.route}
                      onClick={onClose}
                      className={({ isActive }) => `sb-link${isActive ? ' active' : ''}`}
                    >
                      <span className="sb-icon">{item.icon}</span>
                      {item.label}
                    </NavLink>
                  ))}
                </>
              )}
            </nav>

            <div className="sb-bottom">
              <button type="button" className="sb-logout" onClick={() => void handleLogout()}>
                {I.logout}
                Cerrar sesión
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
