import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import ToastContainer from './ToastContainer'
import CambiarPasswordModal from './CambiarPasswordModal'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

const menuIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [periodo, setPeriodo]         = useState('')
  const { session, perfil, loading, refreshPerfil } = useAuth()
  const navigate                      = useNavigate()

  useEffect(() => {
    if (!loading && !session) navigate('/login', { replace: true })
  }, [session, loading, navigate])

  useEffect(() => {
    supabase.from('periodos_escolares').select('nombre').eq('activo', true).single()
      .then(({ data }) => {
        const p = data as { nombre?: string } | null
        if (p?.nombre) setPeriodo(p.nombre)
      })
  }, [])

  if (loading || !session) return null

  const initial = perfil?.nombre_completo?.charAt(0)?.toUpperCase() ?? '?'

  const requiereCambioPassword = Boolean(perfil?.primer_acceso)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <CambiarPasswordModal
        open={requiereCambioPassword}
        onSuccess={() => void refreshPerfil()}
      />
      <style>{`
        * { box-sizing: border-box; }
        .layout-main { min-height: calc(100vh - 64px); padding: 1.5rem; max-width: 1280px; margin: 0 auto; }
        @media (max-width: 640px) { .layout-main { padding: 1rem; } }
      `}</style>

      <ToastContainer />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <header style={{
        height: 64, background: '#ffffff', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', padding: '0 1.25rem', gap: '0.875rem',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 3px rgba(30,64,175,0.06)',
      }}>
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            width: 40, height: 40, border: '1px solid #e2e8f0', borderRadius: 10,
            background: '#f8fafc', color: '#1d4ed8', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
          aria-label="Abrir menú"
        >
          {menuIcon}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e3a8a', lineHeight: 1.2 }}>
            Programa de Tutorías
          </span>
          {periodo && (
            <span style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.2 }}>{periodo}</span>
          )}
        </div>

        {perfil && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
            <span style={{
              display: 'none',
              fontSize: '0.8rem', color: '#334155', maxWidth: 160,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
              className="header-name"
            >
              {perfil.nombre_completo}
            </span>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
              color: '#fff', fontWeight: 700, fontSize: '0.82rem',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {initial}
            </div>
          </div>
        )}
      </header>

      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
