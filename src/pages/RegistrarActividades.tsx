import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useToast } from '../context/ToastContext'
import { gestionarActividadesPt } from '../utils/gestionRpc'
import RefreshButton from '../components/RefreshButton'
import PremiumTable from '../components/PremiumTable'
import { IconClose } from '../components/icons'
import { fechaLarga } from '../utils/sesionesSemestre'

interface Programa { id: string; nombre: string; periodo_id: string; activo?: boolean }
interface Actividad {
  id: string
  programa_id: string
  nombre: string
  descripcion?: string | null
  tipo_sesion: string
  fase: string
  fecha_programada: string
  requiere_evidencia: boolean
  tipo_archivo_aceptado?: string[] | null
  fecha_limite_evidencia?: string | null
  estado: string
}

const FASES_PT = ['diagnostico', 'planeacion', 'acompanamiento', 'seguimiento', 'evaluacion'] as const
const FASE_LABELS: Record<string, string> = {
  diagnostico: 'Diagnóstico', planeacion: 'Planeación', acompanamiento: 'Acompañamiento',
  seguimiento: 'Seguimiento', evaluacion: 'Evaluación',
}

const empty = {
  nombre: '', descripcion: '', fase: 'diagnostico',
  fecha_programada: '', requiere_evidencia: true,
  tipo_archivo_aceptado: 'pdf, docx, jpg', fecha_limite_evidencia: '',
}

export default function RegistrarActividades() {
  const { toast } = useToast()

  const [programas, setProgramas]     = useState<Programa[]>([])
  const [progActivo, setProgActivo]   = useState('')
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [modal, setModal]             = useState(false)
  const [saving, setSaving]           = useState(false)
  const [form, setForm]               = useState(empty)
  const [editId, setEditId]           = useState<string | null>(null)

  const loadActividades = useCallback(async (programaId: string) => {
    if (!programaId) return
    const res = await gestionarActividadesPt('listar', { programa_id: programaId })
    if (!res.ok) { toast.error('Error al cargar actividades', res.error); return }
    setActividades((res.data?.actividades as Actividad[]) ?? [])
  }, [toast])

  const init = useCallback(async () => {
    setLoading(true)
    const res = await gestionarActividadesPt('listar_programas', {})
    if (!res.ok) { toast.error('No se pudieron cargar programas', res.error); setLoading(false); return }
    const ps = ((res.data?.programas as Programa[]) ?? []).filter((p) => p.activo !== false)
    setProgramas(ps)
    const pid = ps[0]?.id ?? ''
    if (pid) { setProgActivo(pid); await loadActividades(pid) }
    setLoading(false)
  }, [loadActividades, toast])

  useEffect(() => { void init() }, [init])

  useEffect(() => {
    if (progActivo) void loadActividades(progActivo)
  }, [progActivo, loadActividades])

  async function handleRefresh() {
    setRefreshing(true)
    if (progActivo) await loadActividades(progActivo)
    else await init()
    setRefreshing(false)
    toast.info('Actualizado')
  }

  function abrirCrear() {
    setEditId(null)
    setForm(empty)
    setModal(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!progActivo) { toast.warning('Selecciona un programa de tutorías antes de guardar'); return }
    setSaving(true)

    const tipos = form.requiere_evidencia && form.tipo_archivo_aceptado
      ? form.tipo_archivo_aceptado.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    const payload = {
      programa_id:           progActivo,
      nombre:                form.nombre,
      descripcion:           form.descripcion || null,
      tipo_sesion:           'grupal',
      fase:                  form.fase,
      fecha_programada:      form.fecha_programada,
      requiere_evidencia:    form.requiere_evidencia,
      tipo_archivo_aceptado: tipos,
      fecha_limite_evidencia: form.requiere_evidencia ? form.fecha_limite_evidencia || null : null,
    }

    const res = editId
      ? await gestionarActividadesPt('actualizar', { actividad_id: editId, ...payload })
      : await gestionarActividadesPt('crear', payload)

    if (!res.ok) toast.error('Error al guardar', res.error)
    else {
      toast.success((res.data?.mensaje as string) ?? (editId ? 'Actividad actualizada' : 'Actividad registrada'))
      setModal(false)
      setEditId(null)
      setForm(empty)
      await loadActividades(progActivo)
    }
    setSaving(false)
  }

  function openEdit(a: Actividad) {
    setForm({
      nombre:                 a.nombre,
      descripcion:            a.descripcion ?? '',
      fase:                   a.fase,
      fecha_programada:       a.fecha_programada,
      requiere_evidencia:     a.requiere_evidencia,
      tipo_archivo_aceptado:  (a.tipo_archivo_aceptado ?? []).join(', '),
      fecha_limite_evidencia: a.fecha_limite_evidencia ?? '',
    })
    setEditId(a.id)
    setModal(true)
  }

  async function toggleEstado(a: Actividad) {
    const next = a.estado === 'activa' ? 'cerrada' : 'activa'
    const res = await gestionarActividadesPt('cambiar_estado', { actividad_id: a.id, estado: next })
    if (!res.ok) toast.error('Error', res.error)
    else {
      toast.info(`Actividad ${next}`)
      setActividades((prev) => prev.map((x) => (x.id === a.id ? { ...x, estado: next } : x)))
    }
  }

  const activas   = actividades.filter((a) => a.estado === 'activa').length
  const cerradas  = actividades.filter((a) => a.estado !== 'activa').length

  return (
    <>
      <style>{`
        .ra { --blue:#1d4ed8; --blue-s:#eff6ff; font-family:'Inter',sans-serif; }
        .ra-topbar { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:1.1rem; flex-wrap:wrap; gap:0.75rem; }
        .ra-title { font-size:1.25rem; font-weight:800; color:#0f172a; margin:0; }
        .ra-sub { font-size:0.82rem; color:#64748b; margin:0.15rem 0 0; }
        .ra-bar { display:flex; gap:0.6rem; flex-wrap:wrap; align-items:center; }
        .ra-select { height:40px; border:1px solid #e2e8f0; border-radius:10px; padding:0 0.85rem; font-size:0.88rem; background:#fff; min-width:200px; font-weight:600; color:#0f172a; }
        .ra-global-badge { display:inline-flex; align-items:center; gap:0.4rem; background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:0.45rem 0.85rem; font-size:0.78rem; font-weight:700; color:#15803d; margin-bottom:1rem; }
        .ra-stats { display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem; }
        .ra-stat { background:#f8fafc; border:1px solid #e8eef5; border-radius:10px; padding:0.45rem 0.85rem; font-size:0.78rem; color:#475569; font-weight:600; }
        .ra-stat strong { color:#0f172a; }
        .btn-prim { height:42px; padding:0 1.35rem; background:var(--blue); color:#fff; border:none; border-radius:10px; font-size:0.88rem; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:0.45rem; box-shadow:0 4px 14px rgba(29,78,216,0.25); transition:all 0.15s; }
        .btn-prim:hover { background:#1e40af; box-shadow:0 6px 18px rgba(29,78,216,0.35); transform:translateY(-1px); }
        .btn-sm { height:30px; padding:0 0.7rem; font-size:0.76rem; font-weight:700; border-radius:8px; border:1px solid #bfdbfe; background:var(--blue-s); color:var(--blue); cursor:pointer; }
        .btn-sm:hover { background:#dbeafe; }
        .modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.5); backdrop-filter:blur(6px); z-index:100; display:grid; place-items:center; padding:1rem; }
        .modal-card { background:#fff; border-radius:20px; width:100%; max-width:560px; max-height:92vh; overflow:hidden; box-shadow:0 32px 64px rgba(29,78,216,0.22); display:flex; flex-direction:column; animation:raIn 0.22s ease; }
        @keyframes raIn { from{opacity:0;transform:scale(0.96) translateY(8px)} to{opacity:1;transform:none} }
        .modal-head { padding:1.25rem 1.35rem; background:linear-gradient(135deg,#1e3a8a,#1d4ed8); color:#fff; display:flex; justify-content:space-between; align-items:flex-start; }
        .modal-head h2 { margin:0; font-size:1.05rem; font-weight:800; }
        .modal-head p { margin:0.3rem 0 0; font-size:0.76rem; opacity:0.88; }
        .modal-close { width:36px; height:36px; border:none; background:rgba(255,255,255,0.15); border-radius:10px; cursor:pointer; color:#fff; display:grid; place-items:center; }
        .modal-body { padding:1.25rem 1.35rem; overflow-y:auto; }
        .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
        .field.full { grid-column:1/-1; }
        .lbl { font-size:0.7rem; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.06em; display:block; margin-bottom:0.3rem; }
        .fi { height:42px; border:1.5px solid #e2e8f0; border-radius:10px; padding:0 0.85rem; width:100%; font-size:0.88rem; box-sizing:border-box; }
        .fi:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }
        .fi-ta { min-height:80px; padding:0.65rem 0.85rem; resize:vertical; }
        .check-row { display:flex; align-items:center; gap:0.5rem; height:42px; }
        .modal-foot { padding:1rem 1.35rem 1.15rem; border-top:2px solid #f1f5f9; display:flex; justify-content:flex-end; gap:0.5rem; background:#f8fafc; }
        .btn-ghost { height:40px; padding:0 1rem; border:1px solid #e2e8f0; border-radius:10px; background:#fff; cursor:pointer; font-weight:600; color:#475569; }
        .badge-est { font-size:0.72rem; font-weight:700; padding:3px 9px; border-radius:8px; }
        .badge-activa { background:#f0fdf4; color:#166534; border:1px solid #86efac; }
        .badge-cerrada { background:#f8fafc; color:#64748b; border:1px solid #e2e8f0; }
        .btn-save-modal { height:42px; padding:0 1.4rem; background:#1d4ed8; color:#fff; border:none; border-radius:10px; font-weight:800; font-size:0.9rem; cursor:pointer; box-shadow:0 4px 14px rgba(29,78,216,0.3); }
        .btn-save-modal:disabled { opacity:0.55; cursor:not-allowed; box-shadow:none; }
        .btn-save-modal:not(:disabled):hover { background:#1e40af; }
      `}</style>

      <div className="ra">
        <div className="ra-topbar">
          <div>
            <h1 className="ra-title">Actividades del PT</h1>
            <p className="ra-sub">Plan de Acción Tutorial · Aplicables a todos los grupos del programa</p>
          </div>
          <div className="ra-bar">
            {programas.length > 0 && (
              <select className="ra-select" value={progActivo} onChange={(e) => setProgActivo(e.target.value)}>
                {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            )}
            <RefreshButton onClick={handleRefresh} loading={refreshing} />
            <button type="button" className="btn-prim" onClick={abrirCrear}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nueva actividad
            </button>
          </div>
        </div>

        {!progActivo && !loading && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '1rem', fontSize: '0.86rem', color: '#92400e', fontWeight: 600 }}>
            No hay programa de tutorías activo. Registra uno en la base de datos.
          </div>
        )}

        {progActivo && (
          <div className="ra-global-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><polyline points="20 6 9 17 4 12"/></svg>
            Actividades generales — todos los grupos del programa las heredan automáticamente
          </div>
        )}

        {actividades.length > 0 && (
          <div className="ra-stats">
            <div className="ra-stat">Total: <strong>{actividades.length}</strong></div>
            <div className="ra-stat">Activas: <strong>{activas}</strong></div>
            {cerradas > 0 && <div className="ra-stat">Cerradas: <strong>{cerradas}</strong></div>}
          </div>
        )}

        <PremiumTable
          loading={loading}
          emptyMessage={progActivo ? 'Sin actividades en este programa' : 'Selecciona un programa'}
          data={actividades}
          rowKey={(a) => a.id}
          columns={[
            { key: 'nom', header: 'Actividad', render: (a) => <span style={{ fontWeight: 700 }}>{a.nombre}</span> },
            { key: 'fase', header: 'Fase', render: (a) => FASE_LABELS[a.fase] ?? a.fase },
            {
              key: 'fecha',
              header: 'Fecha programada',
              render: (a) => (
                <span style={{ fontSize: '0.82rem', color: '#475569' }}>{fechaLarga(a.fecha_programada)}</span>
              ),
            },
            {
              key: 'limite',
              header: 'Límite evidencia',
              render: (a) => a.fecha_limite_evidencia ? (
                <span style={{ fontSize: '0.82rem', color: '#b45309', fontWeight: 600 }}>{fechaLarga(a.fecha_limite_evidencia)}</span>
              ) : <span style={{ color: '#cbd5e1' }}>—</span>,
            },
            { key: 'ev', header: 'Evidencia', render: (a) => a.requiere_evidencia ? <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.8rem' }}>Sí</span> : <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>No</span> },
            {
              key: 'est',
              header: 'Estado',
              render: (a) => (
                <span className={`badge-est ${a.estado === 'activa' ? 'badge-activa' : 'badge-cerrada'}`}>{a.estado === 'activa' ? 'Activa' : 'Cerrada'}</span>
              ),
            },
            {
              key: 'acc',
              header: 'Acciones',
              align: 'right',
              render: (a) => (
                <>
                  <button type="button" className="btn-sm" onClick={() => openEdit(a)}>Editar</button>
                  {' '}
                  <button type="button" className="btn-sm" onClick={() => void toggleEstado(a)}>
                    {a.estado === 'activa' ? 'Cerrar' : 'Activar'}
                  </button>
                </>
              ),
            },
          ]}
        />
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="modal-card">
            <div className="modal-head">
              <div>
                <h2>{editId ? 'Editar actividad' : 'Nueva actividad del PT'}</h2>
                <p>General · aplica a todos los grupos del programa seleccionado</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setModal(false)} aria-label="Cerrar"><IconClose /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {!progActivo && (
                  <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, padding: '0.7rem 0.9rem', marginBottom: '0.85rem', fontSize: '0.82rem', color: '#854d0e', fontWeight: 600 }}>
                    Selecciona primero un programa de tutorías en la barra superior.
                  </div>
                )}
                <div className="form-grid">
                  <div className="field full">
                    <label className="lbl">Nombre de la actividad *</label>
                    <input className="fi" required value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} placeholder="Ej. Diagnóstico socioeconómico" />
                  </div>
                  <div className="field full">
                    <label className="lbl">Descripción</label>
                    <textarea className="fi fi-ta" value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción breve de la actividad…" />
                  </div>
                  <div className="field">
                    <label className="lbl">Fase *</label>
                    <select className="fi" value={form.fase} onChange={(e) => setForm((p) => ({ ...p, fase: e.target.value }))}>
                      {FASES_PT.map((f) => <option key={f} value={f}>{FASE_LABELS[f]}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="lbl">Fecha programada *</label>
                    <input className="fi" type="date" required value={form.fecha_programada} onChange={(e) => setForm((p) => ({ ...p, fecha_programada: e.target.value }))} />
                  </div>
                  <div className="field full">
                    <label className="lbl">Opciones</label>
                    <div className="check-row">
                      <input type="checkbox" id="req-ev" checked={form.requiere_evidencia} onChange={(e) => setForm((p) => ({ ...p, requiere_evidencia: e.target.checked }))} />
                      <label htmlFor="req-ev" style={{ fontSize: '0.86rem', fontWeight: 600 }}>Requiere que el tutorado suba evidencia</label>
                    </div>
                  </div>
                  {form.requiere_evidencia && (
                    <>
                      <div className="field">
                        <label className="lbl">Tipos de archivo aceptados</label>
                        <input className="fi" value={form.tipo_archivo_aceptado} onChange={(e) => setForm((p) => ({ ...p, tipo_archivo_aceptado: e.target.value }))} placeholder="pdf, docx, jpg" />
                      </div>
                      <div className="field">
                        <label className="lbl">Fecha límite general</label>
                        <input className="fi" type="date" value={form.fecha_limite_evidencia} onChange={(e) => setForm((p) => ({ ...p, fecha_limite_evidencia: e.target.value }))} />
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-foot">
                <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn-save-modal" disabled={saving || !progActivo}>
                  {saving ? 'Guardando…' : editId ? 'Actualizar actividad' : 'Guardar actividad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
