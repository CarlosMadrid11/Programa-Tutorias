import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

interface AsigTutor    { id: string; tutor_nombre: string; carrera: string; grupo: string; cupo: number }
interface Tutorado     { id: string; nombre_completo: string; numero_control: string | null; carrera: string | null }
interface AsigTutorado { id: string; tutorado_id: string; tutorado_nombre: string; numero_control: string | null }

export default function AsignarTutorado() {
  const { perfil } = useAuth()
  const { toast }  = useToast()

  const [asigTutores,   setAsigTutores]   = useState<AsigTutor[]>([])
  const [asigActual,    setAsigActual]     = useState('')
  const [tutoradosSin,  setTutoradosSin]  = useState<Tutorado[]>([])
  const [tutoradosCon,  setTutoradosCon]  = useState<AsigTutorado[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [periodoId,     setPeriodoId]     = useState('')
  const [saving,        setSaving]        = useState(false)

  useEffect(() => {
    supabase.from('periodos_escolares').select('id').eq('activo',true).single()
      .then(({ data }) => {
        if (data) {
          const pid = (data as {id:string}).id
          setPeriodoId(pid)
          supabase.from('asignaciones_tutor')
            .select('id,carrera,grupo,perfiles(nombre_completo)')
            .eq('periodo_id', pid).eq('activa',true)
            .then(({ data: asData }) => {
              const rows = (asData ?? []).map((r: Record<string,unknown>) => ({
                id: r.id as string,
                tutor_nombre: ((r.perfiles as {nombre_completo:string}|null)?.nombre_completo ?? ''),
                carrera: r.carrera as string,
                grupo: r.grupo as string,
                cupo: 30,
              }))
              setAsigTutores(rows)
              if (rows.length > 0) setAsigActual(rows[0].id)
            })
        }
      })
  }, [])

  useEffect(() => {
    if (!asigActual || !periodoId) return
    const at = asigTutores.find(a=>a.id===asigActual)
    Promise.all([
      supabase.from('perfiles')
        .select('id,nombre_completo,numero_control,carrera')
        .eq('rol','tutorado').eq('estado','activo')
        .not('id','in',`(select tutorado_id from asignaciones_tutorado where periodo_id='${periodoId}' and activa=true)`),
      supabase.from('asignaciones_tutorado')
        .select('id,tutorado_id,perfiles(nombre_completo,numero_control)')
        .eq('asignacion_id',asigActual).eq('activa',true),
    ]).then(([sin, con]) => {
      setTutoradosSin((sin.data ?? []).filter((t: Record<string,unknown>) => !at || !at.carrera || (t.carrera as string|null)?.toLowerCase().includes(at.carrera.toLowerCase())) as unknown as Tutorado[])
      const conRows = (con.data ?? []).map((r: Record<string,unknown>) => ({
        id: r.id as string,
        tutorado_id: r.tutorado_id as string,
        tutorado_nombre: ((r.perfiles as {nombre_completo:string}|null)?.nombre_completo ?? ''),
        numero_control: (r.perfiles as {numero_control:string|null}|null)?.numero_control ?? null,
      }))
      setTutoradosCon(conRows)
      setSeleccionados(new Set())
    })
  }, [asigActual, periodoId, asigTutores])

  function toggleSel(id: string) {
    setSeleccionados(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  }

  async function handleAsignar() {
    if (seleccionados.size===0) { toast.warning('Selecciona al menos un tutorado'); return }
    if (!perfil) return
    setSaving(true)
    const rows = [...seleccionados].map(tid => ({
      asignacion_id: asigActual, tutorado_id: tid, periodo_id: periodoId, asignado_por: perfil.id,
    }))
    const { error } = await supabase.from('asignaciones_tutorado').insert(rows)
    if (error) toast.error('Error al asignar', error.message)
    else {
      toast.success(`${seleccionados.size} tutorado(s) asignados exitosamente`)
      setSeleccionados(new Set())
      const { data: con } = await supabase.from('asignaciones_tutorado')
        .select('id,tutorado_id,perfiles(nombre_completo,numero_control)')
        .eq('asignacion_id',asigActual).eq('activa',true)
      const conRows = (con ?? []).map((r: Record<string,unknown>) => ({
        id: r.id as string, tutorado_id: r.tutorado_id as string,
        tutorado_nombre: ((r.perfiles as {nombre_completo:string}|null)?.nombre_completo ?? ''),
        numero_control: (r.perfiles as {numero_control:string|null}|null)?.numero_control ?? null,
      }))
      setTutoradosCon(conRows)
      setTutoradosSin(prev => prev.filter(t => !seleccionados.has(t.id)))
    }
    setSaving(false)
  }

  const at = asigTutores.find(a=>a.id===asigActual)

  return (
    <>
      <style>{`
        .page-title{font-size:1.25rem;font-weight:800;color:#1e3a8a;margin:0}
        .page-sub{font-size:0.82rem;color:#64748b;margin:0.15rem 0 0}
        .btn-primary{display:inline-flex;align-items:center;gap:0.45rem;height:40px;padding:0 1.1rem;background:#1d4ed8;color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;transition:background 0.18s}
        .btn-primary:hover{background:#1e40af}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed}
        .select-w{height:40px;border:1px solid #e2e8f0;border-radius:10px;padding:0 0.85rem;font-size:0.88rem;color:#0f172a;background:#fff;outline:none;min-width:220px}
        .select-w:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
        .two-col{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1rem}
        .panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}
        .panel-head{padding:0.85rem 1rem;background:#f8fafc;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between}
        .panel-title{font-size:0.82rem;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.07em}
        .panel-count{font-size:0.78rem;color:#64748b}
        .item-row{padding:0.75rem 1rem;border-bottom:1px solid #f8fafc;display:flex;align-items:center;gap:0.65rem;cursor:pointer;transition:background 0.1s;font-size:0.86rem;color:#0f172a}
        .item-row:last-child{border-bottom:none}
        .item-row:hover{background:#eff6ff}
        .item-row.selected{background:#eff6ff}
        .item-num{font-size:0.74rem;color:#64748b}
        .empty-panel{padding:2rem 1rem;text-align:center;color:#94a3b8;font-size:0.86rem}
        @media(max-width:640px){.two-col{grid-template-columns:1fr}}
      `}</style>

      <div style={{ marginBottom:'1.25rem' }}>
        <h1 className="page-title">Asignar Tutorados</h1>
        <p className="page-sub">Vincula tutorados a los grupos tutoriales</p>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
        <label style={{ fontSize:'0.83rem', fontWeight:700, color:'#334155' }}>Grupo:</label>
        <select className="select-w" value={asigActual} onChange={e=>setAsigActual(e.target.value)}>
          {asigTutores.map(a=>(
            <option key={a.id} value={a.id}>{a.tutor_nombre} — {a.carrera} Gpo. {a.grupo}</option>
          ))}
        </select>
        {seleccionados.size>0 && (
          <button className="btn-primary" disabled={saving} onClick={handleAsignar}>
            {saving ? 'Asignando…' : `Asignar ${seleccionados.size} tutorado(s)`}
          </button>
        )}
      </div>

      {at && (
        <div style={{ marginTop:'0.85rem', padding:'0.75rem 1rem', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, fontSize:'0.84rem', color:'#1e40af', fontWeight:600 }}>
          {at.carrera} · Grupo {at.grupo} · {tutoradosCon.length} tutorados asignados
        </div>
      )}

      <div className="two-col">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Disponibles para asignar</span>
            <span className="panel-count">{tutoradosSin.length}</span>
          </div>
          {tutoradosSin.length===0
            ? <div className="empty-panel">No hay tutorados disponibles</div>
            : tutoradosSin.map(t=>(
              <div key={t.id} className={`item-row${seleccionados.has(t.id)?' selected':''}`} onClick={()=>toggleSel(t.id)}>
                <input type="checkbox" checked={seleccionados.has(t.id)} readOnly style={{ accentColor:'#1d4ed8', width:14 }} />
                <div>
                  <div style={{ fontWeight:600 }}>{t.nombre_completo}</div>
                  <div className="item-num">{t.numero_control ?? '—'} · {t.carrera ?? '—'}</div>
                </div>
              </div>
            ))
          }
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Ya asignados a este grupo</span>
            <span className="panel-count">{tutoradosCon.length}</span>
          </div>
          {tutoradosCon.length===0
            ? <div className="empty-panel">Sin tutorados asignados aún</div>
            : tutoradosCon.map(t=>(
              <div key={t.id} className="item-row" style={{ cursor:'default' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <div>
                  <div style={{ fontWeight:600 }}>{t.tutorado_nombre}</div>
                  <div className="item-num">{t.numero_control ?? '—'}</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </>
  )
}
