import { useState, useEffect, type FormEvent } from 'react'
import { useToast } from '../context/ToastContext'
import type { EstadoRegistro } from '../types/database.types'
import { correoTutoradoDesdeControl, generarPasswordTemporal } from '../utils/usuarioHelpers'
import { gestionarTutorados, gestionarGrupoTutor, gestionarSesionesGrupo } from '../utils/gestionRpc'
import RefreshButton from '../components/RefreshButton'
import PremiumTable from '../components/PremiumTable'
import ConfirmModal from '../components/ConfirmModal'
import { IconUsers, IconClose } from '../components/icons'
import {
  MAX_SESIONES_SEMESTRE,
  buildSesionesPayload,
  generarFechasSemanales,
  validarSesionesFrontend,
} from '../utils/sesionesSemestre'

interface TutoradoRow {
  id: string
  nombre_completo: string
  correo_institucional: string
  numero_control: string | null
  carrera: string | null
  estado: EstadoRegistro
  primer_acceso: boolean
  password_temporal: string | null
  creado_en: string
  asignacion_id?: string | null
  grupo_codigo?: string | null
  grupo_carrera?: string | null
  grupo_dia?: string | null
  grupo_hora?: string | null
  en_grupo?: boolean
}

interface GrupoRow {
  id: string
  carrera: string
  grupo: string
  dia_semana: string
  hora_inicio: string
  hora_fin: string
  salon: string
  cupo_maximo: number
  tutorados_asignados: number
  cupo_disponible: number
  sesiones_planificadas?: boolean
  total_sesiones?: number
}

interface ActividadOpt {
  id: string
  nombre: string
}

interface SesionEdit {
  id: string
  numero_sesion: number
  fecha_realizada: string
  actividad_pt_id: string
  fecha_limite_grupo: string
}

type ConfirmState =
  | { type: 'desasignar'; tutoradoId: string; nombre: string }
  | { type: 'eliminar_grupo'; grupoId: string; nombre: string }
  | null

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const emptyForm = { nombre: '', numero_control: '', carrera: '', telefono: '', email: '', asignacion_id: '' }
const emptyGrupo = { carrera: '', grupo: '', dia_semana: 'Lunes', hora_inicio: '08:00', salon: '', semestre_generacional: '' }
const emptyEdit = { id: '', nombre: '', email: '', estado: 'activo' as EstadoRegistro }

function labelGrupo(g: GrupoRow) {
  return `${g.carrera} · Gpo ${g.grupo} · ${g.dia_semana} ${String(g.hora_inicio).slice(0, 5)} (${g.tutorados_asignados}/${g.cupo_maximo})`
}

export default function GestionarTutorados() {
  const { toast } = useToast()

  const [tutorados, setTutorados] = useState<TutoradoRow[]>([])
  const [grupos, setGrupos] = useState<GrupoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [grupoModal, setGrupoModal] = useState(false)
  const [asignarModal, setAsignarModal] = useState<{ id: string; nombre: string } | null>(null)
  const [editModal, setEditModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [grupoForm, setGrupoForm] = useState(emptyGrupo)
  const [asignarGrupoId, setAsignarGrupoId] = useState('')
  const [editForm, setEditForm] = useState(emptyEdit)
  const [search, setSearch] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [fechaInicioSemestre, setFechaInicioSemestre] = useState('')
  const [fechasSesiones, setFechasSesiones] = useState<string[]>(Array(MAX_SESIONES_SEMESTRE).fill(''))
  const [actividadesPorSesion, setActividadesPorSesion] = useState<Record<number, string>>({})
  const [limitesPorSesion, setLimitesPorSesion] = useState<Record<number, string>>({})
  const [actividadesOpts, setActividadesOpts] = useState<ActividadOpt[]>([])
  const [editGrupoModal, setEditGrupoModal] = useState(false)
  const [editGrupoId, setEditGrupoId] = useState('')
  const [sesionesEdit, setSesionesEdit] = useState<SesionEdit[]>([])
  const [confirm, setConfirm] = useState<ConfirmState>(null)

  async function fetchAll() {
    setLoading(true)
    const [res, gruposRes] = await Promise.all([
      gestionarTutorados('listar'),
      gestionarGrupoTutor('listar_grupos'),
    ])
    if (!res.ok) toast.error('Error al cargar tutorados', res.error)
    else setTutorados((res.data?.tutorados as TutoradoRow[]) ?? [])
    if (!gruposRes.ok) toast.error('Error al cargar grupos', gruposRes.error)
    else setGrupos((gruposRes.data?.grupos as GrupoRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { void fetchAll() }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }

  function onControlChange(numeroControl: string) {
    const ctrl = numeroControl.trim()
    setForm((p) => ({
      ...p,
      numero_control: ctrl,
      email: ctrl.length >= 4 ? correoTutoradoDesdeControl(ctrl) : '',
    }))
  }

  function abrirModalGrupo() {
    setGrupoForm(emptyGrupo)
    const hoy = new Date().toISOString().slice(0, 10)
    setFechaInicioSemestre(hoy)
    setFechasSesiones(generarFechasSemanales(hoy))
    setActividadesPorSesion({})
    setLimitesPorSesion({})
    setGrupoModal(true)
    void gestionarSesionesGrupo('listar_actividades', {}).then((r) => {
      if (r.ok) setActividadesOpts((r.data?.actividades as ActividadOpt[]) ?? [])
    })
  }

  function onFechaInicioChange(fecha: string) {
    setFechaInicioSemestre(fecha)
    setFechasSesiones(generarFechasSemanales(fecha))
  }

  async function handleCrearGrupo(e: FormEvent) {
    e.preventDefault()
    const err = validarSesionesFrontend(fechasSesiones)
    if (err) {
      toast.warning(err)
      return
    }
    setSaving(true)
    const sesiones = buildSesionesPayload(fechasSesiones, actividadesPorSesion, limitesPorSesion)
    const res = await gestionarGrupoTutor('crear_grupo', {
      carrera: grupoForm.carrera,
      grupo: grupoForm.grupo,
      dia_semana: grupoForm.dia_semana,
      hora_inicio: grupoForm.hora_inicio,
      salon: grupoForm.salon || 'Por asignar',
      semestre_generacional: grupoForm.semestre_generacional || grupoForm.grupo,
      sesiones,
    })
    if (!res.ok) toast.error('No se pudo crear el grupo', res.error)
    else {
      toast.success('Grupo creado con 8 sesiones semanales')
      setGrupoModal(false)
      setGrupoForm(emptyGrupo)
      await fetchAll()
    }
    setSaving(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const password = generarPasswordTemporal()
      const payload: Record<string, unknown> = {
        nombre_completo: form.nombre,
        numero_control: form.numero_control,
        carrera: form.carrera || null,
        telefono: form.telefono || null,
        password_temp: password,
      }
      if (form.asignacion_id) {
        payload.asignacion_id = form.asignacion_id
        payload.asignar_grupo = true
      }
      const res = await gestionarTutorados('crear', payload)
      if (!res.ok) {
        toast.error('No se pudo registrar tutorado', res.error)
        return
      }
      const extra = res.data?.asignado_grupo ? ' Asignado al grupo seleccionado.' : ' Sin asignar a grupo (puedes asignarlo después).'
      toast.success(
        'Tutorado registrado',
        `Correo: ${res.data?.correo as string} · Contraseña: ${(res.data?.password_temp as string) ?? password}${extra}`,
      )
      setModal(false)
      setForm(emptyForm)
      await fetchAll()
    } finally {
      setSaving(false)
    }
  }

  async function handleAsignarGrupo() {
    if (!asignarModal || !asignarGrupoId) return
    setSaving(true)
    const res = await gestionarGrupoTutor('asignar_tutorado', {
      tutorado_id: asignarModal.id,
      asignacion_id: asignarGrupoId,
    })
    if (!res.ok) toast.error('No se pudo asignar', res.error)
    else {
      toast.success('Tutorado asignado al grupo')
      setAsignarModal(null)
      setAsignarGrupoId('')
      await fetchAll()
    }
    setSaving(false)
  }

  async function abrirEditarGrupo(g: GrupoRow) {
    setEditGrupoId(g.id)
    setSaving(false)
    void gestionarSesionesGrupo('listar_actividades', {}).then((r) => {
      if (r.ok) setActividadesOpts((r.data?.actividades as ActividadOpt[]) ?? [])
    })
    const det = await gestionarGrupoTutor('obtener_detalle', { asignacion_id: g.id })
    if (!det.ok) {
      toast.error('No se pudo cargar el grupo', det.error)
      return
    }
    const gr = det.data?.grupo as Record<string, string>
    setGrupoForm({
      carrera: gr.carrera ?? '',
      grupo: gr.grupo ?? '',
      dia_semana: gr.dia_semana ?? 'Lunes',
      hora_inicio: String(gr.hora_inicio ?? '08:00').slice(0, 5),
      salon: gr.salon ?? '',
      semestre_generacional: gr.semestre_generacional ?? '',
    })
    const ses = (det.data?.sesiones as SesionEdit[]) ?? []
    setSesionesEdit(ses.map((s) => {
      const row = s as SesionEdit & { fecha_limite_grupo?: string | null }
      return {
        id: row.id,
        numero_sesion: row.numero_sesion,
        fecha_realizada: String(row.fecha_realizada).slice(0, 10),
        actividad_pt_id: row.actividad_pt_id ?? '',
        fecha_limite_grupo: row.fecha_limite_grupo ? String(row.fecha_limite_grupo).slice(0, 10) : '',
      }
    }))
    setEditGrupoModal(true)
  }

  async function handleActualizarGrupo(e: FormEvent) {
    e.preventDefault()
    const err = validarSesionesFrontend(sesionesEdit.map((s) => s.fecha_realizada))
    if (err) {
      toast.warning(err)
      return
    }
    setSaving(true)
    const res = await gestionarGrupoTutor('actualizar_grupo', {
      asignacion_id: editGrupoId,
      carrera: grupoForm.carrera,
      grupo: grupoForm.grupo,
      dia_semana: grupoForm.dia_semana,
      hora_inicio: grupoForm.hora_inicio,
      salon: grupoForm.salon,
      semestre_generacional: grupoForm.semestre_generacional,
      sesiones: sesionesEdit.map((s) => ({
        id: s.id,
        fecha_realizada: s.fecha_realizada,
        actividad_pt_id: s.actividad_pt_id || null,
        fecha_limite_grupo: s.fecha_limite_grupo || null,
      })),
    })
    if (!res.ok) toast.error('No se pudo actualizar', res.error)
    else {
      toast.success('Grupo actualizado')
      setEditGrupoModal(false)
      await fetchAll()
    }
    setSaving(false)
  }

  async function ejecutarConfirm() {
    if (!confirm) return
    setSaving(true)
    if (confirm.type === 'desasignar') {
      const res = await gestionarGrupoTutor('desasignar', { tutorado_id: confirm.tutoradoId })
      if (!res.ok) toast.error('No se pudo desasignar', res.error)
      else {
        toast.success('Tutorado desasignado del grupo')
        await fetchAll()
      }
    }
    if (confirm.type === 'eliminar_grupo') {
      const res = await gestionarGrupoTutor('eliminar_grupo', { asignacion_id: confirm.grupoId })
      if (!res.ok) toast.error('No se pudo eliminar', res.error)
      else {
        toast.success('Grupo eliminado')
        await fetchAll()
      }
    }
    setConfirm(null)
    setSaving(false)
  }

  function abrirEditar(t: TutoradoRow) {
    setEditForm({ id: t.id, nombre: t.nombre_completo, email: t.correo_institucional, estado: t.estado })
    setEditModal(true)
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await gestionarTutorados('actualizar', {
        perfil_id: editForm.id,
        nombre_completo: editForm.nombre,
        correo_institucional: editForm.email,
        estado: editForm.estado,
      })
      if (!res.ok) {
        toast.error('No se pudo actualizar', res.error)
        return
      }
      toast.success('Tutorado actualizado')
      setEditModal(false)
      await fetchAll()
    } finally {
      setSaving(false)
    }
  }

  const filtered = tutorados.filter((t) => {
    const q = search.toLowerCase()
    const matchSearch =
      t.nombre_completo.toLowerCase().includes(q) ||
      (t.numero_control ?? '').includes(search) ||
      t.correo_institucional.toLowerCase().includes(q)
    const matchGrupo =
      !filtroGrupo ||
      (filtroGrupo === '__sin__' ? !t.en_grupo : t.asignacion_id === filtroGrupo)
    return matchSearch && matchGrupo
  })

  const grupoSeleccionado = grupos.find((g) => g.id === form.asignacion_id)
  const cupoGrupoSel = grupoSeleccionado?.cupo_disponible ?? 0

  return (
    <>
      <style>{`
        .gt-wrap { font-family:'Inter',sans-serif; }
        .gt-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem; }
        .gt-title { font-size:1.35rem; font-weight:900; color:#0f172a; margin:0; }
        .gt-sub { font-size:0.85rem; color:#64748b; margin:0.2rem 0 0; }
        .btn-p { height:42px; padding:0 1.1rem; background:#1d4ed8; color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer; font-size:0.85rem; }
        .btn-p:disabled { opacity:0.6; cursor:not-allowed; }
        .btn-o { height:42px; padding:0 1rem; background:#fff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:10px; font-weight:700; cursor:pointer; font-size:0.85rem; }
        .grupos-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:0.85rem; margin-bottom:1.25rem; }
        .grupo-card { background:linear-gradient(145deg,#fff 0%,#f8fbff 100%); border:1px solid #dbeafe; border-radius:16px; padding:1.1rem 1.15rem; box-shadow:0 8px 24px rgba(29,78,216,0.06); transition:transform 0.15s, box-shadow 0.15s; }
        .grupo-card:hover { transform:translateY(-2px); box-shadow:0 12px 28px rgba(29,78,216,0.1); }
        .grupo-card h3 { margin:0 0 0.35rem; font-size:0.95rem; font-weight:800; color:#1e3a8a; }
        .grupo-meta { font-size:0.78rem; color:#64748b; line-height:1.5; }
        .grupo-tags { display:flex; gap:0.35rem; flex-wrap:wrap; margin-top:0.65rem; }
        .grupo-tag { font-size:0.68rem; font-weight:700; padding:3px 8px; border-radius:8px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; }
        .grupo-tag.ok { background:#f0fdf4; color:#166534; border-color:#bbf7d0; }
        .grupo-tag.warn { background:#fffbeb; color:#92400e; border-color:#fde68a; }
        .grupo-actions { display:flex; gap:0.4rem; margin-top:0.9rem; padding-top:0.8rem; border-top:1px solid rgba(29,78,216,0.1); }
        .btn-grp { flex:1; height:34px; border-radius:9px; font-size:0.74rem; font-weight:700; cursor:pointer; border:1px solid; }
        .btn-grp-edit { background:#fff; color:#1d4ed8; border-color:#bfdbfe; }
        .btn-grp-del { background:#fff; color:#b91c1c; border-color:#fecaca; }
        .sesiones-panel { margin-top:0.75rem; background:linear-gradient(180deg,#f8fafc,#fff); border:1px solid #e2e8f0; border-radius:14px; padding:0.65rem; max-height:340px; overflow-y:auto; }
        .sesiones-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:0.55rem; }
        .sesion-row { background:#fff; border:1px solid #e8eef5; border-radius:12px; padding:0.55rem 0.6rem; display:flex; flex-direction:column; gap:0.3rem; }
        .sesion-row label { font-size:0.62rem; font-weight:800; color:#1e40af; text-transform:uppercase; letter-spacing:0.04em; }
        .sesion-row input, .sesion-row select { height:34px; font-size:0.78rem; border:1px solid #e2e8f0; border-radius:8px; padding:0 0.45rem; background:#fff; }
        .modal-c.wide { max-width:720px; }
        .modal-premium .modal-head-bar { background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 100%); margin:-1.5rem -1.5rem 1rem; padding:1.15rem 1.5rem; color:#fff; border-radius:16px 16px 0 0; }
        .modal-premium .modal-head-bar h2 { margin:0; font-size:1.05rem; font-weight:800; color:#fff; }
        .modal-premium .modal-head-bar p { margin:0.25rem 0 0; font-size:0.76rem; opacity:0.88; }
        .toolbar { display:flex; gap:0.65rem; flex-wrap:wrap; margin-bottom:1rem; align-items:center; }
        .fi { height:42px; width:100%; border:1px solid #e2e8f0; border-radius:10px; padding:0 0.85rem; font-size:0.88rem; }
        .fi:read-only { background:#f8fafc; color:#64748b; }
        .field { margin-bottom:0.85rem; }
        .lbl { font-size:0.72rem; font-weight:700; color:#334155; text-transform:uppercase; display:block; margin-bottom:0.3rem; }
        .hint { font-size:0.72rem; color:#64748b; }
        .modal-o { position:fixed; inset:0; background:rgba(15,23,42,0.45); z-index:100; display:grid; place-items:center; padding:1rem; }
        .modal-c { background:#fff; border-radius:16px; padding:1.5rem; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; }
        .modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }
        .modal-header h2 { margin:0; font-size:1.1rem; }
        .btn-s { height:36px; padding:0 0.7rem; border:1px solid #e2e8f0; border-radius:8px; background:#fff; cursor:pointer; font-size:0.78rem; font-weight:600; }
        .search { height:40px; border:1px solid #e2e8f0; border-radius:10px; padding:0 0.85rem; min-width:220px; }
        .select-f { height:40px; border:1px solid #e2e8f0; border-radius:10px; padding:0 0.75rem; font-size:0.85rem; }
        .tag-grupo { display:inline-block; font-size:0.72rem; font-weight:700; padding:3px 8px; border-radius:8px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; }
        .tag-sin { font-size:0.72rem; color:#94a3b8; }
        .modal-close { width:36px; height:36px; border:none; background:#f1f5f9; border-radius:10px; cursor:pointer; display:grid; place-items:center; }
      `}</style>

      <div className="gt-wrap">
        <div className="gt-header">
          <div>
            <h1 className="gt-title">Registrar tutorados</h1>
            <p className="gt-sub">Alta general · Asignación a un solo grupo por semestre · Máx. 25 por grupo</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <RefreshButton onClick={handleRefresh} loading={refreshing} />
            <button type="button" className="btn-o" onClick={abrirModalGrupo}>
              Nuevo grupo
            </button>
            <button type="button" className="btn-p" onClick={() => { setForm({ ...emptyForm, asignacion_id: grupos[0]?.id ?? '' }); setModal(true) }}>
              Nuevo tutorado
            </button>
          </div>
        </div>

        <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#334155', margin: '0 0 0.65rem' }}>Mis grupos</h2>
        {grupos.length === 0 ? (
          <p style={{ fontSize: '0.86rem', color: '#94a3b8', marginBottom: '1.25rem' }}>Crea un grupo tutorial para asignar horario y tutorados.</p>
        ) : (
          <div className="grupos-grid">
            {grupos.map((g) => (
              <div key={g.id} className="grupo-card">
                <h3>{g.carrera} — Grupo {g.grupo}</h3>
                <div className="grupo-meta">
                  {g.dia_semana} · {String(g.hora_inicio).slice(0, 5)} – {String(g.hora_fin).slice(0, 5)}
                  <br />Salón: {g.salon}
                </div>
                <div className="grupo-tags">
                  <span className="grupo-tag"><IconUsers size={11} /> {g.tutorados_asignados}/{g.cupo_maximo}</span>
                  <span className={`grupo-tag ${g.sesiones_planificadas ? 'ok' : 'warn'}`}>
                    {g.sesiones_planificadas ? `${g.total_sesiones ?? 8} sesiones` : 'Sin sesiones'}
                  </span>
                </div>
                <div className="grupo-actions">
                  <button type="button" className="btn-grp btn-grp-edit" onClick={() => void abrirEditarGrupo(g)}>Editar</button>
                  <button
                    type="button"
                    className="btn-grp btn-grp-del"
                    onClick={() => setConfirm({ type: 'eliminar_grupo', grupoId: g.id, nombre: `${g.carrera} — ${g.grupo}` })}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="toolbar">
          <input className="search" placeholder="Buscar nombre o matrícula…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="select-f" value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}>
            <option value="">Todos los tutorados</option>
            <option value="__sin__">Sin grupo</option>
            {grupos.map((g) => <option key={g.id} value={g.id}>{labelGrupo(g)}</option>)}
          </select>
        </div>

        <PremiumTable
          loading={loading}
          emptyMessage="Sin tutorados visibles para ti"
          data={filtered}
          rowKey={(t) => t.id}
          columns={[
            { key: 'nom', header: 'Nombre', render: (t) => <span style={{ fontWeight: 700 }}>{t.nombre_completo}</span> },
            { key: 'ctrl', header: 'Matrícula', render: (t) => <span style={{ fontFamily: 'monospace' }}>{t.numero_control}</span> },
            {
              key: 'grupo',
              header: 'Grupo / Horario',
              render: (t) => t.en_grupo && t.grupo_codigo ? (
                <span className="tag-grupo">{t.grupo_carrera} · {t.grupo_codigo} · {t.grupo_dia} {String(t.grupo_hora ?? '').slice(0, 5)}</span>
              ) : <span className="tag-sin">Sin asignar</span>,
            },
            { key: 'est', header: 'Estado', render: (t) => <span style={{ textTransform: 'capitalize' }}>{t.estado}</span> },
            {
              key: 'pwd',
              header: 'Contraseña temp.',
              render: (t) => t.primer_acceso && t.password_temporal ? (
                <code style={{ fontSize: '0.78rem', background: '#fef3c7', color: '#92400e', padding: '0.15rem 0.4rem', borderRadius: 6 }}>{t.password_temporal}</code>
              ) : <span style={{ color: '#94a3b8' }}>—</span>,
            },
            {
              key: 'acc',
              header: 'Acciones',
              align: 'right',
              render: (t) => (
                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-s" onClick={() => abrirEditar(t)}>Editar</button>
                  {!t.en_grupo ? (
                    <button type="button" className="btn-s" onClick={() => { setAsignarModal({ id: t.id, nombre: t.nombre_completo }); setAsignarGrupoId(grupos[0]?.id ?? '') }}>Asignar grupo</button>
                  ) : (
                    <button
                      type="button"
                      className="btn-s"
                      style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                      onClick={() => setConfirm({ type: 'desasignar', tutoradoId: t.id, nombre: t.nombre_completo })}
                    >
                      Quitar grupo
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />

        {modal && (
          <div className="modal-o" onClick={(e) => { if (e.target === e.currentTarget) setModal(false) }}>
            <div className="modal-c">
              <div className="modal-header">
                <h2>Alta de tutorado</h2>
                <button type="button" className="modal-close" onClick={() => setModal(false)} aria-label="Cerrar"><IconClose /></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label className="lbl">Nombre completo *</label>
                  <input className="fi" required value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="lbl">Matrícula *</label>
                  <input className="fi" required value={form.numero_control} onChange={(e) => onControlChange(e.target.value)} />
                </div>
                <div className="field">
                  <label className="lbl">Correo</label>
                  <input className="fi" readOnly value={form.email} />
                </div>
                <div className="field">
                  <label className="lbl">Carrera</label>
                  <input className="fi" value={form.carrera} onChange={(e) => setForm((p) => ({ ...p, carrera: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="lbl">Teléfono</label>
                  <input className="fi" value={form.telefono} onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="lbl">Asignar a grupo (opcional)</label>
                  <select className="fi" value={form.asignacion_id} onChange={(e) => setForm((p) => ({ ...p, asignacion_id: e.target.value }))}>
                    <option value="">Solo registrar (sin grupo)</option>
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id} disabled={g.cupo_disponible <= 0}>{labelGrupo(g)}</option>
                    ))}
                  </select>
                  {form.asignacion_id && cupoGrupoSel <= 0 && (
                    <span className="hint" style={{ color: '#b91c1c' }}>Este grupo está lleno.</span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button type="button" className="btn-s" onClick={() => setModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-p" disabled={saving || (!!form.asignacion_id && cupoGrupoSel <= 0)}>{saving ? 'Guardando…' : 'Guardar'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {grupoModal && (
          <div className="modal-o" onClick={(e) => { if (e.target === e.currentTarget) setGrupoModal(false) }}>
            <div className="modal-c wide">
              <div className="modal-header">
                <h2>Crear grupo y planificar 8 sesiones</h2>
                <button type="button" className="modal-close" onClick={() => setGrupoModal(false)} aria-label="Cerrar"><IconClose /></button>
              </div>
              <form onSubmit={handleCrearGrupo}>
                <div className="field">
                  <label className="lbl">Carrera *</label>
                  <input className="fi" required value={grupoForm.carrera} onChange={(e) => setGrupoForm((p) => ({ ...p, carrera: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div className="field">
                    <label className="lbl">Grupo *</label>
                    <input className="fi" required value={grupoForm.grupo} onChange={(e) => setGrupoForm((p) => ({ ...p, grupo: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="lbl">Semestre</label>
                    <input className="fi" value={grupoForm.semestre_generacional} onChange={(e) => setGrupoForm((p) => ({ ...p, semestre_generacional: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                  <div className="field">
                    <label className="lbl">Día *</label>
                    <select className="fi" value={grupoForm.dia_semana} onChange={(e) => setGrupoForm((p) => ({ ...p, dia_semana: e.target.value }))}>
                      {DIAS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="lbl">Hora *</label>
                    <input className="fi" type="time" required value={grupoForm.hora_inicio} onChange={(e) => setGrupoForm((p) => ({ ...p, hora_inicio: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="lbl">Salón</label>
                    <input className="fi" value={grupoForm.salon} onChange={(e) => setGrupoForm((p) => ({ ...p, salon: e.target.value }))} />
                  </div>
                </div>
                <div className="field">
                  <label className="lbl">Inicio del semestre (sesión 1) *</label>
                  <input className="fi" type="date" required value={fechaInicioSemestre} onChange={(e) => onFechaInicioChange(e.target.value)} />
                  <span className="hint">Se generan 8 fechas semanales. Puedes ajustar cada una y vincular una actividad del PT.</span>
                </div>
                <div className="sesiones-panel">
                  <div className="sesiones-grid">
                    {fechasSesiones.map((fecha, idx) => (
                      <div key={idx} className="sesion-row">
                        <label>Sesión {idx + 1}</label>
                        <input type="date" value={fecha} onChange={(e) => {
                          const next = [...fechasSesiones]
                          next[idx] = e.target.value
                          setFechasSesiones(next)
                        }} />
                        <select
                          value={actividadesPorSesion[idx + 1] ?? ''}
                          onChange={(e) => setActividadesPorSesion((p) => ({ ...p, [idx + 1]: e.target.value }))}
                        >
                          <option value="">Sin actividad</option>
                          {actividadesOpts.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                        {actividadesPorSesion[idx + 1] && (
                          <>
                            <label>Límite evidencia (grupo)</label>
                            <input
                              type="date"
                              value={limitesPorSesion[idx + 1] ?? ''}
                              onChange={(e) => setLimitesPorSesion((p) => ({ ...p, [idx + 1]: e.target.value }))}
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button type="button" className="btn-s" onClick={() => setGrupoModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-p" disabled={saving}>{saving ? 'Creando…' : 'Crear grupo + 8 sesiones'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {asignarModal && (
          <div className="modal-o" onClick={(e) => { if (e.target === e.currentTarget) setAsignarModal(null) }}>
            <div className="modal-c">
              <div className="modal-header">
                <h2>Asignar a grupo</h2>
                <button type="button" className="modal-close" onClick={() => setAsignarModal(null)} aria-label="Cerrar"><IconClose /></button>
              </div>
              <p style={{ fontSize: '0.88rem', color: '#475569', marginTop: 0 }}>{asignarModal.nombre}</p>
              <div className="field">
                <label className="lbl">Grupo *</label>
                <select className="fi" value={asignarGrupoId} onChange={(e) => setAsignarGrupoId(e.target.value)}>
                  {grupos.map((g) => (
                    <option key={g.id} value={g.id} disabled={g.cupo_disponible <= 0}>{labelGrupo(g)}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn-s" onClick={() => setAsignarModal(null)}>Cancelar</button>
                <button type="button" className="btn-p" disabled={saving || !asignarGrupoId} onClick={() => void handleAsignarGrupo()}>{saving ? 'Asignando…' : 'Asignar'}</button>
              </div>
            </div>
          </div>
        )}

        {editGrupoModal && (
          <div className="modal-o" onClick={(e) => { if (e.target === e.currentTarget) setEditGrupoModal(false) }}>
            <div className="modal-c wide modal-premium">
              <div className="modal-head-bar">
                <h2>Editar grupo tutorial</h2>
                <p>Datos del grupo, 8 sesiones y fechas de entrega por actividad</p>
              </div>
              <div className="modal-header" style={{ marginTop: 0 }}>
                <span />
                <button type="button" className="modal-close" onClick={() => setEditGrupoModal(false)} aria-label="Cerrar"><IconClose /></button>
              </div>
              <form onSubmit={handleActualizarGrupo}>
                <div className="field">
                  <label className="lbl">Carrera *</label>
                  <input className="fi" required value={grupoForm.carrera} onChange={(e) => setGrupoForm((p) => ({ ...p, carrera: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div className="field">
                    <label className="lbl">Grupo *</label>
                    <input className="fi" required value={grupoForm.grupo} onChange={(e) => setGrupoForm((p) => ({ ...p, grupo: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="lbl">Semestre</label>
                    <input className="fi" value={grupoForm.semestre_generacional} onChange={(e) => setGrupoForm((p) => ({ ...p, semestre_generacional: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem' }}>
                  <div className="field">
                    <label className="lbl">Día *</label>
                    <select className="fi" value={grupoForm.dia_semana} onChange={(e) => setGrupoForm((p) => ({ ...p, dia_semana: e.target.value }))}>
                      {DIAS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="lbl">Hora *</label>
                    <input className="fi" type="time" required value={grupoForm.hora_inicio} onChange={(e) => setGrupoForm((p) => ({ ...p, hora_inicio: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="lbl">Salón</label>
                    <input className="fi" value={grupoForm.salon} onChange={(e) => setGrupoForm((p) => ({ ...p, salon: e.target.value }))} />
                  </div>
                </div>
                <div className="sesiones-panel">
                  <div className="sesiones-grid">
                    {sesionesEdit.map((s, idx) => (
                      <div key={s.id} className="sesion-row">
                        <label>Sesión {s.numero_sesion}</label>
                        <input
                          type="date"
                          value={s.fecha_realizada}
                          onChange={(e) => {
                            const next = [...sesionesEdit]
                            next[idx] = { ...next[idx], fecha_realizada: e.target.value }
                            setSesionesEdit(next)
                          }}
                        />
                        <select
                          value={s.actividad_pt_id}
                          onChange={(e) => {
                            const next = [...sesionesEdit]
                            next[idx] = { ...next[idx], actividad_pt_id: e.target.value, fecha_limite_grupo: e.target.value ? next[idx].fecha_limite_grupo : '' }
                            setSesionesEdit(next)
                          }}
                        >
                          <option value="">Sin actividad</option>
                          {actividadesOpts.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                        {s.actividad_pt_id && (
                          <>
                            <label>Límite evidencia (grupo)</label>
                            <input
                              type="date"
                              value={s.fecha_limite_grupo}
                              onChange={(e) => {
                                const next = [...sesionesEdit]
                                next[idx] = { ...next[idx], fecha_limite_grupo: e.target.value }
                                setSesionesEdit(next)
                              }}
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button type="button" className="btn-s" onClick={() => setEditGrupoModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-p" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          open={!!confirm}
          title={confirm?.type === 'eliminar_grupo' ? 'Eliminar grupo' : 'Quitar del grupo'}
          message={
            confirm?.type === 'eliminar_grupo'
              ? `¿Eliminar el grupo «${confirm.nombre}»? Los tutorados quedarán sin asignación. Esta acción desactiva el grupo.`
              : `¿Quitar a ${confirm?.nombre} de su grupo? Seguirá en tu listado general.`
          }
          confirmLabel={confirm?.type === 'eliminar_grupo' ? 'Eliminar grupo' : 'Quitar'}
          variant={confirm?.type === 'eliminar_grupo' ? 'danger' : 'primary'}
          loading={saving}
          onConfirm={() => void ejecutarConfirm()}
          onCancel={() => setConfirm(null)}
        />

        {editModal && (
          <div className="modal-o" onClick={(e) => { if (e.target === e.currentTarget) setEditModal(false) }}>
            <div className="modal-c">
              <div className="modal-header">
                <h2>Editar tutorado</h2>
                <button type="button" className="modal-close" onClick={() => setEditModal(false)} aria-label="Cerrar"><IconClose /></button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="field">
                  <label className="lbl">Nombre *</label>
                  <input className="fi" required value={editForm.nombre} onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="lbl">Correo *</label>
                  <input className="fi" type="email" required value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="lbl">Estado *</label>
                  <select className="fi" value={editForm.estado} onChange={(e) => setEditForm((p) => ({ ...p, estado: e.target.value as EstadoRegistro }))}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button type="button" className="btn-s" onClick={() => setEditModal(false)}>Cancelar</button>
                  <button type="submit" className="btn-p" disabled={saving}>Actualizar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
