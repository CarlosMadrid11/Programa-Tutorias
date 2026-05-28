import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'
import RefreshButton from '../components/RefreshButton'

const rolLabels: Record<string, string> = {
  coordinador_institucional: 'Coordinador Institucional',
  coordinador_departamental: 'Coordinador Departamental',
  jefe_departamento: 'Jefe de Departamento',
  jefe_desarrollo_academico: 'Jefe de Desarrollo Académico',
  tutor: 'Tutor',
  tutorado: 'Tutorado',
  director: 'Director',
  subdirector: 'Subdirector',
}

const rolTheme: Record<string, { hero: string; iconBg: string; iconColor: string; gold: boolean }> = {
  coordinador_institucional: { hero: 'linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 55%,#7c3aed 100%)', iconBg: '#ddd6fe', iconColor: '#5b21b6', gold: true },
  coordinador_departamental: { hero: 'linear-gradient(135deg,#7a3e00 0%,#c2711a 55%,#f5a623 100%)', iconBg: '#fef3e2', iconColor: '#7a3e00', gold: true },
  jefe_departamento:         { hero: 'linear-gradient(135deg,#7a0033 0%,#be185d 55%,#f43f8e 100%)', iconBg: '#fce7f3', iconColor: '#9d174d', gold: true },
  jefe_desarrollo_academico: { hero: 'linear-gradient(135deg,#064e3b 0%,#059669 55%,#34d399 100%)', iconBg: '#d1fae5', iconColor: '#065f46', gold: true },
  tutor:       { hero: 'linear-gradient(135deg,#085041 0%,#0d9488 55%,#5eead4 100%)', iconBg: '#ccfbf1', iconColor: '#0f766e', gold: false },
  tutorado:    { hero: 'linear-gradient(135deg,#0c447c 0%,#1d4ed8 55%,#60a5fa 100%)', iconBg: '#dbeafe', iconColor: '#1d4ed8', gold: false },
  director:    { hero: 'linear-gradient(135deg,#1c1917 0%,#44403c 55%,#78716c 100%)', iconBg: '#e7e5e4', iconColor: '#44403c', gold: true },
  subdirector: { hero: 'linear-gradient(135deg,#1c1917 0%,#44403c 55%,#78716c 100%)', iconBg: '#e7e5e4', iconColor: '#44403c', gold: true },
}

interface Stat { label: string; value: string | number; icon: ReactNode }

const userIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const gridIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
const bookIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
const checkIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>

export default function Dashboard() {
  const { perfil, rol, session, refreshPerfil } = useAuth()
  const [stats, setStats]     = useState<Stat[]>([])
  const [alertas, setAlertas] = useState<number>(0)
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = useCallback(async () => {
      if (!rol) return
      const s: Stat[] = []
      if (['coordinador_institucional', 'jefe_desarrollo_academico'].includes(rol)) {
        const [tutores, tutorados, alertasRes] = await Promise.all([
          supabase.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'tutor').eq('estado', 'activo'),
          supabase.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'tutorado').eq('estado', 'activo'),
          supabase.from('alertas_sistema').select('id', { count: 'exact', head: true }).eq('resuelta', false),
        ])
        s.push(
          { label: 'Tutores activos',     value: tutores.count ?? '—',    icon: userIcon },
          { label: 'Tutorados inscritos', value: tutorados.count ?? '—',  icon: userIcon },
          { label: 'Alertas activas',     value: alertasRes.count ?? '—', icon: gridIcon },
        )
        setAlertas(alertasRes.count ?? 0)
      }
      if (rol === 'tutor') {
        const { data: asig } = await supabase.from('asignaciones_tutor').select('id').eq('tutor_id', perfil!.id).eq('activa', true)
        const ids = (asig ?? []).map((a: { id: string }) => a.id)
        let tutoradosCount = 0
        if (ids.length > 0) {
          const { count } = await supabase.from('asignaciones_tutorado').select('id', { count: 'exact' }).in('asignacion_id', ids).eq('activa', true)
          tutoradosCount = count ?? 0
        }
        const { count: pendEvid } = await supabase.from('evidencias').select('id', { count: 'exact' }).eq('evaluada_por', null).in('estado', ['entregada'])
        s.push(
          { label: 'Mis grupos activos',    value: asig?.length ?? 0, icon: gridIcon },
          { label: 'Mis tutorados',         value: tutoradosCount,    icon: userIcon },
          { label: 'Evidencias pendientes', value: pendEvid ?? 0,     icon: bookIcon },
        )
      }
      if (rol === 'tutorado') {
        const { count: act } = await supabase.from('evidencias').select('id', { count: 'exact' }).eq('tutorado_id', perfil!.id).eq('estado', 'pendiente')
        const { count: ent } = await supabase.from('evidencias').select('id', { count: 'exact' }).eq('tutorado_id', perfil!.id).in('estado', ['entregada','aceptada'])
        s.push(
          { label: 'Evidencias entregadas', value: ent ?? 0, icon: checkIcon },
          { label: 'Evidencias pendientes', value: act ?? 0, icon: bookIcon  },
        )
      }
      setStats(s)
  }, [rol, perfil])

  useEffect(() => { void loadStats() }, [loadStats])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([refreshPerfil(), loadStats()])
    setRefreshing(false)
  }

  const firstName = perfil?.nombre_completo?.split(' ')[0] ?? 'Usuario'
  const theme = rolTheme[rol ?? ''] ?? rolTheme['tutorado']
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .dash-wrap { font-family: 'Inter', sans-serif; }

        /* Hero */
        .dash-hero {
          position: relative; overflow: hidden;
          background: ${theme.hero};
          border-radius: 22px; padding: 2.25rem 2rem 2rem;
          margin-bottom: 1.75rem;
          box-shadow: 0 24px 60px rgba(0,0,0,0.18);
          animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards;
        }
        .dash-hero::before {
          content:''; position:absolute; top:-80px; right:-80px;
          width:260px; height:260px; border-radius:50%;
          background:rgba(255,255,255,0.07); pointer-events:none;
        }
        .dash-hero::after {
          content:''; position:absolute; bottom:-60px; left:40px;
          width:180px; height:180px; border-radius:50%;
          background:rgba(255,255,255,0.04); pointer-events:none;
        }
        .dash-hero-inner { position:relative; z-index:1; }
        .dash-greeting { font-size:0.75rem; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:rgba(255,255,255,0.6); margin:0 0 0.25rem; }
        .dash-hero h1 { margin:0 0 0.4rem; font-size:clamp(1.5rem,3vw,2.1rem); font-weight:900; color:#fff; letter-spacing:-0.03em; line-height:1.1; }
        .dash-hero-sub { margin:0; font-size:0.88rem; color:rgba(255,255,255,0.7); font-weight:500; }
        .dash-role-pill {
          display:inline-flex; align-items:center; gap:7px; margin-top:1.1rem;
          background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.28);
          backdrop-filter:blur(10px); border-radius:20px;
          padding:5px 15px; font-size:0.77rem; font-weight:700; color:#fff;
          letter-spacing:0.04em;
        }
        .pill-star { color:#fbbf24; display:inline-flex; }

        /* Gold accent */
        .gold-card {
          background:linear-gradient(135deg,#fffbeb,#fef3c7);
          border:1px solid #fde68a; border-radius:16px;
          padding:1.1rem 1.4rem;
          display:flex; align-items:center; gap:1rem;
          margin-bottom:1.75rem;
          box-shadow:0 6px 20px rgba(251,191,36,0.12);
          animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both;
        }
        .gold-icon {
          width:48px; height:48px; border-radius:14px; flex-shrink:0;
          background:linear-gradient(135deg,#f59e0b,#d97706);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 6px 14px rgba(245,158,11,0.3); color:#fff;
        }
        .gold-label { font-size:0.7rem; font-weight:800; color:#92400e; letter-spacing:0.08em; text-transform:uppercase; margin-bottom:0.2rem; }
        .gold-value { font-size:0.95rem; font-weight:700; color:#78350f; }

        /* Alert banner */
        .alerta-banner {
          background:linear-gradient(135deg,#fef2f2,#fee2e2);
          border:1px solid #fecaca; border-radius:14px;
          padding:0.95rem 1.2rem;
          display:flex; align-items:center; gap:0.85rem;
          margin-bottom:1.5rem; color:#991b1b; font-size:0.87rem; font-weight:600;
          box-shadow:0 4px 14px rgba(220,38,38,0.08);
          animation:fadeUp 0.4s ease both;
        }
        .alerta-count {
          width:30px; height:30px; border-radius:9px; flex-shrink:0;
          background:#dc2626; color:#fff;
          display:flex; align-items:center; justify-content:center;
          font-size:0.82rem; font-weight:900;
        }

        /* Stats */
        .dash-section-label { font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.13em; color:#94a3b8; margin:0 0 0.85rem; }
        .dash-stats { display:grid; grid-template-columns:repeat(auto-fill,minmax(195px,1fr)); gap:1rem; margin-bottom:1.75rem; }
        .stat-card {
          background:#fff; border:1px solid #e2e8f0; border-radius:18px;
          padding:1.35rem 1.4rem; display:flex; flex-direction:column; gap:0.55rem;
          transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.3s ease;
          animation:fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
          cursor:default;
        }
        .stat-card:hover { transform:translateY(-5px); box-shadow:0 20px 44px rgba(29,78,216,0.11); }
        .stat-icon {
          width:46px; height:46px; border-radius:13px;
          display:inline-flex; align-items:center; justify-content:center;
          background:${theme.iconBg}; color:${theme.iconColor};
          transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .stat-card:hover .stat-icon { transform:scale(1.18) rotate(-6deg); }
        .stat-value { font-size:2.25rem; font-weight:900; color:#0f172a; font-variant-numeric:tabular-nums; line-height:1; }
        .stat-label { font-size:0.78rem; color:#64748b; font-weight:600; }

        /* Info Cards */
        .dash-info { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:0.85rem; margin-bottom:1.5rem; }
        .info-card {
          background:#fff; border:1px solid #e2e8f0; border-radius:14px;
          padding:1.1rem 1.2rem;
          transition:border-color 0.2s,box-shadow 0.2s;
        }
        .info-card:hover { border-color:#bfdbfe; box-shadow:0 4px 16px rgba(29,78,216,0.07); }
        .info-label { font-size:0.69rem; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:#94a3b8; margin-bottom:0.3rem; }
        .info-value { font-size:0.93rem; font-weight:700; color:#0f172a; }

        /* Animations */
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }

        @media(max-width:600px){
          .dash-stats,.dash-info{grid-template-columns:1fr 1fr;}
          .dash-hero{padding:1.5rem;}
        }
      `}</style>

      <div className="dash-wrap">

        {/* Alerta de perfil no encontrado */}
        {!perfil && (
          <div style={{ padding:'1.1rem 1.25rem', background:'#fee2e2', border:'1px solid #ef4444', borderRadius:'14px', marginBottom:'1.25rem', color:'#991b1b', lineHeight:'1.5' }}>
            <strong style={{ display:'flex', alignItems:'center', gap:'0.4rem', marginBottom:'0.4rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Perfil no encontrado
            </strong>
            <p style={{ margin:'0 0 0.4rem', fontSize:'0.88rem' }}>No se encontraron datos en la base de datos para esta cuenta.</p>
            <ul style={{ margin:0, paddingLeft:'1.4rem', fontSize:'0.85rem' }}>
              <li><strong>Email:</strong> <code>{session?.user?.email}</code></li>
              <li><strong>ID:</strong> <code>{session?.user?.id}</code></li>
            </ul>
          </div>
        )}

        {/* Alertas sistema */}
        {alertas > 0 && (
          <div className="alerta-banner">
            <span className="alerta-count">{alertas}</span>
            <span>Hay {alertas} alerta{alertas > 1 ? 's' : ''} activa{alertas > 1 ? 's' : ''} en el sistema.</span>
          </div>
        )}

        {/* Hero */}
        <div className="dash-hero">
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 2 }}>
            <RefreshButton onClick={handleRefresh} loading={refreshing} />
          </div>
          <div className="dash-hero-inner">
            <p className="dash-greeting">{greeting}</p>
            <h1>{firstName}</h1>
            <p className="dash-hero-sub">Sistema de Gestión del Programa de Tutorías</p>
            <div className="dash-role-pill">
              {theme.gold && (
                <span className="pill-star">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </span>
              )}
              {rolLabels[rol ?? ''] ?? rol}
            </div>
          </div>
        </div>

        {/* Gold badge para roles privilegiados */}
        {theme.gold && (
          <div className="gold-card">
            <div className="gold-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <div className="gold-label">Acceso privilegiado</div>
              <div className="gold-value">Cuenta con permisos avanzados de gestión institucional</div>
            </div>
          </div>
        )}

        {/* Stats */}
        {stats.length > 0 && (
          <>
            <p className="dash-section-label">Resumen de actividad</p>
            <div className="dash-stats">
              {stats.map((s, i) => (
                <div key={i} className="stat-card" style={{ animationDelay: `${0.1 + i * 0.07}s` }}>
                  <span className="stat-icon">{s.icon}</span>
                  <span className="stat-value">{s.value}</span>
                  <span className="stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Info cards */}
        <p className="dash-section-label">Información de cuenta</p>
        <div className="dash-info">
          <div className="info-card">
            <div className="info-label">Rol</div>
            <div className="info-value">{rolLabels[rol ?? ''] ?? rol}</div>
          </div>
          <div className="info-card">
            <div className="info-label">Estado</div>
            <div className="info-value" style={{ textTransform:'capitalize', color: perfil?.estado === 'activo' ? '#059669' : '#94a3b8' }}>
              {perfil?.estado ?? '—'}
            </div>
          </div>
          {perfil?.departamento && (
            <div className="info-card">
              <div className="info-label">Departamento</div>
              <div className="info-value">{perfil.departamento}</div>
            </div>
          )}
          {perfil?.carrera && (
            <div className="info-card">
              <div className="info-label">Carrera</div>
              <div className="info-value">{perfil.carrera}</div>
            </div>
          )}
          {perfil?.numero_empleado && (
            <div className="info-card">
              <div className="info-label">N° Empleado</div>
              <div className="info-value">{perfil.numero_empleado}</div>
            </div>
          )}
          {perfil?.numero_control && (
            <div className="info-card">
              <div className="info-label">N° Control</div>
              <div className="info-value">{perfil.numero_control}</div>
            </div>
          )}
        </div>

        <p style={{ textAlign:'center', fontSize:'0.72rem', color:'#cbd5e1', marginTop:'0.25rem' }}>
          SGPT · Instituto Tecnológico de Culiacán · TecNM
        </p>
      </div>
    </>
  )
}
