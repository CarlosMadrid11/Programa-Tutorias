import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'   // ← viene del archivo separado ahora

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface NavItem {
  label: string
  route: string
  icon: React.ReactNode
}

// ─── Configuración de roles ───────────────────────────────────────────────────
// Los valores de 'rol' vienen exactamente como están en la tabla 'sistema'
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

// ─── Íconos SVG ───────────────────────────────────────────────────────────────
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
  logout: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

// ─── Menús por rol ────────────────────────────────────────────────────────────
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

// ─── Props ────────────────────────────────────────────────────────────────────
interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const rol      = user?.rol ?? ''
  const config   = roleConfig[rol] ?? roleConfig['director']
  const navItems = navItemsByRole[rol] ?? []

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(2px)',
          zIndex: 30,
        }}
      />

      {/* Panel lateral */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100%',
          width: '272px',
          backgroundColor: '#ffffff',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '4px 0 32px rgba(0,0,0,0.08)',
          fontFamily: "'Geist', 'Inter', sans-serif",   // ← aquí estaba el error de sintaxis
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <button
              onClick={onClose}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: config.colorBg,
                color: config.colorText,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#1a1a1a', lineHeight: 1.3 }}>
                Programa de Tutorías
              </p>
              {user?.nombre && (
                <p style={{
                  margin: '3px 0 0',
                  fontSize: '11px',
                  color: '#888',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '160px',
                }}>
                  {user.nombre}
                </p>
              )}
            </div>
          </div>

          {/* Badge del rol */}
          <span style={{
            display: 'inline-block',
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '8px',
            backgroundColor: config.colorBg,
            color: config.colorText,
            border: `0.5px solid ${config.colorBorder}`,
            letterSpacing: '0.02em',
          }}>
            {config.label}
          </span>
        </div>

        {/* Divisor */}
        <div style={{ height: '0.5px', backgroundColor: '#f0f0f0', margin: '0 20px' }} />

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          <p style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#bbb',
            margin: '0 0 10px 6px',
          }}>
            Mi área
          </p>

          {navItems.map((item) => (
            <NavLink
              key={item.route}
              to={item.route}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '10px',
                marginBottom: '3px',
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase' as const,
                transition: 'all 0.15s',
                backgroundColor: isActive ? config.colorBg : 'transparent',
                color: isActive ? config.colorText : '#555',
                boxShadow: isActive ? `0 2px 8px ${config.colorBorder}40` : 'none',
              })}
            >
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ borderTop: '1px solid #fff1f0' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '16px 24px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fff1f0')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {icons.logout}
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  )
}