import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import SidebarDemo from './components/SidebarDemo'

// ─── Páginas placeholder (reemplazar con los componentes reales) ──────────────
const Placeholder = ({ title }: { title: string }) => (
  <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
    <h2>📄 {title}</h2>
    <p style={{ color: '#888' }}>Página en construcción</p>
  </div>
)

// ─── Guard de autenticación ───────────────────────────────────────────────────
// Solo verifica que el usuario esté logueado.
// El control de qué rutas puede ver cada rol lo hace el Sidebar
// (solo muestra las opciones del rol) + las RLS de Supabase en el backend.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: '2rem' }}>Cargando...</div>
  if (!user)   return <Navigate to="/login" replace />
  return <>{children}</>
}

// ─── Router ───────────────────────────────────────────────────────────────────
export default function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Públicas ──────────────────────────────────────────────── */}
          <Route path="/login"         element={<Placeholder title="Login" />} />
          <Route path="/no-autorizado" element={<Placeholder title="No autorizado" />} />
          <Route path="/demo"          element={<SidebarDemo />} />

          {/* ── Protegidas — todas usan Layout (topbar + sidebar) ─────── */}
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            {/* Tutor */}
            <Route path="/capturar-asistencia" element={<Placeholder title="Capturar Asistencia" />} />
            <Route path="/evaluar-evidencias"  element={<Placeholder title="Evaluar Evidencias" />} />
            <Route path="/evaluar-desempeno"   element={<Placeholder title="Evaluar Desempeño" />} />
            <Route path="/evaluar-tutorados"   element={<Placeholder title="Evaluar Tutorados" />} />

            {/* Tutorado */}
            <Route path="/subir-evidencias" element={<Placeholder title="Subir Evidencias" />} />

            {/* Coordinador Institucional */}
            <Route path="/asignar-usuario"       element={<Placeholder title="Asignar Usuario" />} />
            <Route path="/registrar-actividades" element={<Placeholder title="Registrar Actividades" />} />

            {/* Compartida */}
            <Route path="/imprimir-acreditacion" element={<Placeholder title="Imprimir Acreditación" />} />
            <Route path="/consultar-tutorados"   element={<Placeholder title="Consultar Tutorados" />} />
            <Route path="/consultar-tutores"     element={<Placeholder title="Consultar Tutores" />} />

            {/* Coordinador Departamental */}
            <Route path="/asignar-tutorado" element={<Placeholder title="Asignar Tutorado" />} />

            {/* Jefe Departamento */}
            <Route path="/asignar-tutor" element={<Placeholder title="Asignar Tutor" />} />

            {/* Jefe Desarrollo Académico */}
            <Route path="/consultar-tutores-estrategico" element={<Placeholder title="Tutores — Vista Estratégica" />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}