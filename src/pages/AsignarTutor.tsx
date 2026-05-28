import { useState, useEffect, type FormEvent } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

interface Tutor   { id: string; nombre_completo: string; departamento: string | null }
interface Periodo { id: string; nombre: string }
interface Asig    { id: string; tutor_id: string; carrera: string; grupo: string; dia_semana: string; hora_inicio: string; hora_fin: string; salon: string; activa: boolean; tutor_nombre?: string }

const DIAS = ['Lunes','Martes','Miércoles','Jueves','Viernes']
const addIcon = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>)

const empty = { tutor_id: '', carrera: '', semestre_generacional: '', grupo: '', dia_semana: 'Lunes', hora_inicio: '', hora_fin: '', salon: '' }

export default function AsignarTutor() {
  const { perfil } = useAuth()
  const { toast }  = useToast()

  const [tutores,   setTutores]   = useState<Tutor[]>([])
  const [periodos,  setPeriodos]  = useState<Periodo[]>([])
  const [periodoId, setPeriodoId] = useState('')
  const [asigs,     setAsigs]     = useState<Asig[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [form,      setForm]      = useState(empty)

  useEffect(() => {
    Promise.all([
      supabase.from('perfiles').select('id,nombre_completo,departamento').eq('rol','tutor').eq('estado','activo').order('nombre_completo'),
      supabase.from('periodos_escolares').select('id,nombre').order('creado_en',{ascending:false}),
    ]).then(([t, p]) => {
      setTutores((t.data ?? []) as Tutor[])
      const ps = (p.data ?? []) as Periodo[]
      setPeriodos(ps); if(ps.length>0) setPeriodoId(ps[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!periodoId) return
    supabase.from('asignaciones_tutor')
      .select('id,tutor_id,carrera,grupo,dia_semana,hora_inicio,hora_fin,salon,activa,perfiles(nombre_completo)')
      .eq('periodo_id', periodoId)
      .order('carrera')
      .then(({ data }) => {
        const rows = (data ?? []).map((r: Record<string,unknown>) => ({
          ...(r as unknown as Asig),
          tutor_nombre: (r.perfiles as {nombre_completo:string}|null)?.nombre_completo,
        }))
        setAsigs(rows)
      })
  }, [periodoId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!perfil || !periodoId) return
    setSaving(true)
    const { error } = await supabase.from('asignaciones_tutor').insert({
      periodo_id: periodoId,
      tutor_id: form.tutor_id,
      carrera: form.carrera,
      semestre_generacional: form.semestre_generacional,
      grupo: form.grupo,
      dia_semana: form.dia_semana,
      hora_inicio: form.hora_inicio,
      hora_fin: form.hora_fin,
      salon: form.salon,
      asignado_por: perfil.id,
    })
    if (error) toast.error('Error al asignar', error.message)
    else {
      toast.success('Tutor asignado exitosamente')
      setModal(false); setForm(empty)
      const { data } = await supabase.from('asignaciones_tutor')
        .select('id,tutor_id,carrera,grupo,dia_semana,hora_inicio,hora_fin,salon,activa,perfiles(nombre_completo)')
        .eq('periodo_id',periodoId).order('carrera')
      const rows = (data ?? []).map((r: Record<string,unknown>) => ({...(r as unknown as Asig), tutor_nombre: (r.perfiles as {nombre_completo:string}|null)?.nombre_completo}))
      setAsigs(rows)
    }
    setSaving(false)
  }

  async function toggleActiva(a: Asig) {
    const { error } = await supabase.from('asignaciones_tutor').update({ activa: !a.activa }).eq('id',a.id)
    if (error) toast.error('Error',error.message)
    else { toast.info(a.activa?'Asignación desactivada':'Asignación activada'); setAsigs(prev => prev.map(x=>x.id===a.id?{...x,activa:!a.activa}:x)) }
  }

  return (
    <>
      <style>{`
        .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem;flex-wrap:wrap;gap:0.75rem}
        .page-title{font-size:1.25rem;font-weight:800;color:#1e3a8a;margin:0}
        .page-sub{font-size:0.82rem;color:#64748b;margin:0.15rem 0 0}
        .btn-primary{display:inline-flex;align-items:center;gap:0.45rem;height:40px;padding:0 1.1rem;background:#1d4ed8;color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;transition:background 0.18s;white-space:nowrap}
        .btn-primary:hover{background:#1e40af}
        .select-w{height:40px;border:1px solid #e2e8f0;border-radius:10px;padding:0 0.85rem;font-size:0.88rem;color:#0f172a;background:#fff;outline:none}
        .select-w:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
        .table-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}
        table{width:100%;border-collapse:collapse}
        thead th{padding:0.75rem 1rem;text-align:left;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#64748b;border-bottom:1px solid #f1f5f9;background:#f8fafc}
        tbody tr{border-bottom:1px solid #f1f5f9;transition:background 0.12s}
        tbody tr:last-child{border-bottom:none}
        tbody tr:hover{background:#f8fafc}
        td{padding:0.85rem 1rem;font-size:0.86rem;color:#0f172a}
        .btn-sm{height:30px;padding:0 0.7rem;font-size:0.76rem;font-weight:700;border-radius:7px;border:1px solid #e2e8f0;background:transparent;cursor:pointer;transition:all 0.15s;color:#334155}
        .btn-sm:hover{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8}
        .modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.45);backdrop-filter:blur(4px);z-index:100;display:grid;place-items:center;padding:1rem}
        .modal-card{background:#fff;border-radius:18px;padding:1.5rem;width:100%;max-width:520px;box-shadow:0 32px 64px rgba(37,99,235,0.18);animation:modalIn 0.25s ease}
        @keyframes modalIn{from{opacity:0;transform:translateY(16px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        .modal-title{font-size:1.1rem;font-weight:800;color:#1e3a8a;margin:0 0 1.25rem}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0.85rem}
        .field{display:flex;flex-direction:column;gap:0.3rem}
        .field.full{grid-column:1/-1}
        label{font-size:0.76rem;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.06em}
        .fi{height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 0.85rem;font-size:0.88rem;color:#0f172a;background:#fff;outline:none;width:100%}
        .fi:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
        .modal-actions{display:flex;justify-content:flex-end;gap:0.6rem;margin-top:1.25rem}
        .btn-cancel{height:40px;padding:0 1.1rem;border:1px solid #e2e8f0;border-radius:10px;background:transparent;color:#334155;font-size:0.85rem;font-weight:600;cursor:pointer}
        .empty-state{padding:3rem 1rem;text-align:center;color:#94a3b8;font-size:0.9rem}
        @media(max-width:640px){.form-grid{grid-template-columns:1fr}thead th:nth-child(4),td:nth-child(4),thead th:nth-child(5),td:nth-child(5){display:none}}
      `}</style>

      <div className="page-header">
        <div>
          <h1 className="page-title">Asignar Tutor</h1>
          <p className="page-sub">Vinculación de tutores a grupos y horarios de tutoría</p>
        </div>
        <div style={{ display:'flex',gap:'0.6rem',flexWrap:'wrap' }}>
          {periodos.length > 1 && (
            <select className="select-w" value={periodoId} onChange={e=>setPeriodoId(e.target.value)}>
              {periodos.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          )}
          <button className="btn-primary" onClick={()=>{setForm(empty);setModal(true)}}>{addIcon} Asignar tutor</button>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? <div className="empty-state">Cargando…</div>
          : asigs.length===0 ? <div className="empty-state">No hay asignaciones para este periodo</div>
          : (
          <table>
            <thead>
              <tr>
                <th>Tutor</th>
                <th>Carrera / Grupo</th>
                <th>Día</th>
                <th>Horario</th>
                <th>Salón</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {asigs.map(a=>(
                <tr key={a.id}>
                  <td style={{fontWeight:600}}>{a.tutor_nombre ?? a.tutor_id}</td>
                  <td>{a.carrera} — Gpo. {a.grupo}</td>
                  <td style={{color:'#475569'}}>{a.dia_semana}</td>
                  <td style={{color:'#475569',whiteSpace:'nowrap'}}>{a.hora_inicio} – {a.hora_fin}</td>
                  <td style={{color:'#475569'}}>{a.salon}</td>
                  <td style={{color:a.activa?'#16a34a':'#94a3b8',fontWeight:600}}>{a.activa?'Activa':'Inactiva'}</td>
                  <td><button className="btn-sm" onClick={()=>toggleActiva(a)}>{a.activa?'Desactivar':'Activar'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="modal-card">
            <h2 className="modal-title">Nueva asignación de tutor</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="field full">
                  <label>Tutor *</label>
                  <select className="fi" required value={form.tutor_id} onChange={e=>setForm(p=>({...p,tutor_id:e.target.value}))}>
                    <option value="">Seleccionar tutor…</option>
                    {tutores.map(t=><option key={t.id} value={t.id}>{t.nombre_completo}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Carrera *</label>
                  <input className="fi" required value={form.carrera} onChange={e=>setForm(p=>({...p,carrera:e.target.value}))} placeholder="Ingeniería en Sistemas" />
                </div>
                <div className="field">
                  <label>Grupo *</label>
                  <input className="fi" required value={form.grupo} onChange={e=>setForm(p=>({...p,grupo:e.target.value}))} placeholder="A" />
                </div>
                <div className="field">
                  <label>Semestre generacional *</label>
                  <input className="fi" required value={form.semestre_generacional} onChange={e=>setForm(p=>({...p,semestre_generacional:e.target.value}))} placeholder="ISC-2023A" />
                </div>
                <div className="field">
                  <label>Salón *</label>
                  <input className="fi" required value={form.salon} onChange={e=>setForm(p=>({...p,salon:e.target.value}))} placeholder="Aula 12" />
                </div>
                <div className="field">
                  <label>Día de la semana *</label>
                  <select className="fi" value={form.dia_semana} onChange={e=>setForm(p=>({...p,dia_semana:e.target.value}))}>
                    {DIAS.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Hora inicio *</label>
                  <input className="fi" type="time" required value={form.hora_inicio} onChange={e=>setForm(p=>({...p,hora_inicio:e.target.value}))} />
                </div>
                <div className="field">
                  <label>Hora fin *</label>
                  <input className="fi" type="time" required value={form.hora_fin} onChange={e=>setForm(p=>({...p,hora_fin:e.target.value}))} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={()=>setModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving?'Guardando…':'Asignar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
