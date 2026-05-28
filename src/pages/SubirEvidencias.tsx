import { useState, useEffect, useRef } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

interface Actividad {
  id: string
  nombre: string
  descripcion: string | null
  fecha_limite: string | null
  tipos_aceptados: string[] | null
  evidencia?: { id: string; estado: string; archivo_nombre: string | null; fecha_entrega: string } | null
}

const ESTADO_INFO: Record<string,{label:string;bg:string;text:string;border:string}> = {
  pendiente:          {label:'Pendiente',          bg:'#f8fafc', text:'#64748b', border:'#e2e8f0'},
  entregada:          {label:'Entregada',           bg:'#eff6ff', text:'#1d4ed8', border:'#bfdbfe'},
  aceptada:           {label:'Aceptada',            bg:'#f0fdf4', text:'#166534', border:'#bbf7d0'},
  requiere_correccion:{label:'Requiere corrección', bg:'#fffbeb', text:'#92400e', border:'#fde68a'},
  rechazada:          {label:'Rechazada',           bg:'#fef2f2', text:'#991b1b', border:'#fecaca'},
}

export default function SubirEvidencias() {
  const { perfil } = useAuth()
  const { toast }  = useToast()
  const fileRef    = useRef<HTMLInputElement>(null)

  const [actividades, setActividades] = useState<Actividad[]>([])
  const [loading,     setLoading]     = useState(true)
  const [selected,    setSelected]    = useState<Actividad|null>(null)
  const [file,        setFile]        = useState<File|null>(null)
  const [comentario,  setComentario]  = useState('')
  const [saving,      setSaving]      = useState(false)
  const [periodoId,   setPeriodoId]   = useState('')

  useEffect(() => {
    if (!perfil) return
    supabase.from('periodos_escolares').select('id').eq('activo',true).single().then(async ({ data: per }) => {
      if (!per) { setLoading(false); return }
      const pid = (per as {id:string}).id; setPeriodoId(pid)
      const { data: asig } = await supabase.from('asignaciones_tutorado').select('asignacion_id').eq('tutorado_id',perfil.id).eq('periodo_id',pid).eq('activa',true).maybeSingle()
      if (!asig) { setLoading(false); return }
      const { data: actData } = await supabase.from('actividades_pt').select('id,nombre,descripcion,fecha_limite_evidencia,tipo_archivo_aceptado').eq('estado','activa').eq('requiere_evidencia',true).order('fecha_limite_evidencia')
      const actIds = (actData??[]).map((a:{id:string})=>a.id)
      const { data: evData } = await supabase.from('evidencias').select('id,actividad_pt_id,estado,archivo_nombre,fecha_entrega').eq('tutorado_id',perfil.id).eq('periodo_id',pid).in('actividad_pt_id',actIds)
      type EvRow = { id: string; actividad_pt_id: string; estado: string; archivo_nombre: string | null; fecha_entrega: string }
      const evMap: Record<string,EvRow> = {}
      ;(evData??[]).forEach((e: {actividad_pt_id:string;id:string;estado:string;archivo_nombre:string|null;fecha_entrega:string}) => { evMap[e.actividad_pt_id] = e })
      setActividades(
        (actData??[]).map((a: {id:string;nombre:string;descripcion:string|null;fecha_limite_evidencia:string|null;tipo_archivo_aceptado:string[]|null}) => ({
          id: a.id, nombre: a.nombre, descripcion: a.descripcion,
          fecha_limite: a.fecha_limite_evidencia,
          tipos_aceptados: a.tipo_archivo_aceptado,
          evidencia: evMap[a.id] ?? null,
        }))
      )
      setLoading(false)
    })
  }, [perfil])

  async function handleSubir() {
    if (!selected || !perfil || !periodoId) return
    if (!file) { toast.warning('Selecciona un archivo para subir'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Archivo demasiado grande', 'El límite es 10 MB'); return }
    setSaving(true)
    const ext = file.name.split('.').pop()
    const path = `evidencias/${perfil.id}/${selected.id}-${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('evidencias').upload(path, file)
    if (uploadErr) { toast.error('Error al subir archivo', uploadErr.message); setSaving(false); return }
    const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(path)
    const evExistente = selected.evidencia
    const payload = {
      actividad_pt_id: selected.id, tutorado_id: perfil.id, periodo_id: periodoId,
      archivo_url: urlData.publicUrl, archivo_nombre: file.name,
      archivo_tipo: file.type, archivo_tamano_kb: Math.round(file.size/1024),
      comentario_alumno: comentario || null, estado: 'entregada',
    }
    const { error } = evExistente
      ? await supabase.from('evidencias').update(payload).eq('id',evExistente.id)
      : await supabase.from('evidencias').insert(payload)
    if (error) toast.error('Error',error.message)
    else {
      toast.success('Evidencia entregada', 'Tu tutor recibirá una notificación.')
      setActividades(prev => prev.map(a => a.id===selected.id ? { ...a, evidencia: { id: evExistente?.id ?? '', estado:'entregada', archivo_nombre:file.name, fecha_entrega: new Date().toISOString() } } : a))
      setSelected(null); setFile(null); setComentario('')
    }
    setSaving(false)
  }

  return (
    <>
      <style>{`
        .page-title{font-size:1.25rem;font-weight:800;color:#1e3a8a;margin:0}
        .page-sub{font-size:0.82rem;color:#64748b;margin:0.15rem 0 0}
        .act-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0.85rem;margin-top:1rem}
        .act-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1.1rem;cursor:pointer;transition:all 0.15s;position:relative}
        .act-card:hover{box-shadow:0 6px 20px rgba(37,99,235,0.1);border-color:#bfdbfe}
        .act-card.has-ev{border-color:#bbf7d0}
        .act-nombre{font-weight:700;font-size:0.92rem;color:#0f172a;margin-bottom:0.3rem}
        .act-desc{font-size:0.8rem;color:#475569;margin-bottom:0.65rem}
        .act-foot{display:flex;align-items:center;justify-content:space-between}
        .act-fecha{font-size:0.75rem;color:#94a3b8}
        .badge{display:inline-block;font-size:0.72rem;font-weight:700;padding:3px 9px;border-radius:8px;border:1px solid}
        .modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.45);backdrop-filter:blur(4px);z-index:100;display:grid;place-items:center;padding:1rem}
        .modal-card{background:#fff;border-radius:18px;padding:1.5rem;width:100%;max-width:480px;box-shadow:0 32px 64px rgba(37,99,235,0.18);animation:modalIn 0.25s ease}
        @keyframes modalIn{from{opacity:0;transform:translateY(14px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        .modal-title{font-size:1.05rem;font-weight:800;color:#1e3a8a;margin:0 0 1rem}
        .drop-zone{border:2px dashed #bfdbfe;border-radius:12px;padding:1.5rem;text-align:center;cursor:pointer;background:#eff6ff;transition:all 0.15s;margin-bottom:0.85rem}
        .drop-zone:hover{border-color:#1d4ed8;background:#dbeafe}
        .drop-zone.has-file{border-color:#16a34a;background:#f0fdf4}
        .fi-ta{width:100%;min-height:76px;border:1px solid #cbd5e1;border-radius:10px;padding:0.65rem 0.85rem;font-size:0.88rem;color:#0f172a;background:#fff;outline:none;resize:vertical;margin-bottom:0.85rem}
        .fi-ta:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
        .modal-actions{display:flex;justify-content:flex-end;gap:0.6rem}
        .btn-primary{display:inline-flex;align-items:center;gap:0.45rem;height:40px;padding:0 1.1rem;background:#1d4ed8;color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;transition:background 0.18s}
        .btn-primary:hover{background:#1e40af}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed}
        .btn-cancel{height:40px;padding:0 1.1rem;border:1px solid #e2e8f0;border-radius:10px;background:transparent;color:#334155;font-size:0.85rem;font-weight:600;cursor:pointer}
        .empty-state{padding:3rem;text-align:center;color:#94a3b8;font-size:0.9rem}
        .tipos-tag{display:inline-flex;gap:0.3rem;flex-wrap:wrap;margin-top:0.4rem}
        .tipo-chip{background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;padding:2px 7px;border-radius:6px;font-size:0.72rem;font-weight:600}
      `}</style>

      <div style={{ marginBottom:'1.25rem' }}>
        <h1 className="page-title">Subir Evidencias</h1>
        <p className="page-sub">Carga los archivos requeridos por tu tutor para cada actividad</p>
      </div>

      {loading ? <div className="empty-state">Cargando actividades…</div>
        : actividades.length===0 ? <div className="empty-state">No tienes actividades con entrega de evidencia pendiente</div>
        : (
        <div className="act-grid">
          {actividades.map(a => {
            const ev = a.evidencia; const ei = ev ? ESTADO_INFO[ev.estado] ?? ESTADO_INFO.pendiente : null
            return (
              <div key={a.id} className={`act-card${ev?'.has-ev':''}`} onClick={()=>{ if(!ev||ev.estado==='requiere_correccion'){ setSelected(a);setFile(null);setComentario('') } }}>
                <div className="act-nombre">{a.nombre}</div>
                {a.descripcion && <div className="act-desc">{a.descripcion}</div>}
                {a.tipos_aceptados && (
                  <div className="tipos-tag">{a.tipos_aceptados.map(t=><span key={t} className="tipo-chip">{t}</span>)}</div>
                )}
                <div className="act-foot" style={{ marginTop:'0.75rem' }}>
                  {a.fecha_limite && <span className="act-fecha">Límite: {a.fecha_limite}</span>}
                  {ei
                    ? <span className="badge" style={{ background:ei.bg, color:ei.text, borderColor:ei.border }}>{ei.label}</span>
                    : <span className="badge" style={{ background:'#eff6ff', color:'#1d4ed8', borderColor:'#bfdbfe' }}>Subir archivo</span>
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget){setSelected(null);setFile(null)}}}>
          <div className="modal-card">
            <h2 className="modal-title">{selected.nombre}</h2>
            <input ref={fileRef} type="file" style={{ display:'none' }} accept={selected.tipos_aceptados?.map(t=>`.${t}`).join(',') ?? '*'} onChange={e=>setFile(e.target.files?.[0]??null)} />
            <div className={`drop-zone${file?' has-file':''}`} onClick={()=>fileRef.current?.click()}>
              {file
                ? <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg><p style={{ margin:'0.5rem 0 0', fontSize:'0.86rem', color:'#166534', fontWeight:700 }}>{file.name}</p><p style={{ margin:'0.25rem 0 0', fontSize:'0.76rem', color:'#166534' }}>{(file.size/1024).toFixed(1)} KB</p></>
                : <><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg><p style={{ margin:'0.5rem 0 0', fontSize:'0.86rem', color:'#1d4ed8', fontWeight:700 }}>Seleccionar archivo</p><p style={{ margin:'0.25rem 0 0', fontSize:'0.74rem', color:'#64748b' }}>Máx. 10 MB{selected.tipos_aceptados ? ` · ${selected.tipos_aceptados.join(', ')}` : ''}</p></>
              }
            </div>
            <textarea className="fi-ta" placeholder="Comentario opcional para tu tutor…" value={comentario} onChange={e=>setComentario(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={()=>{setSelected(null);setFile(null)}}>Cancelar</button>
              <button className="btn-primary" disabled={saving||!file} onClick={handleSubir}>{saving?'Subiendo…':'Entregar evidencia'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
