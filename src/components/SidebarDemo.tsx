import { useState } from 'react'
import { AuthContext } from '../context/authContextInstance'
import type { AuthState } from '../context/authContextInstance'
import Sidebar from './Sidebar'

// ─── Usuario falso ────────────────────────────────────────────────────────────
function makeFakeUser(rol: string, nombre: string) {
  return {
    id_sistema:           'demo-id',
    nombre,
    correo_institucional: `${rol}@itculiacan.edu.mx`,
    matricula_empleado:   '000000',
    contrasena:           '',
    telefono:             null,
    rol,
    departamento_carrera: null,
    activo:               true,
  }
}

// ─── Provider falso ───────────────────────────────────────────────────────────
function MockAuthProvider({ rol, nombre, children }: {
  rol: string
  nombre: string
  children: React.ReactNode
}) {
  const value: AuthState = {
    user:    makeFakeUser(rol, nombre),
    loading: false,
    logout:  async () => { alert('logout (demo)') },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ─── Tarjeta individual ───────────────────────────────────────────────────────
function SidebarCard({ rol, nombre, label }: { rol: string; nombre: string; label: string }) {
  const [open, setOpen] = useState(false)

  return (
    // Sin <BrowserRouter> aquí — el de AppRouter ya está activo
    <MockAuthProvider rol={rol} nombre={nombre}>
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px',
        background: '#f9fafb',
        minWidth: '220px',
      }}>
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>
          {label}
        </p>
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            background: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          Abrir sidebar →
        </button>

        <Sidebar isOpen={open} onClose={() => setOpen(false)} />
      </div>
    </MockAuthProvider>
  )
}

// ─── Página demo ──────────────────────────────────────────────────────────────
const DEMOS = [
  { rol: 'tutor',                    nombre: 'Prof. García',        label: 'tutor — CU: 5,6,7,13' },
  { rol: 'tutorado',                 nombre: 'Ana López',           label: 'tutorado — CU: 9' },
  { rol: 'coordinador_institucional',nombre: 'Coord. Institucional', label: 'coordinador_institucional — CU: 1,2,10' },
  { rol: 'coordinador_departamental',nombre: 'Coord. Depto.',        label: 'coordinador_departamental — CU: 4,10,12' },
  { rol: 'jefe_departamento',        nombre: 'Jefe Depto.',          label: 'jefe_departamento — CU: 3,10,11' },
  { rol: 'jefe_desarrollo_academico',nombre: 'Jefe Des. Acad.',      label: 'jefe_desarrollo_academico — CU: 12,14' },
  { rol: 'director',                 nombre: 'Director',             label: 'director — CU: 11' },
  { rol: 'subdirector',              nombre: 'Subdirector',          label: 'subdirector — CU: 11' },
]

export default function SidebarDemo() {
  return (
    <div style={{ padding: '32px', fontFamily: 'sans-serif', background: '#f3f4f6', minHeight: '100vh' }}>
      <h2 style={{ marginBottom: '8px', fontSize: '18px' }}>Demo — Sidebar por rol</h2>
      <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#6b7280' }}>
        Haz clic en cada tarjeta para abrir el sidebar de ese rol.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {DEMOS.map(d => (
          <SidebarCard key={d.rol} rol={d.rol} nombre={d.nombre} label={d.label} />
        ))}
      </div>
    </div>
  )
}