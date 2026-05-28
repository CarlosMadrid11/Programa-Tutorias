import { useState, useEffect, type FormEvent } from 'react'
import { useToast } from '../context/ToastContext'
import { supabase } from '../utils/supabase'
import { createNoSessionClient } from '../utils/adminClient'
import type { RolUsuario } from '../types/database.types'
import { useAuth } from '../context/AuthContext'

interface PerfilRow {
  id: string
  nombre_completo: string
  correo_institucional: string
  rol: RolUsuario
  departamento: string | null
  carrera: string | null
  estado: string
  creado_en: string
}

const ROLES_DISPONIBLES: { value: RolUsuario; label: string }[] = [
  { value: 'tutor',                      label: 'Tutor' },
  { value: 'coordinador_departamental',  label: 'Coordinador Departamental' },
  { value: 'jefe_departamento',          label: 'Jefe de Departamento' },
  { value: 'jefe_desarrollo_academico',  label: 'Jefe de Desarrollo Académico' },
  { value: 'director',                   label: 'Director' },
  { value: 'subdirector',                label: 'Subdirector' },
]

const ROL_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  tutor:                      { bg: '#E1F5EE', color: '#085041', border: '#5DCAA5' },
  tutorado:                   { bg: '#E6F1FB', color: '#0C447C', border: '#85B7EB' },
  coordinador_institucional:  { bg: '#EEEDFE', color: '#3C3489', border: '#AFA9EC' },
  coordinador_departamental:  { bg: '#FEF3E2', color: '#7A3E00', border: '#F5A623' },
  jefe_departamento:          { bg: '#FDE8F0', color: '#7A0033', border: '#E879A0' },
  jefe_desarrollo_academico:  { bg: '#FDE8F0', color: '#7A0033', border: '#E879A0' },
  director:                   { bg: '#F1EFE8', color: '#3D3B34', border: '#B4B2A9' },
  subdirector:                { bg: '#F1EFE8', color: '#3D3B34', border: '#B4B2A9' },
}

const ROL_LABELS: Record<string, string> = {
  coordinador_institucional: 'Coord. Institucional',
  coordinador_departamental: 'Coord. Departamental',
  jefe_departamento:         'Jefe Depto.',
  jefe_desarrollo_academico: 'Jefe Des. Académico',
  tutor:       'Tutor',
  tutorado:    'Tutorado',
  director:    'Director',
  subdirector: 'Subdirector',
}

const empty = { nombre: '', email: '', rol: 'tutor' as RolUsuario, departamento: '', carrera: '', numero_empleado: '', telefono: '' }

export default function AsignarUsuario() {
  const { perfil: me } = useAuth()
  const { toast }      = useToast()

  const [usuarios, setUsuarios] = useState<PerfilRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState(empty)
  const [search, setSearch]     = useState('')

  async function fetchUsuarios() {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id,nombre_completo,correo_institucional,rol,departamento,carrera,estado,creado_en')
      .order('creado_en', { ascending: false })
    if (error) toast.error('Error al cargar usuarios', error.message)
    else setUsuarios((data ?? []) as PerfilRow[])
    setLoading(false)
  }

  useEffect(() => { fetchUsuarios() }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const tempPass = 'Sgpt' + Math.random().toString(36).slice(2, 8).toUpperCase() + '!'
      const tempClient = createNoSessionClient()
      const { data: authData, error: authErr } = await tempClient.auth.signUp({
        email: form.email,
        password: tempPass,
        options: {
          data: {
            rol: form.rol,
            nombre_completo: form.nombre,
            numero_empleado: form.numero_empleado || undefined,
            departamento: form.departamento || undefined,
            carrera: form.carrera || undefined,
            telefono: form.telefono || undefined,
          }
        }
      })
      if (authErr) { toast.error('Error al crear usuario', authErr.message); return }
      const userId = authData?.user?.id
      if (userId) {
        await supabase.from('perfiles').update({
          nombre_completo: form.nombre,
          departamento: form.departamento || null,
          carrera: form.carrera || null,
          numero_empleado: form.numero_empleado || null,
          telefono: form.telefono || null,
          creado_por: me?.id,
        }).eq('id', userId)
      }
      toast.success('Usuario creado', `Contraseña temporal: ${tempPass} — comunícala al usuario.`)
      setModal(false)
      setForm(empty)
      fetchUsuarios()
    } finally {
      setSaving(false)
    }
  }

  async function toggleEstado(u: PerfilRow) {
    const next = u.estado === 'activo' ? 'inactivo' : 'activo'
    const { error } = await supabase.from('perfiles').update({ estado: next }).eq('id', u.id)
    if (error) toast.error('Error', error.message)
    else { toast.success(`Usuario ${next === 'activo' ? 'activado' : 'desactivado'}`); fetchUsuarios() }
  }

  const filtered = usuarios.filter(u =>
    u.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
    u.correo_institucional.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .au-wrap { font-family:'Inter',sans-serif; }

        /* Header */
        .au-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:1.75rem; flex-wrap:wrap; gap:0.85rem; animation:fadeUp 0.4s ease both; }
        .au-title-group {}
        .au-eyebrow { font-size:0.7rem; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:#64748b; margin:0 0 0.25rem; }
        .au-title { font-size:1.5rem; font-weight:900; color:#0f172a; margin:0; letter-spacing:-0.03em; }
        .au-sub { font-size:0.85rem; color:#64748b; margin:0.25rem 0 0; font-weight:500; }

        /* Button */
        .btn-primary {
          display:inline-flex; align-items:center; gap:0.5rem;
          height:44px; padding:0 1.3rem;
          background:linear-gradient(135deg,#1d4ed8,#1e40af);
          color:#fff; border:none; border-radius:12px;
          font-size:0.875rem; font-weight:700; cursor:pointer;
          box-shadow:0 4px 14px rgba(29,78,216,0.3);
          transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.25s ease;
          white-space:nowrap;
        }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(29,78,216,0.35); }
        .btn-primary:active { transform:translateY(0); }

        /* Search */
        .search-wrap { position:relative; flex:1; max-width:360px; }
        .search-icon { position:absolute; left:0.85rem; top:50%; transform:translateY(-50%); color:#94a3b8; pointer-events:none; }
        .search-bar {
          width:100%; height:44px;
          border:1.5px solid #e2e8f0; border-radius:12px;
          padding:0 1rem 0 2.6rem; font-size:0.88rem; color:#0f172a;
          background:#fff; outline:none; transition:border-color 0.2s,box-shadow 0.2s;
          font-family:inherit;
        }
        .search-bar:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }

        /* Toolbar */
        .au-toolbar { display:flex; gap:0.75rem; margin-bottom:1.25rem; flex-wrap:wrap; animation:fadeUp 0.4s ease 0.05s both; }
        .au-count { display:inline-flex; align-items:center; gap:0.4rem; font-size:0.78rem; font-weight:600; color:#64748b; margin-left:auto; padding:0 0.5rem; }

        /* Table card */
        .table-card {
          background:#fff; border:1px solid #e8edf4; border-radius:18px;
          overflow:hidden;
          box-shadow:0 4px 24px rgba(0,0,0,0.04);
          animation:fadeUp 0.4s ease 0.1s both;
        }
        table { width:100%; border-collapse:collapse; }
        thead tr { background:linear-gradient(90deg,#f8fafc,#f1f5f9); }
        thead th {
          padding:0.85rem 1.1rem; text-align:left;
          font-size:0.7rem; font-weight:800; text-transform:uppercase;
          letter-spacing:0.09em; color:#64748b;
          border-bottom:1px solid #e8edf4;
        }
        tbody tr { border-bottom:1px solid #f1f5f9; transition:background 0.15s; }
        tbody tr:last-child { border-bottom:none; }
        tbody tr:hover { background:#f8faff; }
        td { padding:0.95rem 1.1rem; font-size:0.875rem; color:#0f172a; vertical-align:middle; }

        /* Rol badge */
        .rol-badge {
          display:inline-flex; align-items:center; gap:5px;
          font-size:0.72rem; font-weight:700; padding:4px 10px;
          border-radius:20px; border:1px solid;
          white-space:nowrap;
        }
        .rol-dot { width:6px; height:6px; border-radius:50%; background:currentColor; }

        /* Status */
        .status-cell { display:inline-flex; align-items:center; gap:0.4rem; font-size:0.8rem; font-weight:600; }
        .status-dot { width:8px; height:8px; border-radius:50%; }
        .status-activo   { background:#16a34a; box-shadow:0 0 0 3px rgba(22,163,74,0.15); }
        .status-inactivo { background:#94a3b8; }

        /* Actions */
        .btn-toggle {
          height:32px; padding:0 0.85rem;
          font-size:0.76rem; font-weight:700; border-radius:9px;
          border:1.5px solid #e2e8f0; background:#fff; cursor:pointer;
          transition:all 0.22s cubic-bezier(0.4,0,0.2,1); color:#334155;
          font-family:inherit;
        }
        .btn-toggle:hover { background:#eff6ff; border-color:#93c5fd; color:#1d4ed8; transform:translateY(-1px); }

        /* Empty state */
        .empty-state {
          padding:4rem 1rem; text-align:center;
        }
        .empty-icon { font-size:2.5rem; margin-bottom:0.5rem; }
        .empty-text { color:#94a3b8; font-size:0.9rem; font-weight:500; }

        /* Modal */
        .modal-overlay {
          position:fixed; inset:0;
          background:rgba(15,23,42,0.5); backdrop-filter:blur(8px);
          z-index:100; display:grid; place-items:center; padding:1rem;
        }
        .modal-card {
          background:#fff; border-radius:22px; padding:2rem;
          width:100%; max-width:540px;
          box-shadow:0 40px 80px rgba(29,78,216,0.2);
          animation:modalIn 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes modalIn { from{opacity:0;transform:translateY(20px) scale(0.96)} to{opacity:1;transform:none} }
        .modal-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; }
        .modal-title { font-size:1.15rem; font-weight:900; color:#0f172a; margin:0; }
        .modal-close {
          width:36px; height:36px; border-radius:10px; border:1px solid #e2e8f0;
          background:#f8fafc; color:#64748b; cursor:pointer; display:flex;
          align-items:center; justify-content:center; transition:all 0.2s;
        }
        .modal-close:hover { background:#fee2e2; border-color:#fecaca; color:#dc2626; }
        .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.9rem; }
        .field { display:flex; flex-direction:column; gap:0.35rem; }
        .field.full { grid-column:1/-1; }
        .field-label { font-size:0.72rem; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.08em; }
        .fi {
          height:44px; border:1.5px solid #e2e8f0; border-radius:11px;
          padding:0 0.9rem; font-size:0.88rem; color:#0f172a; background:#fff;
          outline:none; width:100%; transition:border-color 0.2s,box-shadow 0.2s;
          font-family:inherit;
        }
        .fi:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }
        .modal-actions { display:flex; justify-content:flex-end; gap:0.6rem; margin-top:1.5rem; }
        .btn-cancel {
          height:44px; padding:0 1.2rem; border:1.5px solid #e2e8f0;
          border-radius:11px; background:#fff; color:#475569;
          font-size:0.875rem; font-weight:600; cursor:pointer;
          transition:all 0.2s; font-family:inherit;
        }
        .btn-cancel:hover { background:#f1f5f9; border-color:#cbd5e1; }

        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @media(max-width:640px){
          .form-grid{grid-template-columns:1fr;}
          thead th:nth-child(4),td:nth-child(4),thead th:nth-child(3),td:nth-child(3){display:none;}
        }
      `}</style>

      <div className="au-wrap">
        <div className="au-header">
          <div className="au-title-group">
            <p className="au-eyebrow">Administración</p>
            <h1 className="au-title">Gestión de Usuarios</h1>
            <p className="au-sub">Alta y administración de cuentas institucionales</p>
          </div>
          <button className="btn-primary" onClick={() => setModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo usuario
          </button>
        </div>

        <div className="au-toolbar">
          <div className="search-wrap">
            <span className="search-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input
              className="search-bar"
              placeholder="Buscar por nombre o correo…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {!loading && <span className="au-count">{filtered.length} usuario{filtered.length !== 1 ? 's' : ''}</span>}
        </div>

        <div className="table-card">
          {loading ? (
            <div className="empty-state"><div className="empty-icon">⏳</div><div className="empty-text">Cargando usuarios…</div></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🔍</div><div className="empty-text">No se encontraron usuarios</div></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Departamento</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const rc = ROL_COLORS[u.rol] ?? { bg: '#f1f5f9', color: '#334155', border: '#e2e8f0' }
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 700 }}>{u.nombre_completo}</td>
                      <td style={{ color: '#475569', fontSize: '0.84rem' }}>{u.correo_institucional}</td>
                      <td>
                        <span className="rol-badge" style={{ backgroundColor: rc.bg, color: rc.color, borderColor: rc.border }}>
                          <span className="rol-dot"/>
                          {ROL_LABELS[u.rol] ?? u.rol}
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '0.84rem' }}>{u.departamento ?? '—'}</td>
                      <td>
                        <span className="status-cell">
                          <span className={`status-dot ${u.estado === 'activo' ? 'status-activo' : 'status-inactivo'}`}/>
                          <span style={{ textTransform: 'capitalize', color: u.estado === 'activo' ? '#059669' : '#94a3b8' }}>{u.estado}</span>
                        </span>
                      </td>
                      <td>
                        <button className="btn-toggle" onClick={() => toggleEstado(u)}>
                          {u.estado === 'activo' ? 'Desactivar' : 'Activar'}
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
          <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
            <div className="modal-card">
              <div className="modal-header">
                <h2 className="modal-title">Registrar nuevo usuario</h2>
                <button className="modal-close" onClick={() => setModal(false)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="field full">
                    <label className="field-label">Nombre completo *</label>
                    <input className="fi" required value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre y apellidos" />
                  </div>
                  <div className="field full">
                    <label className="field-label">Correo institucional *</label>
                    <input className="fi" type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="usuario@culiacan.tecnm.mx" />
                  </div>
                  <div className="field">
                    <label className="field-label">Rol *</label>
                    <select className="fi" required value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value as RolUsuario }))}>
                      {ROLES_DISPONIBLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">N° Empleado *</label>
                    <input className="fi" required value={form.numero_empleado} onChange={e => setForm(p => ({ ...p, numero_empleado: e.target.value }))} placeholder="Ej. EMP-1234" />
                  </div>
                  <div className="field">
                    <label className="field-label">Departamento</label>
                    <input className="fi" value={form.departamento} onChange={e => setForm(p => ({ ...p, departamento: e.target.value }))} placeholder="Sistemas Computacionales" />
                  </div>
                  <div className="field">
                    <label className="field-label">Carrera</label>
                    <input className="fi" value={form.carrera} onChange={e => setForm(p => ({ ...p, carrera: e.target.value }))} placeholder="Ingeniería en Sistemas" />
                  </div>
                  <div className="field">
                    <label className="field-label">Teléfono</label>
                    <input className="fi" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} placeholder="667 000 0000" />
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Guardando…' : 'Crear usuario'}
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
