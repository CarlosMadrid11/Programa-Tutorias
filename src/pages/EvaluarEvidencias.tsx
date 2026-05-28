import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

interface Evidencia {
  id: string
  tutorado_nombre: string
  actividad_nombre: string
  archivo_nombre: string | null
  archivo_url: string | null
  comentario_alumno: string | null
  estado: string
  retroalimentacion: string | null
  fecha_entrega: string
}

const ESTADO_LABELS: Record<string,string> = { pendiente:'Pendiente', entregada:'Entregada', aceptada:'Aceptada', requiere_correccion:'Requiere corrección', rechazada:'Rechazada' }
const ESTADO_COLORS: Record<string,{bg:string;text:string;border:string}> = {
  pendiente:          { bg:'#f8fafc',  text:'#64748b', border:'#e2e8f0' },
  entregada:          { bg:'#eff6ff',  text:'#1d4ed8', border:'#bfdbfe' },
  aceptada:           { bg:'#f0fdf4',  text:'#166534', border:'#bbf7d0' },
  requiere_correccion:{ bg:'#fffbeb',  text:'#92400e', border:'#fde68a' },
  rechazada:          { bg:'#fef2f2',  text:'#991b1b', border:'#fecaca' },
}

export default function EvaluarEvidencias() {
  const { perfil } = useAuth()
  const { toast }  = useToast()

  const [evidencias, setEvidencias]   = useState<Evidencia[]>([])
  const [loading,    setLoading]      = useState(true)
  const [filtro,     setFiltro]       = useState<string>('entregada')
  const [selected,   setSelected]     = useState<Evidencia|null>(null)
  const [resultado,  setResultado]    = useState<string>('aceptada')
  const [retro,      setRetro]        = useState('')
  const [saving,     setSaving]       = useState(false)

  async function fetchEvidencias() {
    if (!perfil) return
    const { data: asigs } = await supabase.from('asignaciones_tutor').select('id').eq('tutor_id',perfil.id).eq('activa',true)
    const asigIds = (asigs ?? []).map((a:{id:string})=>a.id)
    if (asigIds.length===0) { setLoading(false); return }
    const { data, error } = await supabase
      .from('evidencias')
      .select('id,estado,retroalimentacion,comentario_alumno,archivo_nombre,archivo_url,fecha_entrega,perfiles!evidencias_tutorado_id_fkey(nombre_completo),actividades_pt(nombre)')
      .in('tutorado_id', (await supabase.from('asignaciones_tutorado').select('tutorado_id').in('asignacion_id',asigIds).then(r=>(r.data??[]).map((x:{tutorado_id:string})=>x.tutorado_id))))
      .order('fecha_entrega',{ascending:false})
    if (error) toast.error('Error',error.message)
    else setEvidencias((data??[]).map((r: Record<string,unknown>)=>({
      id: r.id as string,
      estado: r.estado as string,
      retroalimentacion: r.retroalimentacion as string|null,
      comentario_alumno: r.comentario_alumno as string|null,
      archivo_nombre: r.archivo_nombre as string|null,
      archivo_url: r.archivo_url as string|null,
      fecha_entrega: r.fecha_entrega as string,
      tutorado_nombre: ((r.perfiles as {nombre_completo:string}|null)?.nombre_completo ?? '—'),
      actividad_nombre: ((r.actividades_pt as {nombre:string}|null)?.nombre ?? '—'),
    })))
    setLoading(false)
  }

  useEffect(() => { fetchEvidencias() }, [perfil])

  function openEval(ev: Evidencia) {
    setSelected(ev); setResultado('aceptada'); setRetro(ev.retroalimentacion ?? '')
  }

  async function handleEvaluar() {
    if (!selected || !perfil) return
    if ((resultado==='requiere_correccion'||resultado==='rechazada') && !retro.trim()) {
      toast.warning('La retroalimentación es obligatoria cuando se rechaza o requiere corrección')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('evidencias').update({
      estado: resultado,
      retroalimentacion: retro || null,
      evaluada_por: perfil.id,
      fecha_evaluacion: new Date().toISOString(),
    }).eq('id',selected.id)
    if (error) toast.error('Error',error.message)
    else { toast.success('Evaluación guardada'); setSelected(null); fetchEvidencias() }
    setSaving(false)
  }

  const filtered = evidencias.filter(e => filtro==='all'||e.estado===filtro)

  return (
    <>
      <style>{`
        .page-title{font-size:1.25rem;font-weight:800;color:#1e3a8a;margin:0}
        .page-sub{font-size:0.82rem;color:#64748b;margin:0.15rem 0 0}
        .filter-row{display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1rem}
        .filter-btn{height:34px;padding:0 0.9rem;border:1px solid #e2e8f0;border-radius:9px;font-size:0.8rem;font-weight:600;cursor:pointer;background:transparent;color:#64748b;transition:all 0.15s}
        .filter-btn.active{background:#1d4ed8;border-color:#1d4ed8;color:#fff}
        .ev-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:0.85rem}
        .ev-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1rem 1.1rem;transition:box-shadow 0.15s}
        .ev-card:hover{box-shadow:0 6px 20px rgba(37,99,235,0.1)}
        .ev-actividad{font-size:0.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem}
        .ev-nombre{font-size:0.92rem;font-weight:700;color:#0f172a;margin-bottom:0.5rem}
        .ev-foot{display:flex;align-items:center;justify-content:space-between;margin-top:0.75rem}
        .badge{display:inline-block;font-size:0.72rem;font-weight:700;padding:3px 9px;border-radius:8px;border:1px solid}
        .btn-sm{height:30px;padding:0 0.75rem;font-size:0.78rem;font-weight:700;border-radius:8px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;cursor:pointer;transition:all 0.15s}
        .btn-sm:hover{background:#dbeafe}
        .modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.45);backdrop-filter:blur(4px);z-index:100;display:grid;place-items:center;padding:1rem}
        .modal-card{background:#fff;border-radius:18px;padding:1.5rem;width:100%;max-width:500px;box-shadow:0 32px 64px rgba(37,99,235,0.18);animation:modalIn 0.25s ease}
        @keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        .modal-title{font-size:1.05rem;font-weight:800;color:#1e3a8a;margin:0 0 1rem}
        .field{display:flex;flex-direction:column;gap:0.3rem;margin-bottom:0.85rem}
        label{font-size:0.76rem;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.06em}
        .fi{height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 0.85rem;font-size:0.88rem;color:#0f172a;background:#fff;outline:none;width:100%}
        .fi:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
        .fi-ta{min-height:90px;padding:0.65rem 0.85rem;resize:vertical}
        .modal-actions{display:flex;justify-content:flex-end;gap:0.6rem;margin-top:1rem}
        .btn-primary{display:inline-flex;align-items:center;gap:0.45rem;height:40px;padding:0 1.1rem;background:#1d4ed8;color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;transition:background 0.18s}
        .btn-primary:hover{background:#1e40af}
        .btn-cancel{height:40px;padding:0 1.1rem;border:1px solid #e2e8f0;border-radius:10px;background:transparent;color:#334155;font-size:0.85rem;font-weight:600;cursor:pointer}
        .empty-state{padding:3rem;text-align:center;color:#94a3b8;font-size:0.9rem}
        .link-archivo{font-size:0.82rem;color:#1d4ed8;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem}
        .link-archivo:hover{text-decoration:underline}
      `}</style>

      <div style={{ marginBottom:'1.25rem' }}>
        <h1 className="page-title">Evaluar Evidencias</h1>
        <p className="page-sub">Revisión y calificación de evidencias entregadas por tutorados</p>
      </div>

      <div className="filter-row">
        {[['all','Todas'],['entregada','Entregadas'],['requiere_correccion','Req. corrección'],['aceptada','Aceptadas'],['rechazada','Rechazadas']].map(([v,l])=>(
          <button key={v} className={`filter-btn${filtro===v?' active':''}`} onClick={()=>setFiltro(v)}>{l}</button>
        ))}
      </div>

      {loading ? <div className="empty-state">Cargando evidencias…</div>
        : filtered.length===0 ? <div className="empty-state">No hay evidencias con ese filtro</div>
        : (
        <div className="ev-grid">
          {filtered.map(ev => {
            const ec = ESTADO_COLORS[ev.estado] ?? ESTADO_COLORS.pendiente
            return (
              <div key={ev.id} className="ev-card">
                <div className="ev-actividad">{ev.actividad_nombre}</div>
                <div className="ev-nombre">{ev.tutorado_nombre}</div>
                {ev.comentario_alumno && <p style={{ fontSize:'0.82rem', color:'#475569', margin:'0 0 0.5rem' }}>"{ev.comentario_alumno}"</p>}
                {ev.archivo_url && (
                  <a className="link-archivo" href={ev.archivo_url} target="_blank" rel="noreferrer">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    {ev.archivo_nombre ?? 'Ver archivo'}
                  </a>
                )}
                <div className="ev-foot">
                  <span className="badge" style={{ background:ec.bg, color:ec.text, borderColor:ec.border }}>{ESTADO_LABELS[ev.estado]}</span>
                  {(ev.estado==='entregada'||ev.estado==='requiere_correccion') && (
                    <button className="btn-sm" onClick={()=>openEval(ev)}>Evaluar</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
          <div className="modal-card">
            <h2 className="modal-title">Evaluar evidencia</h2>
            <p style={{ fontSize:'0.86rem', color:'#334155', marginBottom:'1rem' }}>
              <strong>{selected.tutorado_nombre}</strong> · {selected.actividad_nombre}
            </p>
            <div className="field">
              <label>Resultado *</label>
              <select className="fi" value={resultado} onChange={e=>setResultado(e.target.value)}>
                <option value="aceptada">Aceptada</option>
                <option value="requiere_correccion">Requiere corrección</option>
                <option value="rechazada">Rechazada</option>
              </select>
            </div>
            <div className="field">
              <label>Retroalimentación{(resultado==='requiere_correccion'||resultado==='rechazada')?' *':''}</label>
              <textarea className="fi fi-ta" value={retro} onChange={e=>setRetro(e.target.value)} placeholder="Escribe tu retroalimentación para el tutorado…" />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={()=>setSelected(null)}>Cancelar</button>
              <button className="btn-primary" disabled={saving} onClick={handleEvaluar}>{saving?'Guardando…':'Guardar evaluación'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
