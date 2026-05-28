import { useState, useEffect, type FormEvent } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

interface AsigTutor { id: string; carrera: string; grupo: string; dia_semana: string; hora_inicio: string }
interface Tutorado  { id: string; nombre_completo: string; numero_control: string | null }
interface Sesion    { id: string; fecha_realizada: string; cerrada: boolean; actividad_nombre?: string }

type EstadoAsist = 'presente' | 'ausente' | 'justificado'

const estadoColors: Record<EstadoAsist, { bg: string; border: string; text: string }> = {
  presente:   { bg:'#f0fdf4', border:'#bbf7d0', text:'#166534' },
  ausente:    { bg:'#fef2f2', border:'#fecaca', text:'#991b1b' },
  justificado:{ bg:'#fffbeb', border:'#fde68a', text:'#92400e' },
}

export default function CapturarAsistencia() {
  const { perfil } = useAuth()
  const { toast }  = useToast()

  const [grupos,     setGrupos]     = useState<AsigTutor[]>([])
  const [grupoId,    setGrupoId]    = useState('')
  const [sesiones,   setSesiones]   = useState<Sesion[]>([])
  const [sesionId,   setSesionId]   = useState<'new'|string>('new')
  const [tutorados,  setTutorados]  = useState<Tutorado[]>([])
  const [asistencia, setAsistencia] = useState<Record<string,EstadoAsist>>({})
  const [fechaNueva, setFechaNueva] = useState('')
  const [actividades,setActividades]= useState<{id:string;nombre:string}[]>([])
  const [actividadId,setActividadId]= useState('')
  const [saving,     setSaving]     = useState(false)
  const [periodoId,  setPeriodoId]  = useState('')

  useEffect(() => {
    if (!perfil) return
    supabase.from('periodos_escolares').select('id').eq('activo',true).single()
      .then(({ data }) => {
        if (data) {
          const pid = (data as {id:string}).id
          setPeriodoId(pid)
          supabase.from('asignaciones_tutor')
            .select('id,carrera,grupo,dia_semana,hora_inicio')
            .eq('tutor_id',perfil.id).eq('periodo_id',pid).eq('activa',true)
            .then(({ data: gs }) => {
              const g = (gs ?? []) as AsigTutor[]
              setGrupos(g); if(g.length>0) setGrupoId(g[0].id)
            })
        }
      })
  }, [perfil])

  useEffect(() => {
    if (!grupoId || !periodoId) return
    Promise.all([
      supabase.from('sesiones').select('id,fecha_realizada,cerrada,actividades_pt(nombre)').eq('asignacion_id',grupoId).order('fecha_realizada',{ascending:false}),
      supabase.from('asignaciones_tutorado').select('tutorado_id,perfiles(nombre_completo,numero_control)').eq('asignacion_id',grupoId).eq('activa',true),
      supabase.from('actividades_pt').select('id,nombre').eq('estado','activa').order('fecha_programada'),
    ]).then(([ses, tut, act]) => {
      setSesiones((ses.data ?? []).map((s: Record<string,unknown>) => ({
        id: s.id as string, fecha_realizada: s.fecha_realizada as string, cerrada: s.cerrada as boolean,
        actividad_nombre: (s.actividades_pt as {nombre:string}|null)?.nombre,
      })))
      setTutorados((tut.data ?? []).map((r: Record<string,unknown>) => ({
        id: (r.perfiles as {id?:string}|null)?.id ?? r.tutorado_id as string,
        nombre_completo: (r.perfiles as {nombre_completo:string}|null)?.nombre_completo ?? '',
        numero_control: (r.perfiles as {numero_control:string|null}|null)?.numero_control ?? null,
      })))
      setActividades((act.data ?? []) as {id:string;nombre:string}[])
      const init: Record<string,EstadoAsist> = {}
      tutorados.forEach(t => { init[t.id] = 'presente' })
      setAsistencia(init)
      setSesionId('new'); setFechaNueva('')
    })
  }, [grupoId, periodoId])

  useEffect(() => {
    if (sesionId === 'new' || !sesionId) {
      const init: Record<string,EstadoAsist> = {}
      tutorados.forEach(t => { init[t.id] = 'presente' })
      setAsistencia(init)
    } else {
      supabase.from('asistencias').select('tutorado_id,estado').eq('sesion_id',sesionId)
        .then(({ data }) => {
          const map: Record<string,EstadoAsist> = {}
          tutorados.forEach(t => { map[t.id] = 'presente' })
          ;(data ?? []).forEach((a: {tutorado_id:string;estado:EstadoAsist}) => { map[a.tutorado_id] = a.estado })
          setAsistencia(map)
        })
    }
  }, [sesionId, tutorados])

  async function handleGuardar(e: FormEvent) {
    e.preventDefault()
    if (!perfil) return
    setSaving(true)
    let sid = sesionId
    if (sesionId === 'new') {
      if (!fechaNueva) { toast.warning('Ingresa la fecha de la sesión'); setSaving(false); return }
      const { data: sesData, error: sesErr } = await supabase.from('sesiones').insert({
        asignacion_id: grupoId,
        actividad_pt_id: actividadId || null,
        fecha_realizada: fechaNueva,
        creado_por: perfil.id,
      }).select('id').single()
      if (sesErr) { toast.error('Error al crear sesión', sesErr.message); setSaving(false); return }
      sid = (sesData as {id:string}).id
    }
    const rows = tutorados.map(t => ({
      sesion_id: sid,
      tutorado_id: t.id,
      estado: asistencia[t.id] ?? 'presente',
      capturado_por: perfil.id,
    }))
    const { error } = await supabase.from('asistencias').upsert(rows, { onConflict:'sesion_id,tutorado_id' })
    if (error) toast.error('Error', error.message)
    else {
      toast.success('Asistencia guardada exitosamente')
      if (sesionId === 'new') {
        const { data: ses } = await supabase.from('sesiones').select('id,fecha_realizada,cerrada,actividades_pt(nombre)').eq('asignacion_id',grupoId).order('fecha_realizada',{ascending:false})
        setSesiones((ses ?? []).map((s: Record<string,unknown>) => ({
          id: s.id as string, fecha_realizada: s.fecha_realizada as string, cerrada: s.cerrada as boolean,
          actividad_nombre: (s.actividades_pt as {nombre:string}|null)?.nombre,
        })))
        setSesionId(sid)
      }
    }
    setSaving(false)
  }

  const grupo = grupos.find(g=>g.id===grupoId)

  return (
    <>
      <style>{`
        .page-title{font-size:1.25rem;font-weight:800;color:#1e3a8a;margin:0}
        .page-sub{font-size:0.82rem;color:#64748b;margin:0.15rem 0 0}
        .ctrl-row{display:flex;align-items:center;gap:0.65rem;flex-wrap:wrap;margin-bottom:1rem}
        .select-w{height:40px;border:1px solid #e2e8f0;border-radius:10px;padding:0 0.85rem;font-size:0.88rem;color:#0f172a;background:#fff;outline:none}
        .select-w:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
        .fi{height:40px;border:1px solid #e2e8f0;border-radius:10px;padding:0 0.85rem;font-size:0.88rem;color:#0f172a;background:#fff;outline:none}
        .fi:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
        .btn-primary{display:inline-flex;align-items:center;gap:0.45rem;height:40px;padding:0 1.1rem;background:#1d4ed8;color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;transition:background 0.18s}
        .btn-primary:hover{background:#1e40af}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed}
        .asist-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0.75rem;margin-top:1rem}
        .asist-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:0.9rem 1rem}
        .asist-name{font-size:0.9rem;font-weight:700;color:#0f172a;margin-bottom:0.5rem}
        .asist-ctrl{font-size:0.74rem;color:#64748b;margin-bottom:0.65rem}
        .estado-btns{display:flex;gap:0.4rem}
        .estado-btn{flex:1;height:34px;border:1px solid;border-radius:8px;font-size:0.76rem;font-weight:700;cursor:pointer;transition:all 0.15s;background:transparent}
        .estado-btn.active{font-weight:800}
        .group-info{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:0.65rem 1rem;font-size:0.84rem;color:#1e40af;font-weight:600;margin-bottom:1rem}
        .empty-state{padding:2.5rem;text-align:center;color:#94a3b8;font-size:0.9rem}
      `}</style>

      <div style={{ marginBottom:'1.25rem' }}>
        <h1 className="page-title">Capturar Asistencia</h1>
        <p className="page-sub">Registro de asistencia por sesión de tutoría</p>
      </div>

      <form onSubmit={handleGuardar}>
        <div className="ctrl-row">
          <select className="select-w" value={grupoId} onChange={e=>setGrupoId(e.target.value)}>
            {grupos.map(g=><option key={g.id} value={g.id}>{g.carrera} — Gpo. {g.grupo} ({g.dia_semana})</option>)}
          </select>
          <select className="select-w" value={sesionId} onChange={e=>setSesionId(e.target.value)}>
            <option value="new">+ Nueva sesión</option>
            {sesiones.map(s=><option key={s.id} value={s.id}>{s.fecha_realizada} {s.actividad_nombre ? `— ${s.actividad_nombre}` : ''}{s.cerrada?' (cerrada)':''}</option>)}
          </select>
          {sesionId === 'new' && (
            <>
              <input className="fi" type="date" value={fechaNueva} onChange={e=>setFechaNueva(e.target.value)} required />
              <select className="select-w" value={actividadId} onChange={e=>setActividadId(e.target.value)}>
                <option value="">Sin actividad vinculada</option>
                {actividades.map(a=><option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </>
          )}
        </div>

        {grupo && (
          <div className="group-info">
            {grupo.carrera} · Grupo {grupo.grupo} · {grupo.dia_semana} {grupo.hora_inicio} · {tutorados.length} tutorados
          </div>
        )}

        {tutorados.length === 0
          ? <div className="empty-state">No hay tutorados asignados a este grupo</div>
          : (
          <>
            <div className="asist-grid">
              {tutorados.map(t => {
                const est = asistencia[t.id] ?? 'presente'
                return (
                  <div key={t.id} className="asist-card">
                    <div className="asist-name">{t.nombre_completo}</div>
                    <div className="asist-ctrl">{t.numero_control ?? 'Sin control'}</div>
                    <div className="estado-btns">
                      {(['presente','ausente','justificado'] as EstadoAsist[]).map(e => (
                        <button key={e} type="button"
                          className={`estado-btn${est===e?' active':''}`}
                          style={{ borderColor: estadoColors[e].border, color: est===e?estadoColors[e].text:'#64748b', background: est===e?estadoColors[e].bg:'transparent' }}
                          onClick={()=>setAsistencia(p=>({...p,[t.id]:e}))}
                        >
                          {e.charAt(0).toUpperCase()+e.slice(1,e==='justificado'?5:undefined)}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'1.25rem' }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar asistencia'}
              </button>
            </div>
          </>
        )}
      </form>
    </>
  )
}
