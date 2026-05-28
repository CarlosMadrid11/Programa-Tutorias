import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'          // ← hook separado
import { AuthProvider } from './context/AuthContext' // ← solo el provider

// ─── Páginas placeholder ──────────────────────────────────────────────────────
const Placeholder = ({ title }: { title: string }) => (
  <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
    <h2>📄 {title}</h2>
    <p style={{ color: '#888' }}>Página en construcción</p>
  </div>
)

// ─── Rutas permitidas por rol ─────────────────────────────────────────────────
const routesByRole: Record<string, string[]> = {
  tutor:                    ['/capturar-asistencia', '/evaluar-evidencias', '/evaluar-desempeno', '/evaluar-tutorados'],
  tutorado:                 ['/subir-evidencias'],
  coordinador_institucional:['/asignar-usuario', '/registrar-actividades', '/imprimir-acreditacion'],
  coordinador_departamental:['/asignar-tutorado', '/imprimir-acreditacion', '/consultar-tutorados'],
  jefe_departamento:        ['/asignar-tutor', '/imprimir-acreditacion', '/consultar-tutores'],
  jefe_desarrollo_academico:['/consultar-tutorados', '/consultar-tutores-estrategico'],
  director:                 ['/consultar-tutores'],
  subdirector:              ['/consultar-tutores'],
}

// ─── Guard de ruta ────────────────────────────────────────────────────────────
function ProtectedRoute({ children, path }: { children: React.ReactNode; path: string }) {
  const { user, loading } = useAuth()

  if (loading) return <div style={{ padding: '2rem' }}>Cargando...</div>
  if (!user)   return <Navigate to="/login" replace />

  const allowedRoutes = routesByRole[user.rol] ?? []
  if (!allowedRoutes.includes(path)) return <Navigate to="/no-autorizado" replace />

  return <>{children}</>
}

// ─── Router principal ─────────────────────────────────────────────────────────
export default function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/login"         element={<Placeholder title="Login" />} />
          <Route path="/no-autorizado" element={<Placeholder title="No autorizado" />} />

          {/* Tutor */}
          <Route path="/capturar-asistencia" element={<ProtectedRoute path="/capturar-asistencia"><Placeholder title="Capturar Asistencia" /></ProtectedRoute>} />
          <Route path="/evaluar-evidencias"  element={<ProtectedRoute path="/evaluar-evidencias"><Placeholder title="Evaluar Evidencias" /></ProtectedRoute>} />
          <Route path="/evaluar-desempeno"   element={<ProtectedRoute path="/evaluar-desempeno"><Placeholder title="Evaluar Desempeño" /></ProtectedRoute>} />
          <Route path="/evaluar-tutorados"   element={<ProtectedRoute path="/evaluar-tutorados"><Placeholder title="Evaluar Tutorados" /></ProtectedRoute>} />

          {/* Tutorado */}
          <Route path="/subir-evidencias" element={<ProtectedRoute path="/subir-evidencias"><Placeholder title="Subir Evidencias" /></ProtectedRoute>} />

          {/* Coordinador Institucional */}
          <Route path="/asignar-usuario"       element={<ProtectedRoute path="/asignar-usuario"><Placeholder title="Asignar Usuario" /></ProtectedRoute>} />
          <Route path="/registrar-actividades" element={<ProtectedRoute path="/registrar-actividades"><Placeholder title="Registrar Actividades" /></ProtectedRoute>} />

          {/* Compartida: Coord. Inst, Coord. Dept, Jefe Depto */}
          <Route path="/imprimir-acreditacion" element={<ProtectedRoute path="/imprimir-acreditacion"><Placeholder title="Imprimir Acreditación" /></ProtectedRoute>} />

          {/* Coordinador Departamental */}
          <Route path="/asignar-tutorado" element={<ProtectedRoute path="/asignar-tutorado"><Placeholder title="Asignar Tutorado" /></ProtectedRoute>} />

          {/* Compartida: Coord. Dept, Jefe Des. Académico */}
          <Route path="/consultar-tutorados" element={<ProtectedRoute path="/consultar-tutorados"><Placeholder title="Consultar Tutorados" /></ProtectedRoute>} />

          {/* Jefe Departamento */}
          <Route path="/asignar-tutor" element={<ProtectedRoute path="/asignar-tutor"><Placeholder title="Asignar Tutor" /></ProtectedRoute>} />

          {/* Compartida: Jefe Depto, Director, Subdirector */}
          <Route path="/consultar-tutores" element={<ProtectedRoute path="/consultar-tutores"><Placeholder title="Consultar Tutores" /></ProtectedRoute>} />

          {/* Jefe Desarrollo Académico */}
          <Route path="/consultar-tutores-estrategico" element={<ProtectedRoute path="/consultar-tutores-estrategico"><Placeholder title="Tutores — Vista Estratégica" /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}