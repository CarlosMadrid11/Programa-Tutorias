import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { supabase } from '../utils/supabase'
import RefreshButton from '../components/RefreshButton'

interface TutorRow {
  id: string
  nombre_completo: string
  correo_institucional: string
  departamento: string | null
  grupos: number
  tutorados: number
  carrera: string
}

export default function ConsultarTutores() {
  const { toast } = useToast()
  const [tutores,  setTutores]  = useState<TutorRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [carrera,  setCarrera]  = useState('all')
  const [carreras, setCarreras] = useState<string[]>([])
  const [refreshTick, setRefreshTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    async function fetch() {
      const { data: per } = await supabase.from('periodos_escolares').select('id').eq('activo',true).single()
      const pid = (per as {id:string}|null)?.id
      if (!pid) { setLoading(false); return }

      const { data, error } = await supabase.from('asignaciones_tutor')
        .select('tutor_id,carrera,perfiles(nombre_completo,correo_institucional,departamento),asignaciones_tutorado(id)')
        .eq('periodo_id',pid).eq('activa',true)
      if (error) { toast.error('Error',error.message); setLoading(false); return }

      const map: Record<string,TutorRow> = {}
      ;(data??[]).forEach((r: Record<string,unknown>) => {
        const tid = r.tutor_id as string
        const p = r.perfiles as {nombre_completo:string;correo_institucional:string;departamento:string|null}|null
        const c = r.carrera as string
        const tuts = ((r.asignaciones_tutorado as unknown[]) ?? []).length
        if (!map[tid]) {
          map[tid] = { id:tid, nombre_completo:p?.nombre_completo??'—', correo_institucional:p?.correo_institucional??'—', departamento:p?.departamento??null, grupos:1, tutorados:tuts, carrera:c }
        } else {
          map[tid].grupos++; map[tid].tutorados+=tuts
          if (!map[tid].carrera.includes(c)) map[tid].carrera += `, ${c}`
        }
      })
      const rows = Object.values(map)
      setTutores(rows)
      setCarreras([...new Set(rows.map(r => r.carrera.split(',')[0].trim()).filter(Boolean))])
      setLoading(false)
    }
    fetch()
  }, [refreshTick, toast])

  const filtered = tutores.filter(t => {
    const ms = t.nombre_completo.toLowerCase().includes(search.toLowerCase()) || t.correo_institucional.toLowerCase().includes(search.toLowerCase())
    const mc = carrera === 'all' || t.carrera.includes(carrera)
    return ms && mc
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
        .select-w{height:40px;border:1px solid #e2e8f0;border-radius:10px;padding:0 0.85rem;font-size:0.88rem;color:#0f172a;background:#fff;outline:none}
        .select-w:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.12)}
        .stats-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.75rem;margin-bottom:1.25rem}
        .stat-card{background:#fff;border:1px solid #dbeafe;border-radius:12px;padding:0.85rem 1rem}
        .stat-value{font-size:1.6rem;font-weight:800;color:#1e3a8a}
        .stat-label{font-size:0.74rem;color:#64748b;font-weight:500;margin-top:2px}
        .table-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}
        table{width:100%;border-collapse:collapse}
        thead th{padding:0.75rem 1rem;text-align:left;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#64748b;border-bottom:1px solid #f1f5f9;background:#f8fafc}
        tbody tr{border-bottom:1px solid #f1f5f9;transition:background 0.12s}
        tbody tr:last-child{border-bottom:none}
        tbody tr:hover{background:#f8fafc}
        td{padding:0.85rem 1rem;font-size:0.86rem;color:#0f172a}
        .num-badge{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;font-size:0.82rem;font-weight:800;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}
        .empty-state{padding:3rem;text-align:center;color:#94a3b8;font-size:0.9rem}
        @media(max-width:640px){thead th:nth-child(3),td:nth-child(3){display:none}}
      `}</style>

      <div style={{ marginBottom:'1.25rem', display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 className="page-title">Consultar Tutores</h1>
          <p className="page-sub">Distribución de tutores y grupos tutoriales del periodo activo</p>
        </div>
        <RefreshButton onClick={() => { setRefreshing(true); setRefreshTick((t) => t + 1); setTimeout(() => setRefreshing(false), 500) }} loading={refreshing} />
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-value">{tutores.length}</div><div className="stat-label">Tutores activos</div></div>
        <div className="stat-card"><div className="stat-value">{tutores.reduce((a,t)=>a+t.grupos,0)}</div><div className="stat-label">Grupos tutoriales</div></div>
        <div className="stat-card"><div className="stat-value">{tutores.reduce((a,t)=>a+t.tutorados,0)}</div><div className="stat-label">Tutorados asignados</div></div>
        <div className="stat-card"><div className="stat-value">{tutores.length ? (tutores.reduce((a,t)=>a+t.tutorados,0)/tutores.length).toFixed(1) : '0'}</div><div className="stat-label">Prom. tutorados/tutor</div></div>
      </div>

      <div className="ctrl-row">
        <div className="search-wrap">
          <span className="search-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
          <input className="search-bar" placeholder="Buscar tutor…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <select className="select-w" value={carrera} onChange={e=>setCarrera(e.target.value)}>
          <option value="all">Todas las carreras</option>
          {carreras.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        {loading ? <div className="empty-state">Cargando tutores…</div>
          : filtered.length===0 ? <div className="empty-state">No se encontraron tutores</div>
          : (
          <table>
            <thead>
              <tr><th>Nombre</th><th>Carrera(s)</th><th>Departamento</th><th>Grupos</th><th>Tutorados</th></tr>
            </thead>
            <tbody>
              {filtered.map(t=>(
                <tr key={t.id}>
                  <td>
                    <div style={{ fontWeight:700 }}>{t.nombre_completo}</div>
                    <div style={{ fontSize:'0.74rem', color:'#64748b' }}>{t.correo_institucional}</div>
                  </td>
                  <td style={{ color:'#475569', fontSize:'0.82rem' }}>{t.carrera}</td>
                  <td style={{ color:'#475569' }}>{t.departamento ?? '—'}</td>
                  <td><span className="num-badge">{t.grupos}</span></td>
                  <td><span className="num-badge">{t.tutorados}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
