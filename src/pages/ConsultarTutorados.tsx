import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

interface TutoradoRow {
  id: string
  nombre_completo: string
  numero_control: string | null
  carrera: string | null
  tutor_nombre?: string
  pct_asistencia: number | null
  evidencias_entregadas: number
  evidencias_requeridas: number
  estado_acreditacion: string | null
}

const ACRED_COLORS: Record<string,{bg:string;text:string;border:string}> = {
  al_corriente:   {bg:'#f0fdf4', text:'#166534', border:'#bbf7d0'},
  en_riesgo:      {bg:'#fffbeb', text:'#92400e', border:'#fde68a'},
  atencion_urgente:{bg:'#fef2f2',text:'#991b1b', border:'#fecaca'},
  acreditado:     {bg:'#eff6ff', text:'#1d4ed8', border:'#bfdbfe'},
  no_acreditado:  {bg:'#f1f5f9', text:'#475569', border:'#e2e8f0'},
}

export default function ConsultarTutorados() {
  const { perfil, rol } = useAuth()
  const { toast }        = useToast()

  const [tutorados, setTutorados] = useState<TutoradoRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filtro,    setFiltro]    = useState('all')

  useEffect(() => {
    if (!perfil || !rol) return
    async function fetch() {
      const { data: per } = await supabase.from('periodos_escolares').select('id').eq('activo',true).single()
      const pid = (per as {id:string}|null)?.id
      if (!pid) { setLoading(false); return }

      let query = supabase.from('perfiles').select('id,nombre_completo,numero_control,carrera').eq('rol','tutorado').eq('estado','activo')

      if (rol === 'tutor') {
        const { data: asigs } = await supabase.from('asignaciones_tutor').select('id').eq('tutor_id',perfil!.id).eq('periodo_id',pid).eq('activa',true)
        const asigIds = (asigs??[]).map((a:{id:string})=>a.id)
        if (!asigIds.length) { setLoading(false); return }
        const { data: at } = await supabase.from('asignaciones_tutorado').select('tutorado_id').in('asignacion_id',asigIds).eq('activa',true)
        const tids = (at??[]).map((x:{tutorado_id:string})=>x.tutorado_id)
        if (!tids.length) { setLoading(false); return }
        query = query.in('id', tids)
      }

      const { data, error } = await query.order('nombre_completo')
      if (error) { toast.error('Error',error.message); setLoading(false); return }

      const rows: TutoradoRow[] = await Promise.all(
        ((data??[]) as {id:string;nombre_completo:string;numero_control:string|null;carrera:string|null}[]).map(async t => {
          const [asistResult, evidQuery, evalQuery] = await Promise.all([
            supabase.rpc('fn_porcentaje_asistencia', { p_tutorado_id: t.id, p_periodo_id: pid }),
            supabase.from('evidencias').select('id,estado', {count:'exact'}).eq('tutorado_id',t.id).eq('periodo_id',pid),
            supabase.from('evaluaciones').select('estado_tutorado').eq('tutorado_id',t.id).eq('periodo_id',pid).order('creado_en',{ascending:false}).limit(1).maybeSingle(),
          ])
          const entregadas = ((evidQuery.data ?? []) as {estado:string}[]).filter(e=>['entregada','aceptada'].includes(e.estado)).length
          return {
            id: t.id, nombre_completo: t.nombre_completo, numero_control: t.numero_control, carrera: t.carrera,
            pct_asistencia: typeof asistResult.data === 'number' ? asistResult.data : null,
            evidencias_entregadas: entregadas,
            evidencias_requeridas: evidQuery.count ?? 0,
            estado_acreditacion: (evalQuery.data as {estado_tutorado:string}|null)?.estado_tutorado ?? null,
          }
        })
      )
      setTutorados(rows); setLoading(false)
    }
    fetch()
  }, [perfil, rol])

  const filtered = tutorados.filter(t => {
    const matchSearch = t.nombre_completo.toLowerCase().includes(search.toLowerCase()) || (t.numero_control ?? '').includes(search)
    const matchFiltro = filtro==='all' || t.estado_acreditacion===filtro || (filtro==='sin_eval'&&!t.estado_acreditacion)
    return matchSearch && matchFiltro
  })

  return (
    <>
      <style>{`
        .page-title{font-size:1.25rem;font-weight:800;color:#1e3a8a;margin:0}
        .page-sub{font-size:0.82rem;color:#64748b;margin:0.15rem 0 0}
        .ctrl-row{display:flex;gap:0.65rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center}
        .search-bar{height:40px;border:1px solid #e2e8f0;border-radius:10px;padding:0 0.85rem 0 2.5rem;font-size:0.88rem;color:#0f172a;background:#fff;outline:none;min-width:220px}
        .search-bar:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
        .search-wrap{position:relative}
        .search-icon{position:absolute;left:0.75rem;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none}
        .filter-btn{height:36px;padding:0 0.85rem;border:1px solid #e2e8f0;border-radius:9px;font-size:0.78rem;font-weight:600;cursor:pointer;background:transparent;color:#64748b;transition:all 0.15s}
        .filter-btn.active{background:#1d4ed8;border-color:#1d4ed8;color:#fff}
        .table-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}
        table{width:100%;border-collapse:collapse}
        thead th{padding:0.75rem 1rem;text-align:left;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#64748b;border-bottom:1px solid #f1f5f9;background:#f8fafc}
        tbody tr{border-bottom:1px solid #f1f5f9;transition:background 0.12s}
        tbody tr:last-child{border-bottom:none}
        tbody tr:hover{background:#f8fafc}
        td{padding:0.85rem 1rem;font-size:0.86rem;color:#0f172a}
        .pct-bar{display:flex;align-items:center;gap:0.5rem}
        .bar-track{flex:1;height:6px;background:#e2e8f0;border-radius:99px;overflow:hidden;min-width:60px}
        .bar-fill{height:100%;border-radius:99px;transition:width 0.3s}
        .badge{display:inline-block;font-size:0.72rem;font-weight:700;padding:3px 9px;border-radius:8px;border:1px solid}
        .empty-state{padding:3rem;text-align:center;color:#94a3b8;font-size:0.9rem}
        @media(max-width:640px){thead th:nth-child(4),td:nth-child(4){display:none}}
      `}</style>

      <div style={{ marginBottom:'1.25rem' }}>
        <h1 className="page-title">Consultar Tutorados</h1>
        <p className="page-sub">Seguimiento individual de tutorados asignados</p>
      </div>

      <div className="ctrl-row">
        <div className="search-wrap">
          <span className="search-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
          <input className="search-bar" placeholder="Buscar tutorado…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        {[['all','Todos'],['al_corriente','Al corriente'],['en_riesgo','En riesgo'],['atencion_urgente','Atención urgente'],['sin_eval','Sin evaluación']].map(([v,l])=>(
          <button key={v} className={`filter-btn${filtro===v?' active':''}`} onClick={()=>setFiltro(v)}>{l}</button>
        ))}
      </div>

      <div className="table-wrap">
        {loading ? <div className="empty-state">Calculando datos…</div>
          : filtered.length===0 ? <div className="empty-state">No se encontraron tutorados</div>
          : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>N° Control</th>
                <th>Asistencia</th>
                <th>Evidencias</th>
                <th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const pct = t.pct_asistencia ?? 0
                const barColor = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'
                const ac = t.estado_acreditacion ? ACRED_COLORS[t.estado_acreditacion] ?? ACRED_COLORS.al_corriente : null
                return (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight:700 }}>{t.nombre_completo}</div>
                      <div style={{ fontSize:'0.74rem', color:'#64748b' }}>{t.carrera ?? '—'}</div>
                    </td>
                    <td style={{ color:'#475569' }}>{t.numero_control ?? '—'}</td>
                    <td>
                      <div className="pct-bar">
                        <div className="bar-track"><div className="bar-fill" style={{ width:`${pct}%`, background:barColor }} /></div>
                        <span style={{ fontSize:'0.8rem', fontWeight:700, color:barColor, whiteSpace:'nowrap' }}>{pct!=null?`${pct.toFixed(0)}%`:'—'}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight:700 }}>{t.evidencias_entregadas}</span>
                      <span style={{ color:'#94a3b8' }}>/{t.evidencias_requeridas}</span>
                    </td>
                    <td>
                      {ac ? <span className="badge" style={{ background:ac.bg, color:ac.text, borderColor:ac.border }}>{t.estado_acreditacion?.replace(/_/g,' ')}</span>
                        : <span style={{ color:'#94a3b8', fontSize:'0.8rem' }}>Sin evaluar</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
