import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import type { ReactNode } from 'react'

import Layout   from './components/Layout'
import Login    from './pages/Login'
import Dashboard from './pages/Dashboard'
import AsignarUsuario        from './pages/AsignarUsuario'
import RegistrarActividades  from './pages/RegistrarActividades'
import AsignarTutor          from './pages/AsignarTutor'
import AsignarTutorado       from './pages/AsignarTutorado'
import CapturarAsistencia    from './pages/CapturarAsistencia'
import EvaluarEvidencias     from './pages/EvaluarEvidencias'
import EvaluarDesempeno      from './pages/EvaluarDesempeno'
import SubirEvidencias       from './pages/SubirEvidencias'
import ImprimirAcreditacion  from './pages/ImprimirAcreditacion'
import ConsultarTutores      from './pages/ConsultarTutores'
import ConsultarTutorados    from './pages/ConsultarTutorados'
import GestionarTutorados    from './pages/GestionarTutorados'
import FechasGrupo           from './pages/FechasGrupo'

function AuthCheckingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: '#ffffff', fontFamily: "'Inter','Segoe UI',sans-serif",
      color: '#0f172a', padding: '1rem',
    }}>
      <style>{`
        @keyframes authSpin  { to { transform: rotate(360deg); } }
        @keyframes authPulse { 0%,100%{opacity:.65;transform:scale(1)} 50%{opacity:1;transform:scale(1.02)} }
      `}</style>
      <div style={{
        width: 'min(430px,100%)', border: '1px solid #dbeafe', borderRadius: 18,
        background: 'linear-gradient(180deg,#fff 0%,#f8fbff 100%)',
        boxShadow: '0 24px 48px rgba(37,99,235,0.12)', padding: '1.3rem 1.2rem',
        display: 'flex', alignItems: 'center', gap: '0.9rem',
        animation: 'authPulse 1.8s ease-in-out infinite',
      }}>
        <span style={{
          width: 30, height: 30, borderRadius: '50%',
          border: '2.5px solid #bfdbfe', borderTopColor: '#2563eb',
          display: 'inline-block', animation: 'authSpin .85s linear infinite', flexShrink: 0,
        }} />
        <div style={{ display: 'grid', gap: '0.15rem' }}>
          <strong style={{ color: '#1e3a8a', fontSize: '0.95rem' }}>Verificando sesión</strong>
          <span style={{ color: '#64748b', fontSize: '0.82rem' }}>Preparando tu acceso al sistema…</span>
        </div>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <AuthCheckingScreen />
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <AuthCheckingScreen />
  if (session) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  {
    path: '/login',
    element: <PublicOnly><Login /></PublicOnly>,
  },
  {
    element: <RequireAuth><Layout /></RequireAuth>,
    children: [
      { path: '/dashboard',              element: <Dashboard /> },
      { path: '/asignar-usuario',        element: <AsignarUsuario /> },
      { path: '/registrar-actividades',  element: <RegistrarActividades /> },
      { path: '/asignar-tutor',          element: <AsignarTutor /> },
      { path: '/asignar-tutorado',       element: <AsignarTutorado /> },
      { path: '/gestionar-tutorados',    element: <GestionarTutorados /> },
      { path: '/fechas-grupo',           element: <FechasGrupo /> },
      { path: '/capturar-asistencia',    element: <CapturarAsistencia /> },
      { path: '/evaluar-evidencias',     element: <EvaluarEvidencias /> },
      { path: '/evaluar-desempeno',      element: <EvaluarDesempeno /> },
      { path: '/evaluar-tutorados',      element: <EvaluarDesempeno /> },
      { path: '/subir-evidencias',       element: <SubirEvidencias /> },
      { path: '/imprimir-acreditacion',  element: <ImprimirAcreditacion /> },
      { path: '/consultar-tutores',      element: <ConsultarTutores /> },
      { path: '/consultar-tutores-estrategico', element: <ConsultarTutores /> },
      { path: '/consultar-tutorados',    element: <ConsultarTutorados /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
