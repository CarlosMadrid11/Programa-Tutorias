import { useState, useEffect, type FormEvent } from 'react'
import { useToast } from '../context/ToastContext'
import type { RolUsuario, EstadoRegistro } from '../types/database.types'
import {
  correoPersonalDesdeNombre,
  generarNumeroEmpleado,
  generarPasswordTemporal,
} from '../utils/usuarioHelpers'
import { gestionarUsuariosAdmin } from '../utils/gestionRpc'
import RefreshButton from '../components/RefreshButton'
import { IconSearch, IconClose } from '../components/icons'

interface PerfilRow {
  id: string
  nombre_completo: string
  correo_institucional: string
  rol: RolUsuario
  numero_empleado: string | null
  departamento: string | null
  carrera: string | null
  estado: EstadoRegistro
  primer_acceso: boolean
  password_temporal: string | null
  creado_en: string
}

const ROLES_DISPONIBLES: { value: RolUsuario; label: string }[] = [
  { value: 'tutor', label: 'Tutor' },
  { value: 'coordinador_departamental', label: 'Coordinador Departamental' },
  { value: 'jefe_departamento', label: 'Jefe de Departamento' },
  { value: 'jefe_desarrollo_academico', label: 'Jefe de Desarrollo Académico' },
  { value: 'director', label: 'Director' },
  { value: 'subdirector', label: 'Subdirector' },
]

const ROL_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  tutor: { bg: '#E1F5EE', color: '#085041', border: '#5DCAA5' },
  coordinador_institucional: { bg: '#EEEDFE', color: '#3C3489', border: '#AFA9EC' },
  coordinador_departamental: { bg: '#FEF3E2', color: '#7A3E00', border: '#F5A623' },
  jefe_departamento: { bg: '#FDE8F0', color: '#7A0033', border: '#E879A0' },
  jefe_desarrollo_academico: { bg: '#FDE8F0', color: '#7A0033', border: '#E879A0' },
  director: { bg: '#F1EFE8', color: '#3D3B34', border: '#B4B2A9' },
  subdirector: { bg: '#F1EFE8', color: '#3D3B34', border: '#B4B2A9' },
}

const ROL_LABELS: Record<string, string> = {
  coordinador_institucional: 'Coord. Institucional',
  coordinador_departamental: 'Coord. Departamental',
  jefe_departamento: 'Jefe Depto.',
  jefe_desarrollo_academico: 'Jefe Des. Académico',
  tutor: 'Tutor',
  director: 'Director',
  subdirector: 'Subdirector',
}

const emptyForm = {
  nombre: '',
  email: '',
  rol: 'tutor' as RolUsuario,
  departamento: '',
  carrera: '',
  numero_empleado: '',
  telefono: '',
}

const emptyEdit = { id: '', nombre: '', email: '', estado: 'activo' as EstadoRegistro }

export default function AsignarUsuario() {
  const { toast } = useToast()

  const [usuarios, setUsuarios] = useState<PerfilRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyEdit)
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function fetchUsuarios() {
    setLoading(true)
    const res = await gestionarUsuariosAdmin('listar')
    if (!res.ok) {
      toast.error('Error al cargar usuarios', res.error)
      setLoading(false)
      return
    }
    const list = (res.data?.usuarios as PerfilRow[] | undefined) ?? []
    setUsuarios(list)
    setLoading(false)
  }

  useEffect(() => { void fetchUsuarios() }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchUsuarios()
    setRefreshing(false)
  }

  function PasswordCell({ u }: { u: PerfilRow }) {
    if (!u.primer_acceso || !u.password_temporal) {
      return <span style={{ color: '#94a3b8' }}>—</span>
    }
    return (
      <code style={{ fontSize: '0.8rem', background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.45rem', borderRadius: 6, border: '1px solid #fde68a' }}>
        {u.password_temporal}
      </code>
    )
  }

  function abrirModalCrear() {
    const emp = generarNumeroEmpleado()
    setForm({ ...emptyForm, numero_empleado: emp })
    setModal(true)
  }

  function onNombreChange(nombre: string) {
    setForm((p) => ({
      ...p,
      nombre,
      email: nombre.trim().length >= 3 ? correoPersonalDesdeNombre(nombre) : p.email,
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const password = generarPasswordTemporal()
      const res = await gestionarUsuariosAdmin('crear', {
        nombre_completo: form.nombre,
        correo_institucional: form.email,
        rol: form.rol,
        numero_empleado: form.numero_empleado,
        departamento: form.departamento || null,
        carrera: form.carrera || null,
        telefono: form.telefono || null,
        password_temp: password,
      })
      if (!res.ok) {
        toast.error('No se pudo registrar', res.error)
        return
      }
      toast.success(
        'Usuario registrado exitosamente',
        `Contraseña temporal: ${(res.data?.password_temp as string) ?? password} — comunícala al usuario.`,
      )
      setModal(false)
      setForm(emptyForm)
      await fetchUsuarios()
    } finally {
      setSaving(false)
    }
  }

  function abrirEditar(u: PerfilRow) {
    setEditForm({
      id: u.id,
      nombre: u.nombre_completo,
      email: u.correo_institucional,
      estado: u.estado,
    })
    setEditModal(true)
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await gestionarUsuariosAdmin('actualizar', {
        perfil_id: editForm.id,
        nombre_completo: editForm.nombre,
        correo_institucional: editForm.email,
        estado: editForm.estado,
      })
      if (!res.ok) {
        toast.error('No se pudo actualizar', res.error)
        return
      }
      toast.success('Usuario actualizado correctamente')
      setEditModal(false)
      await fetchUsuarios()
    } finally {
      setSaving(false)
    }
  }

  const filtered = usuarios.filter(
    (u) =>
      u.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
      u.correo_institucional.toLowerCase().includes(search.toLowerCase()) ||
      (u.numero_empleado ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .au-wrap { font-family:'Inter',sans-serif; }
        .au-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:1.75rem; flex-wrap:wrap; gap:0.85rem; }
        .au-eyebrow { font-size:0.7rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:#64748b; margin:0 0 0.25rem; }
        .au-title { font-size:1.5rem; font-weight:900; color:#0f172a; margin:0; letter-spacing:-0.03em; }
        .au-sub { font-size:0.85rem; color:#64748b; margin:0.25rem 0 0; font-weight:500; }
        .btn-primary { display:inline-flex; align-items:center; gap:0.5rem; height:44px; padding:0 1.3rem; background:linear-gradient(135deg,#1d4ed8,#1e40af); color:#fff; border:none; border-radius:12px; font-size:0.875rem; font-weight:700; cursor:pointer; box-shadow:0 4px 14px rgba(29,78,216,0.3); }
        .btn-primary:hover { transform:translateY(-2px); }
        .btn-primary:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
        .search-wrap { position:relative; flex:1; max-width:360px; }
        .search-icon { position:absolute; left:0.85rem; top:50%; transform:translateY(-50%); color:#94a3b8; pointer-events:none; }
        .search-bar { width:100%; height:44px; border:1.5px solid #e2e8f0; border-radius:12px; padding:0 1rem 0 2.6rem; font-size:0.88rem; color:#0f172a; background:#fff; outline:none; font-family:inherit; }
        .search-bar:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }
        .au-toolbar { display:flex; gap:0.75rem; margin-bottom:1.25rem; flex-wrap:wrap; align-items:center; }
        .au-count { font-size:0.78rem; font-weight:600; color:#64748b; margin-left:auto; }
        .table-card { background:#fff; border:1px solid #e8edf4; border-radius:18px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.04); }
        table { width:100%; border-collapse:collapse; }
        thead tr { background:linear-gradient(90deg,#f8fafc,#f1f5f9); }
        thead th { padding:0.85rem 1.1rem; text-align:left; font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.09em; color:#64748b; border-bottom:1px solid #e8edf4; }
        tbody tr { border-bottom:1px solid #f1f5f9; }
        tbody tr:hover { background:#f8faff; }
        td { padding:0.95rem 1.1rem; font-size:0.875rem; color:#0f172a; vertical-align:middle; }
        .rol-badge { display:inline-flex; align-items:center; gap:5px; font-size:0.72rem; font-weight:700; padding:4px 10px; border-radius:20px; border:1px solid; }
        .rol-dot { width:6px; height:6px; border-radius:50%; background:currentColor; }
        .status-cell { display:inline-flex; align-items:center; gap:0.4rem; font-size:0.8rem; font-weight:600; }
        .status-dot { width:8px; height:8px; border-radius:50%; }
        .status-activo { background:#16a34a; }
        .status-inactivo { background:#94a3b8; }
        .btn-sm { height:32px; padding:0 0.75rem; font-size:0.76rem; font-weight:700; border-radius:9px; border:1.5px solid #e2e8f0; background:#fff; cursor:pointer; margin-right:0.35rem; font-family:inherit; }
        .btn-sm:hover { background:#eff6ff; border-color:#93c5fd; color:#1d4ed8; }
        .empty-state { padding:4rem 1rem; text-align:center; color:#94a3b8; }
        .modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.5); backdrop-filter:blur(8px); z-index:100; display:grid; place-items:center; padding:1rem; }
        .modal-card { background:#fff; border-radius:22px; padding:2rem; width:100%; max-width:540px; box-shadow:0 40px 80px rgba(29,78,216,0.2); }
        .modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; }
        .modal-title { font-size:1.15rem; font-weight:900; color:#0f172a; margin:0; }
        .modal-close { width:36px; height:36px; border-radius:10px; border:1px solid #e2e8f0; background:#f8fafc; cursor:pointer; }
        .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.9rem; }
        .field { display:flex; flex-direction:column; gap:0.35rem; }
        .field.full { grid-column:1/-1; }
        .field-label { font-size:0.72rem; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.08em; }
        .field-hint { font-size:0.72rem; color:#64748b; }
        .fi { height:44px; border:1.5px solid #e2e8f0; border-radius:11px; padding:0 0.9rem; font-size:0.88rem; color:#0f172a; background:#fff; outline:none; width:100%; font-family:inherit; }
        .fi:read-only { background:#f8fafc; color:#64748b; cursor:not-allowed; }
        .fi:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }
        .modal-actions { display:flex; justify-content:flex-end; gap:0.6rem; margin-top:1.5rem; }
        .btn-cancel { height:44px; padding:0 1.2rem; border:1.5px solid #e2e8f0; border-radius:11px; background:#fff; color:#475569; font-size:0.875rem; font-weight:600; cursor:pointer; font-family:inherit; }
        @media(max-width:640px){ .form-grid{grid-template-columns:1fr;} }
      `}</style>

      <div className="au-wrap">
        <div className="au-header">
          <div>
            <p className="au-eyebrow">Administración · CP-01</p>
            <h1 className="au-title">Gestión de Usuarios</h1>
            <p className="au-sub">Alta y edición de personal institucional (@itculiacan.edu.mx)</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <RefreshButton onClick={handleRefresh} loading={refreshing} />
            <button type="button" className="btn-primary" onClick={abrirModalCrear}>
              Nuevo usuario
            </button>
          </div>
        </div>

        <div className="au-toolbar">
          <div className="search-wrap">
            <span className="search-icon"><IconSearch size={15} /></span>
            <input
              className="search-bar"
              placeholder="Buscar por nombre, correo o No. empleado…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {!loading && (
            <span className="au-count">
              {filtered.length} usuario{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="table-card">
          {loading ? (
            <div className="empty-state">Cargando usuarios…</div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">No se encontraron usuarios</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>No. Empleado</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Contraseña temporal</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const rc = ROL_COLORS[u.rol] ?? { bg: '#f1f5f9', color: '#334155', border: '#e2e8f0' }
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 700 }}>{u.nombre_completo}</td>
                      <td style={{ color: '#475569', fontSize: '0.84rem' }}>{u.correo_institucional}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{u.numero_empleado ?? '—'}</td>
                      <td>
                        <span className="rol-badge" style={{ backgroundColor: rc.bg, color: rc.color, borderColor: rc.border }}>
                          <span className="rol-dot" />
                          {ROL_LABELS[u.rol] ?? u.rol}
                        </span>
                      </td>
                      <td>
                        <span className="status-cell">
                          <span className={`status-dot ${u.estado === 'activo' ? 'status-activo' : 'status-inactivo'}`} />
                          <span style={{ textTransform: 'capitalize' }}>{u.estado}</span>
                        </span>
                      </td>
                      <td><PasswordCell u={u} /></td>
                      <td>
                        <button type="button" className="btn-sm" onClick={() => abrirEditar(u)}>
                          Editar datos
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {modal && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(false) }}>
            <div className="modal-card">
              <div className="modal-header">
                <h2 className="modal-title">Registrar nuevo usuario</h2>
                <button type="button" className="modal-close" onClick={() => setModal(false)} aria-label="Cerrar"><IconClose /></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="field full">
                    <label className="field-label">Nombre completo *</label>
                    <input className="fi" required value={form.nombre} onChange={(e) => onNombreChange(e.target.value)} placeholder="Julián Hernández Robles" />
                  </div>
                  <div className="field full">
                    <label className="field-label">Correo institucional *</label>
                    <input className="fi" type="email" required readOnly value={form.email} />
                    <span className="field-hint">Se genera automáticamente con dominio @itculiacan.edu.mx</span>
                  </div>
                  <div className="field">
                    <label className="field-label">Rol *</label>
                    <select className="fi" required value={form.rol} onChange={(e) => setForm((p) => ({ ...p, rol: e.target.value as RolUsuario }))}>
                      {ROLES_DISPONIBLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">N° Empleado *</label>
                    <input className="fi" required readOnly value={form.numero_empleado} />
                    <span className="field-hint">Generado automáticamente (EMP-XXX)</span>
                  </div>
                  <div className="field">
                    <label className="field-label">Departamento</label>
                    <input className="fi" value={form.departamento} onChange={(e) => setForm((p) => ({ ...p, departamento: e.target.value }))} placeholder="Sistemas Computacionales" />
                  </div>
                  <div className="field">
                    <label className="field-label">Carrera</label>
                    <input className="fi" value={form.carrera} onChange={(e) => setForm((p) => ({ ...p, carrera: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="field-label">Teléfono</label>
                    <input className="fi" value={form.telefono} onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {editModal && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditModal(false) }}>
            <div className="modal-card">
              <div className="modal-header">
                <h2 className="modal-title">Editar datos del usuario</h2>
                <button type="button" className="modal-close" onClick={() => setEditModal(false)} aria-label="Cerrar"><IconClose /></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="form-grid">
                  <div className="field full">
                    <label className="field-label">Nombre completo *</label>
                    <input className="fi" required value={editForm.nombre} onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))} />
                  </div>
                  <div className="field full">
                    <label className="field-label">Correo institucional *</label>
                    <input className="fi" type="email" required value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="field full">
                    <label className="field-label">Estado *</label>
                    <select className="fi" required value={editForm.estado} onChange={(e) => setEditForm((p) => ({ ...p, estado: e.target.value as EstadoRegistro }))}>
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                      <option value="baja">Baja</option>
                    </select>
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={() => setEditModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Guardando…' : 'Actualizar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
