import { useState, useEffect, type FormEvent } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

interface Programa { id: string; nombre: string; periodo_id: string }
interface Actividad {
  id: string
  programa_id: string
  nombre: string
  tipo_sesion: string
  fase: string
  fecha_programada: string
  requiere_evidencia: boolean
  estado: string
}

const TIPOS_SESION = ['grupal','individual','virtual','plenaria'] as const
const FASES_PT     = ['diagnostico','planeacion','acompanamiento','seguimiento','evaluacion'] as const
const FASE_LABELS: Record<string,string> = { diagnostico:'Diagnóstico', planeacion:'Planeación', acompanamiento:'Acompañamiento', seguimiento:'Seguimiento', evaluacion:'Evaluación' }
const TIPO_LABELS: Record<string,string>  = { grupal:'Grupal', individual:'Individual', virtual:'Virtual', plenaria:'Plenaria' }

const addIcon = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>)

const empty = { nombre: '', descripcion: '', tipo_sesion: 'grupal', fase: 'diagnostico', fecha_programada: '', requiere_evidencia: false, tipo_archivo_aceptado: '', fecha_limite_evidencia: '' }

export default function RegistrarActividades() {
  const { perfil } = useAuth()
  const { toast }  = useToast()

  const [programas,    setProgramas]    = useState<Programa[]>([])
  const [progActivo,   setProgActivo]   = useState('')
  const [actividades,  setActividades]  = useState<Actividad[]>([])
  const [loading,      setLoading]      = useState(true)
  const [modal,        setModal]        = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [form,         setForm]         = useState(empty)
  const [editId,       setEditId]       = useState<string|null>(null)

  useEffect(() => {
    supabase.from('programas_tutorias').select('id,nombre,periodo_id').eq('activo', true)
      .then(({ data }) => {
        const ps = (data ?? []) as Programa[]
        setProgramas(ps)
        if (ps.length > 0) setProgActivo(ps[0].id)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!progActivo) return
    supabase.from('actividades_pt')
      .select('id,programa_id,nombre,tipo_sesion,fase,fecha_programada,requiere_evidencia,estado')
      .eq('programa_id', progActivo)
      .order('fecha_programada', { ascending: true })
      .then(({ data }) => setActividades((data ?? []) as Actividad[]))
  }, [progActivo])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!progActivo || !perfil) return
    setSaving(true)
    const payload = {
      programa_id: progActivo,
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      tipo_sesion: form.tipo_sesion,
      fase: form.fase,
      fecha_programada: form.fecha_programada,
      requiere_evidencia: form.requiere_evidencia,
      tipo_archivo_aceptado: form.requiere_evidencia && form.tipo_archivo_aceptado ? form.tipo_archivo_aceptado.split(',').map(s => s.trim()) : null,
      fecha_limite_evidencia: form.requiere_evidencia && form.fecha_limite_evidencia ? form.fecha_limite_evidencia : null,
      creado_por: perfil.id,
    }
    let err
    if (editId) {
      ;({ error: err } = await supabase.from('actividades_pt').update(payload).eq('id', editId))
    } else {
      ;({ error: err } = await supabase.from('actividades_pt').insert(payload))
    }
    if (err) toast.error('Error', err.message)
    else {
      toast.success(editId ? 'Actividad actualizada' : 'Actividad registrada')
      setModal(false); setEditId(null); setForm(empty)
      const { data } = await supabase.from('actividades_pt')
        .select('id,programa_id,nombre,tipo_sesion,fase,fecha_programada,requiere_evidencia,estado')
        .eq('programa_id', progActivo).order('fecha_programada', { ascending: true })
      setActividades((data ?? []) as Actividad[])
    }
    setSaving(false)
  }

  function openEdit(a: Actividad) {
    setForm({ nombre: a.nombre, descripcion: '', tipo_sesion: a.tipo_sesion, fase: a.fase, fecha_programada: a.fecha_programada, requiere_evidencia: a.requiere_evidencia, tipo_archivo_aceptado: '', fecha_limite_evidencia: '' })
    setEditId(a.id); setModal(true)
  }

  async function toggleEstado(a: Actividad) {
    const next = a.estado === 'activa' ? 'cerrada' : 'activa'
    const { error } = await supabase.from('actividades_pt').update({ estado: next }).eq('id', a.id)
    if (error) toast.error('Error', error.message)
    else { toast.info(`Actividad ${next}`); setActividades(prev => prev.map(x => x.id === a.id ? { ...x, estado: next } : x)) }
  }

  return (
    <>
      <style>{`
        .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem; }
        .page-title  { font-size:1.25rem; font-weight:800; color:#1e3a8a; margin:0; }
        .page-sub    { font-size:0.82rem; color:#64748b; margin:0.15rem 0 0; }
        .btn-primary { display:inline-flex; align-items:center; gap:0.45rem; height:40px; padding:0 1.1rem; background:#1d4ed8; color:#fff; border:none; border-radius:10px; font-size:0.85rem; font-weight:700; cursor:pointer; transition:background 0.18s; white-space:nowrap; }
        .btn-primary:hover { background:#1e40af; }
        .select-prog { height:40px; border:1px solid #e2e8f0; border-radius:10px; padding:0 0.85rem; font-size:0.88rem; color:#0f172a; background:#fff; outline:none; }
        .select-prog:focus { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }
        .table-wrap  { background:#fff; border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; }
        table        { width:100%; border-collapse:collapse; }
        thead th     { padding:0.75rem 1rem; text-align:left; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:#64748b; border-bottom:1px solid #f1f5f9; background:#f8fafc; }
        tbody tr     { border-bottom:1px solid #f1f5f9; transition:background 0.12s; }
        tbody tr:last-child { border-bottom:none; }
        tbody tr:hover { background:#f8fafc; }
        td           { padding:0.85rem 1rem; font-size:0.86rem; color:#0f172a; }
        .badge       { display:inline-block; font-size:0.72rem; font-weight:700; padding:3px 9px; border-radius:8px; }
        .badge-fase  { background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; }
        .badge-tipo  { background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; }
        .badge-ev    { background:#fffbeb; color:#92400e; border:1px solid #fde68a; }
        .btn-sm      { height:30px; padding:0 0.7rem; font-size:0.76rem; font-weight:700; border-radius:7px; border:1px solid #e2e8f0; background:transparent; cursor:pointer; transition:all 0.15s; color:#334155; margin-right:4px; }
        .btn-sm:hover{ background:#eff6ff; border-color:#bfdbfe; color:#1d4ed8; }
        .modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.45); backdrop-filter:blur(4px); z-index:100; display:grid; place-items:center; padding:1rem; }
        .modal-card  { background:#fff; border-radius:18px; padding:1.5rem; width:100%; max-width:540px; box-shadow:0 32px 64px rgba(37,99,235,0.18); animation:modalIn 0.25s ease; }
        @keyframes modalIn { from{opacity:0;transform:translateY(16px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);} }
        .modal-title { font-size:1.1rem; font-weight:800; color:#1e3a8a; margin:0 0 1.25rem; }
        .form-grid   { display:grid; grid-template-columns:1fr 1fr; gap:0.85rem; }
        .field       { display:flex; flex-direction:column; gap:0.3rem; }
        .field.full  { grid-column:1/-1; }
        label        { font-size:0.76rem; font-weight:700; color:#334155; text-transform:uppercase; letter-spacing:0.06em; }
        .fi          { height:42px; border:1px solid #cbd5e1; border-radius:10px; padding:0 0.85rem; font-size:0.88rem; color:#0f172a; background:#fff; outline:none; width:100%; }
        .fi:focus    { border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }
        .fi-ta       { min-height:72px; padding:0.65rem 0.85rem; resize:vertical; }
        .checkbox-row{ display:flex; align-items:center; gap:0.5rem; }
        .checkbox-row input[type=checkbox] { width:16px; height:16px; accent-color:#1d4ed8; }
        .modal-actions { display:flex; justify-content:flex-end; gap:0.6rem; margin-top:1.25rem; }
        .btn-cancel  { height:40px; padding:0 1.1rem; border:1px solid #e2e8f0; border-radius:10px; background:transparent; color:#334155; font-size:0.85rem; font-weight:600; cursor:pointer; }
        .empty-state { padding:3rem 1rem; text-align:center; color:#94a3b8; font-size:0.9rem; }
        @media(max-width:640px){.form-grid{grid-template-columns:1fr;}thead th:nth-child(3),td:nth-child(3){display:none;}}
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Actividades del PT</h1>
          <p className="page-sub">Plan de Acción Tutorial — registro y gestión de actividades</p>
        </div>
        <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap' }}>
          {programas.length > 1 && (
            <select className="select-prog" value={progActivo} onChange={e => setProgActivo(e.target.value)}>
              {programas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          )}
          <button className="btn-primary" onClick={() => { setEditId(null); setForm(empty); setModal(true) }}>
            {addIcon} Nueva actividad
          </button>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? <div className="empty-state">Cargando…</div>
          : actividades.length === 0 ? <div className="empty-state">No hay actividades registradas para este programa</div>
          : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Fase</th>
                <th>Tipo sesión</th>
                <th>Fecha</th>
                <th>Evidencia</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {actividades.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight:600 }}>{a.nombre}</td>
                  <td><span className="badge badge-fase">{FASE_LABELS[a.fase] ?? a.fase}</span></td>
                  <td><span className="badge badge-tipo">{TIPO_LABELS[a.tipo_sesion] ?? a.tipo_sesion}</span></td>
                  <td style={{ color:'#475569', whiteSpace:'nowrap' }}>{a.fecha_programada}</td>
                  <td>{a.requiere_evidencia ? <span className="badge badge-ev">Sí</span> : <span style={{ color:'#94a3b8', fontSize:'0.8rem' }}>No</span>}</td>
                  <td style={{ textTransform:'capitalize', color: a.estado==='activa'?'#16a34a':'#94a3b8', fontWeight:600 }}>{a.estado}</td>
                  <td>
                    <button className="btn-sm" onClick={() => openEdit(a)}>Editar</button>
                    <button className="btn-sm" onClick={() => toggleEstado(a)}>{a.estado==='activa'?'Cerrar':'Reabrir'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="modal-card">
            <h2 className="modal-title">{editId ? 'Editar actividad' : 'Nueva actividad'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field full">
                  <label>Nombre *</label>
                  <input className="fi" required value={form.nombre} onChange={e => setForm(p=>({...p,nombre:e.target.value}))} />
                </div>
                <div className="field full">
                  <label>Descripción</label>
                  <textarea className="fi fi-ta" value={form.descripcion} onChange={e => setForm(p=>({...p,descripcion:e.target.value}))} />
                </div>
                <div className="field">
                  <label>Fase del PT *</label>
                  <select className="fi" value={form.fase} onChange={e => setForm(p=>({...p,fase:e.target.value}))}>
                    {FASES_PT.map(f => <option key={f} value={f}>{FASE_LABELS[f]}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Tipo de sesión *</label>
                  <select className="fi" value={form.tipo_sesion} onChange={e => setForm(p=>({...p,tipo_sesion:e.target.value}))}>
                    {TIPOS_SESION.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Fecha programada *</label>
                  <input className="fi" type="date" required value={form.fecha_programada} onChange={e => setForm(p=>({...p,fecha_programada:e.target.value}))} />
                </div>
                <div className="field" style={{ justifyContent:'flex-end' }}>
                  <label>&nbsp;</label>
                  <div className="checkbox-row">
                    <input type="checkbox" id="req-ev" checked={form.requiere_evidencia} onChange={e => setForm(p=>({...p,requiere_evidencia:e.target.checked}))} />
                    <label htmlFor="req-ev" style={{ textTransform:'none', letterSpacing:'normal', fontSize:'0.87rem', fontWeight:600 }}>Requiere evidencia</label>
                  </div>
                </div>
                {form.requiere_evidencia && (
                  <>
                    <div className="field">
                      <label>Tipos aceptados (separados por coma)</label>
                      <input className="fi" value={form.tipo_archivo_aceptado} onChange={e => setForm(p=>({...p,tipo_archivo_aceptado:e.target.value}))} placeholder="pdf, docx, jpg" />
                    </div>
                    <div className="field">
                      <label>Fecha límite evidencia</label>
                      <input className="fi" type="date" value={form.fecha_limite_evidencia} onChange={e => setForm(p=>({...p,fecha_limite_evidencia:e.target.value}))} />
                    </div>
                  </>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving?'Guardando…':editId?'Actualizar':'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
