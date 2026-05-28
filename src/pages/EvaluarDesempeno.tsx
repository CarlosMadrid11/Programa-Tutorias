import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

interface Tutorado { id: string; nombre_completo: string; numero_control: string | null; carrera: string | null }
interface AsigInfo  { asignacion_id: string; periodo_id: string }

const ESCALA = [0,1,2,3,4]
const ESCALA_LABELS: Record<number,string> = { 0:'Insuficiente',1:'Insuficiente',2:'Suficiente',3:'Notable',4:'Excelente' }
const TIPOS_EVAL = ['parcial_1','parcial_2','final'] as const
const TIPO_LABELS: Record<string,string> = { parcial_1:'1ª Evaluación Parcial', parcial_2:'2ª Evaluación Parcial', final:'Evaluación Final' }

function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (v:number)=>void }) {
  return (
    <div style={{ marginBottom:'0.9rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'0.35rem' }}>
        <span style={{ fontSize:'0.82rem', fontWeight:700, color:'#334155' }}>{label}</span>
        <span style={{ fontSize:'0.8rem', color:'#1d4ed8', fontWeight:700 }}>{value}/4 — {ESCALA_LABELS[value]}</span>
      </div>
      <div style={{ display:'flex', gap:'0.4rem' }}>
        {ESCALA.map(n=>(
          <button key={n} type="button"
            style={{ flex:1, height:36, borderRadius:8, border:`1.5px solid ${value>=n&&n>0?'#1d4ed8':'#e2e8f0'}`, background:value>=n&&n>0?'#eff6ff':'transparent', cursor:'pointer', fontWeight:800, fontSize:'0.88rem', color:value>=n&&n>0?'#1d4ed8':'#cbd5e1', transition:'all 0.15s' }}
            onClick={()=>onChange(n)}
          >{n}</button>
        ))}
      </div>
    </div>
  )
}

export default function EvaluarDesempeno() {
  const { perfil } = useAuth()
  const { toast }  = useToast()

  const [tutorados, setTutorados] = useState<Tutorado[]>([])
  const [asigMap,   setAsigMap]   = useState<Record<string,AsigInfo>>({})
  const [selected,  setSelected]  = useState<Tutorado|null>(null)
  const [tipo,      setTipo]      = useState<typeof TIPOS_EVAL[number]>('parcial_1')
  const [vals,      setVals]      = useState({ personal:2, academica:2, profesional:2, observaciones:'', recomendaciones:'' })
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (!perfil) return
    supabase.from('periodos_escolares').select('id').eq('activo',true).single().then(async ({ data: per }) => {
      if (!per) return
      const pid = (per as {id:string}).id
      const { data: asigs } = await supabase.from('asignaciones_tutor').select('id').eq('tutor_id',perfil.id).eq('periodo_id',pid).eq('activa',true)
      const asigIds = (asigs??[]).map((a:{id:string})=>a.id)
      if (!asigIds.length) return
      const { data: asigTut } = await supabase.from('asignaciones_tutorado')
        .select('tutorado_id,asignacion_id,perfiles!asignaciones_tutorado_tutorado_id_fkey(nombre_completo,numero_control,carrera)')
        .in('asignacion_id',asigIds).eq('activa',true)
      const map: Record<string,AsigInfo> = {}
      const ts: Tutorado[] = (asigTut??[]).map((r: Record<string,unknown>) => {
        map[r.tutorado_id as string] = { asignacion_id: r.asignacion_id as string, periodo_id: pid }
        return {
          id: r.tutorado_id as string,
          nombre_completo: ((r.perfiles as {nombre_completo:string}|null)?.nombre_completo ?? '—'),
          numero_control: (r.perfiles as {numero_control:string|null}|null)?.numero_control ?? null,
          carrera: (r.perfiles as {carrera:string|null}|null)?.carrera ?? null,
        }
      })
      setTutorados(ts); setAsigMap(map)
    })
  }, [perfil])

  async function handleEvaluar() {
    if (!selected || !perfil) return
    const ai = asigMap[selected.id]
    if (!ai) return
    const calFinal = (vals.personal + vals.academica + vals.profesional) / 3
    setSaving(true)
    const { error } = await supabase.from('evaluaciones').upsert({
      tutorado_id: selected.id,
      asignacion_id: ai.asignacion_id,
      periodo_id: ai.periodo_id,
      tipo,
      calificacion_personal: vals.personal,
      calificacion_academica: vals.academica,
      calificacion_profesional: vals.profesional,
      calificacion_final: Math.round(calFinal * 10) / 10,
      observaciones: vals.observaciones || null,
      recomendaciones: vals.recomendaciones || null,
      estado_tutorado: calFinal < 2 ? 'en_riesgo' : 'al_corriente',
      evaluado_por: perfil.id,
    }, { onConflict: 'tutorado_id,periodo_id,tipo' })
    if (error) toast.error('Error al guardar evaluación', error.message)
    else {
      if (calFinal < 2) toast.warning('Tutorado en riesgo', 'La calificación promedio es menor a 2. Se generará notificación al coordinador.')
      else toast.success('Evaluación registrada', `Cal. final: ${(Math.round(calFinal*10)/10).toFixed(1)} / 4`)
      setSelected(null)
    }
    setSaving(false)
  }

  return (
    <>
      <style>{`
        .page-title{font-size:1.25rem;font-weight:800;color:#1e3a8a;margin:0}
        .page-sub{font-size:0.82rem;color:#64748b;margin:0.15rem 0 0}
        .two-col{display:grid;grid-template-columns:300px 1fr;gap:1rem;margin-top:1rem}
        .list-panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;height:fit-content}
        .list-head{padding:0.85rem 1rem;background:#f8fafc;border-bottom:1px solid #f1f5f9;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#64748b}
        .list-item{padding:0.8rem 1rem;border-bottom:1px solid #f8fafc;cursor:pointer;transition:background 0.1s;display:flex;flex-direction:column;gap:2px}
        .list-item:last-child{border-bottom:none}
        .list-item:hover{background:#eff6ff}
        .list-item.active{background:#eff6ff;border-left:3px solid #1d4ed8}
        .eval-panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:1.25rem}
        .eval-title{font-size:1rem;font-weight:800;color:#1e3a8a;margin:0 0 1.25rem}
        .fi{height:42px;border:1px solid #cbd5e1;border-radius:10px;padding:0 0.85rem;font-size:0.88rem;color:#0f172a;background:#fff;outline:none;width:100%}
        .fi:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
        .fi-ta{min-height:76px;padding:0.65rem 0.85rem;resize:vertical}
        .field{display:flex;flex-direction:column;gap:0.3rem;margin-bottom:0.85rem}
        label{font-size:0.76rem;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.06em}
        .btn-primary{display:inline-flex;align-items:center;gap:0.45rem;height:42px;padding:0 1.25rem;background:#1d4ed8;color:#fff;border:none;border-radius:10px;font-size:0.88rem;font-weight:700;cursor:pointer;transition:background 0.18s}
        .btn-primary:hover{background:#1e40af}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed}
        .empty-msg{padding:3rem 1rem;text-align:center;color:#94a3b8;font-size:0.9rem}
        .prom-bar{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:0.7rem 1rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between}
        .prom-val{font-size:1.4rem;font-weight:800;color:#1d4ed8}
        .prom-lbl{font-size:0.82rem;color:#334155;font-weight:600}
        @media(max-width:768px){.two-col{grid-template-columns:1fr}}
      `}</style>

      <div style={{ marginBottom:'1.25rem' }}>
        <h1 className="page-title">Evaluar Desempeño</h1>
        <p className="page-sub">Evaluaciones parciales y seguimiento integral de tutorados</p>
      </div>

      <div className="two-col">
        <div className="list-panel">
          <div className="list-head">Mis Tutorados ({tutorados.length})</div>
          {tutorados.length===0
            ? <div className="empty-msg">Sin tutorados asignados</div>
            : tutorados.map(t=>(
            <div key={t.id} className={`list-item${selected?.id===t.id?' active':''}`} onClick={()=>{setSelected(t);setVals({personal:2,academica:2,profesional:2,observaciones:'',recomendaciones:''})}}>
              <span style={{ fontWeight:700, fontSize:'0.88rem', color:'#0f172a' }}>{t.nombre_completo}</span>
              <span style={{ fontSize:'0.74rem', color:'#64748b' }}>{t.numero_control ?? '—'} · {t.carrera ?? '—'}</span>
            </div>
          ))}
        </div>

        <div className="eval-panel">
          {!selected
            ? <div className="empty-msg">Selecciona un tutorado para evaluar</div>
            : (
            <>
              <h3 className="eval-title">{selected.nombre_completo}</h3>
              <div className="field">
                <label>Tipo de evaluación</label>
                <select className="fi" value={tipo} onChange={e=>setTipo(e.target.value as typeof TIPOS_EVAL[number])}>
                  {TIPOS_EVAL.map(t=><option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="prom-bar">
                <span className="prom-lbl">Promedio parcial</span>
                <span className="prom-val">{((vals.personal+vals.academica+vals.profesional)/3).toFixed(1)}<span style={{ fontSize:'0.9rem', fontWeight:600 }}>/4</span></span>
              </div>
              <StarRow label="Dimensión Personal" value={vals.personal} onChange={v=>setVals(p=>({...p,personal:v}))} />
              <StarRow label="Dimensión Académica" value={vals.academica} onChange={v=>setVals(p=>({...p,academica:v}))} />
              <StarRow label="Dimensión Profesional" value={vals.profesional} onChange={v=>setVals(p=>({...p,profesional:v}))} />
              <div className="field">
                <label>Observaciones</label>
                <textarea className="fi fi-ta" value={vals.observaciones} onChange={e=>setVals(p=>({...p,observaciones:e.target.value}))} placeholder="Notas sobre el desempeño del tutorado…" />
              </div>
              <div className="field">
                <label>Recomendaciones</label>
                <textarea className="fi fi-ta" value={vals.recomendaciones} onChange={e=>setVals(p=>({...p,recomendaciones:e.target.value}))} placeholder="Recomendaciones para el siguiente periodo…" />
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button className="btn-primary" disabled={saving} onClick={handleEvaluar}>{saving?'Guardando…':'Guardar evaluación'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
