import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '../hooks/useAuth'

// ─── Íconos ───────────────────────────────────────────────────────────────────
const HamburgerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)

// ─── Layout ───────────────────────────────────────────────────────────────────
// Se usa como wrapper de todas las rutas protegidas en AppRouter:
//
//   <Route element={<Layout />}>
//     <Route path="/capturar-asistencia" element={<CapturarAsistencia />} />
//     ...
//   </Route>
//
// <Outlet /> renderiza la página hija de la ruta activa.

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8f9fb',
      fontFamily: "'Geist', 'Inter', sans-serif",
    }}>

      {/* ── Topbar ────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        height: '52px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #eeeff1',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '14px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        {/* Botón hamburguesa */}
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menú"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#374151',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#ffffff')}
        >
          <HamburgerIcon />
        </button>

        {/* Título */}
        <span style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#111827',
          letterSpacing: '-0.01em',
        }}>
          Programa de Tutorías
        </span>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Nombre del usuario (derecha) */}
        {user?.nombre && (
          <span style={{
            fontSize: '12px',
            color: '#6b7280',
            fontWeight: 500,
            maxWidth: '180px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {user.nombre}
          </span>
        )}
      </header>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Contenido ─────────────────────────────────────────────────────── */}
      {/* <Outlet /> es donde React Router monta la página de la ruta activa   */}
      <main style={{
        padding: '28px 24px',
        maxWidth: '960px',
        margin: '0 auto',
      }}>
        <Outlet />
      </main>
    </div>
  )
}