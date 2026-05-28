import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface NavItem {
  label: string
  route: string
  icon: React.ReactNode
}

const roleConfig: Record<string, { label: string; colorBg: string; colorText: string; colorBorder: string }> = {
  tutor: {
    label: 'Tutor',
    colorBg: '#E1F5EE',
    colorText: '#085041',
    colorBorder: '#5DCAA5',
  },
  tutorado: {
    label: 'Tutorado',
    colorBg: '#E6F1FB',
    colorText: '#0C447C',
    colorBorder: '#85B7EB',
  },
  coordinador_institucional: {
    label: 'Coord. Institucional',
    colorBg: '#EEEDFE',
    colorText: '#3C3489',
    colorBorder: '#AFA9EC',
  },
  coordinador_departamental: {
    label: 'Coord. Departamento',
    colorBg: '#FEF3E2',
    colorText: '#7A3E00',
    colorBorder: '#F5A623',
  },
  jefe_departamento: {
    label: 'Jefe Depto. Académico',
    colorBg: '#FDE8F0',
    colorText: '#7A0033',
    colorBorder: '#E879A0',
  },
  jefe_desarrollo_academico: {
    label: 'Jefe Des. Académico',
    colorBg: '#FDE8F0',
    colorText: '#7A0033',
    colorBorder: '#E879A0',
  },
  director: {
    label: 'Director',
    colorBg: '#F1EFE8',
    colorText: '#3D3B34',
    colorBorder: '#B4B2A9',
  },
  subdirector: {
    label: 'Subdirector',
    colorBg: '#F1EFE8',
    colorText: '#3D3B34',
    colorBorder: '#B4B2A9',
  },
}

const icons = {
  asistencia: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  evidencias: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  desempeno: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  evalFinal: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  ),
  subirEvidencia: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  ),
  asignarUsuario: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  ),
  registrarActividad: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
    </svg>
  ),
  acreditacion: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  ),
  asignarTutorado: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  consultarTutorados: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><circle cx="16" cy="7" r="3"/><path d="M21 10.5a2 2 0 0 0-3 0"/>
    </svg>
  ),
  asignarTutor: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  ),
  consultarTutores: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  consultarTutoresEstrategico: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
    </svg>
  ),
  dashboard: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  ),
  logout: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

const navItemsByRole: Record<string, NavItem[]> = {
  tutor: [
    { label: 'Capturar asistencia', route: '/capturar-asistencia', icon: icons.asistencia },
    { label: 'Evaluar evidencias',  route: '/evaluar-evidencias',  icon: icons.evidencias },
    { label: 'Evaluar desempeño',   route: '/evaluar-desempeno',   icon: icons.desempeno },
    { label: 'Evaluar tutorados',   route: '/evaluar-tutorados',   icon: icons.evalFinal },
  ],
  tutorado: [
    { label: 'Subir evidencias', route: '/subir-evidencias', icon: icons.subirEvidencia },
  ],
  coordinador_institucional: [
    { label: 'Asignar usuario',       route: '/asignar-usuario',       icon: icons.asignarUsuario },
    { label: 'Registrar actividades', route: '/registrar-actividades', icon: icons.registrarActividad },
    { label: 'Imprimir acreditación', route: '/imprimir-acreditacion', icon: icons.acreditacion },
  ],
  coordinador_departamental: [
    { label: 'Asignar tutorado',      route: '/asignar-tutorado',      icon: icons.asignarTutorado },
    { label: 'Imprimir acreditación', route: '/imprimir-acreditacion', icon: icons.acreditacion },
    { label: 'Consultar tutorados',   route: '/consultar-tutorados',   icon: icons.consultarTutorados },
  ],
  jefe_departamento: [
    { label: 'Asignar tutor',         route: '/asignar-tutor',         icon: icons.asignarTutor },
    { label: 'Imprimir acreditación', route: '/imprimir-acreditacion', icon: icons.acreditacion },
    { label: 'Consultar tutores',     route: '/consultar-tutores',     icon: icons.consultarTutores },
  ],
  jefe_desarrollo_academico: [
    { label: 'Consultar tutorados',   route: '/consultar-tutorados',          icon: icons.consultarTutorados },
    { label: 'Tutores — estratégico', route: '/consultar-tutores-estrategico', icon: icons.consultarTutoresEstrategico },
  ],
  director: [
    { label: 'Consultar tutores', route: '/consultar-tutores', icon: icons.consultarTutores },
  ],
  subdirector: [
    { label: 'Consultar tutores', route: '/consultar-tutores', icon: icons.consultarTutores },
  ],
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { perfil, rol, signOut } = useAuth()
  const navigate = useNavigate()

  const roleKey = rol as keyof typeof roleConfig | null
  const config = roleKey ? roleConfig[roleKey] : null
  const navItems = roleKey ? (navItemsByRole[roleKey] ?? []) : []

  const handleLogout = async () => {
    await signOut()
    onClose()
    navigate('/login')
  }

  if (!isOpen) return null

  // Ensure config colors are accessible for CSS variables
  const activeBg = config?.colorBg ?? '#eff6ff'
  const activeText = config?.colorText ?? '#1e3a8a'
  const activeBorder = config?.colorBorder ?? '#bfdbfe'

  return (
    <>
      <style>{`
        .sidebar-premium {
          backdrop-filter: blur(12px);
          background: linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(248,251,255,0.97) 100%);
        }
        .nav-link-premium {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          margin-bottom: 6px;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          color: #475569;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          border: 1px solid transparent;
        }
        .nav-link-premium:hover {
          background: #f1f5f9;
          color: #0f172a;
          transform: translateX(4px);
        }
        .nav-link-premium.active {
          color: var(--active-text);
          background: linear-gradient(90deg, var(--active-bg) 0%, rgba(255,255,255,0) 100%);
          border: 1px solid var(--active-border);
          box-shadow: 0 4px 14px var(--active-shadow);
          font-weight: 700;
        }
        .nav-link-premium.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: var(--active-text);
          border-radius: 0 4px 4px 0;
        }
        .nav-icon {
          flex-shrink: 0;
          display: inline-flex;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .nav-link-premium:hover .nav-icon {
          transform: scale(1.15) rotate(-4deg);
        }
        .nav-link-premium.active .nav-icon {
          transform: scale(1.1);
        }
        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 20px;
          letter-spacing: 0.02em;
          box-shadow: 0 2px 10px rgba(0,0,0,0.03);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .role-badge:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0,0,0,0.06);
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          animation: pulse 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(0,0,0, 0.2); }
          70% { box-shadow: 0 0 0 6px rgba(0,0,0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0,0,0, 0); }
        }
        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 18px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: linear-gradient(180deg, #fff5f5 0%, #fee2e2 100%);
          cursor: pointer;
          color: #dc2626;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 4px rgba(220, 38, 38, 0.05);
        }
        .logout-btn:hover {
          background: linear-gradient(180deg, #fee2e2 0%, #fca5a5 100%);
          color: #b91c1c;
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(220, 38, 38, 0.15);
        }
      `}</style>

      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(8px)',
          zIndex: 60,
          opacity: 1,
          transition: 'opacity 0.3s ease',
        }}
      />

      <aside
        className="sidebar-premium"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100%',
          width: '320px',
          maxWidth: '92vw',
          zIndex: 70,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(219, 234, 254, 0.5)',
          boxShadow: '10px 0 30px rgba(29, 78, 216, 0.08)',
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          transform: 'translateX(0)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ padding: '24px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
            <button
              onClick={onClose}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                border: '1px solid #dbeafe',
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                color: '#1d4ed8',
                boxShadow: '0 4px 10px rgba(29, 78, 216, 0.1)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)'
                e.currentTarget.style.boxShadow = '0 6px 14px rgba(29, 78, 216, 0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 4px 10px rgba(29, 78, 216, 0.1)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '16px', color: '#0f172a', lineHeight: 1.2 }}>
                Tutorías
              </p>
              {perfil?.nombre_completo && (
                <p style={{
                  margin: '4px 0 0',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#64748b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '200px',
                }}>
                  {perfil.nombre_completo}
                </p>
              )}
            </div>
          </div>

          <span className="role-badge" style={{
            backgroundColor: config?.colorBg ?? '#eff6ff',
            color: config?.colorText ?? '#1e3a8a',
            border: `1px solid ${config?.colorBorder ?? '#bfdbfe'}`,
          }}>
            <span className="pulse-dot" style={{ color: config?.colorBorder ?? '#3b82f6' }}></span>
            {config?.label ?? 'Cargando rol'}
          </span>
        </div>

        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(226, 232, 240, 0.8), transparent)', margin: '0 24px' }} />

        <nav style={{ 
          flex: 1, 
          padding: '20px 16px', 
          overflowY: 'auto',
          '--active-bg': activeBg,
          '--active-text': activeText,
          '--active-border': activeBorder,
          '--active-shadow': `${activeBorder}40`
        } as React.CSSProperties}>
          
          <p style={{
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#94a3b8',
            margin: '0 0 12px 10px',
          }}>
            Principal
          </p>

          <NavLink
            to="/"
            onClick={onClose}
            className={({ isActive }) => `nav-link-premium ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{icons.dashboard}</span>
            Dashboard
          </NavLink>

          <p style={{
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#94a3b8',
            margin: '24px 0 12px 10px',
          }}>
            Mi área
          </p>

          {navItems.map((item) => (
            <NavLink
              key={item.route}
              to={item.route}
              onClick={onClose}
              className={({ isActive }) => `nav-link-premium ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ borderTop: '1px solid rgba(226, 232, 240, 0.6)', padding: '16px 20px 20px' }}>
          <button onClick={handleLogout} className="logout-btn">
            {icons.logout}
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  )
}