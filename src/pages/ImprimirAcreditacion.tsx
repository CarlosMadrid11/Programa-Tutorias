import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

interface TutoradoAcred {
  id: string
  nombre_completo: string
  numero_control: string | null
  carrera: string | null
  tutor_nombre: string
  pct_asistencia: number
  calificacion_final: number | null
  acreditado: boolean | null
  folio?: string | null
  asignacion_id: string
}

export default function ImprimirAcreditacion() {
  const { perfil, rol } = useAuth()
  const { toast }        = useToast()

  const [tutorados, setTutorados] = useState<TutoradoAcred[]>([])
  const [loading,   setLoading]   = useState(true)
  const [generando, setGenerando] = useState<string|null>(null)
  const [periodoId, setPeriodoId] = useState('')
  const [periodoNombre, setPeriodoNombre] = useState('')

  useEffect(() => {
    if (!perfil || !rol) return
    supabase.from('periodos_escolares').select('id,nombre').eq('activo',true).single().then(async ({ data: per }) => {
      if (!per) { setLoading(false); return }
      const pid = (per as {id:string;nombre:string}).id
      setPeriodoId(pid); setPeriodoNombre((per as {nombre:string}).nombre)

      let asigIds: string[] = []
      if (rol === 'tutor') {
        const { data: a } = await supabase.from('asignaciones_tutor').select('id').eq('tutor_id',perfil.id).eq('periodo_id',pid)
        asigIds = (a??[]).map((x:{id:string})=>x.id)
      } else {
        const { data: a } = await supabase.from('asignaciones_tutor').select('id').eq('periodo_id',pid).eq('activa',true)
        asigIds = (a??[]).map((x:{id:string})=>x.id)
      }
      if (!asigIds.length) { setLoading(false); return }

      const { data: atRows } = await supabase.from('asignaciones_tutorado')
        .select('tutorado_id,asignacion_id,asignaciones_tutor(perfiles(nombre_completo)),perfiles!asignaciones_tutorado_tutorado_id_fkey(nombre_completo,numero_control,carrera)')
        .in('asignacion_id',asigIds).eq('activa',true)

      const tids = (atRows??[]).map((r: Record<string,unknown>)=>r.tutorado_id as string)
      const { data: evalRows } = await supabase.from('evaluaciones').select('tutorado_id,calificacion_final').in('tutorado_id',tids).eq('periodo_id',pid).eq('tipo','final')
      const evalMap: Record<string,number> = {}
      ;(evalRows??[]).forEach((e: {tutorado_id:string;calificacion_final:number|null}) => { if(e.calificacion_final!=null) evalMap[e.tutorado_id] = e.calificacion_final })

      const { data: acredRows } = await supabase.from('acreditaciones').select('tutorado_id,numero_folio').in('tutorado_id',tids).eq('periodo_id',pid)
      const acredMap: Record<string,string> = {}
      ;(acredRows??[]).forEach((a: {tutorado_id:string;numero_folio:string|null}) => { if(a.numero_folio) acredMap[a.tutorado_id] = a.numero_folio })

      const rows: TutoradoAcred[] = (atRows??[]).map((r: Record<string,unknown>) => {
        const tid = r.tutorado_id as string
        const perf = r.perfiles as {nombre_completo:string;numero_control:string|null;carrera:string|null}|null
        const asigTutor = r.asignaciones_tutor as {perfiles:{nombre_completo:string}|null}|null
        const cal = evalMap[tid] ?? null
        return {
          id: tid,
          nombre_completo: perf?.nombre_completo ?? '—',
          numero_control: perf?.numero_control ?? null,
          carrera: perf?.carrera ?? null,
          tutor_nombre: asigTutor?.perfiles?.nombre_completo ?? '—',
          pct_asistencia: 0,
          calificacion_final: cal,
          acreditado: cal !== null ? cal >= 2 : null,
          folio: acredMap[tid] ?? null,
          asignacion_id: r.asignacion_id as string,
        }
      })
      setTutorados(rows); setLoading(false)
    })
  }, [perfil, rol])

  async function generarAcreditacion(t: TutoradoAcred) {
    if (!perfil) return
    setGenerando(t.id)
    const folio = `SGPT-${periodoNombre.replace(/\s/g,'-')}-${t.numero_control ?? t.id.slice(0,6).toUpperCase()}`
    const { error } = await supabase.from('acreditaciones').upsert({
      tutorado_id: t.id,
      periodo_id: periodoId,
      asignacion_id: t.asignacion_id,
      acreditado: true,
      calificacion_final: t.calificacion_final,
      numero_folio: folio,
      generado_por: perfil.id,
    }, { onConflict: 'tutorado_id,periodo_id' })
    if (error) toast.error('Error', error.message)
    else {
      toast.success('Acreditación generada', `Folio: ${folio}`)
      setTutorados(prev => prev.map(x => x.id===t.id ? { ...x, folio, acreditado: true } : x))
      setTimeout(() => imprimirPDF(t, folio), 300)
    }
    setGenerando(null)
  }

  function imprimirPDF(t: TutoradoAcred, folio: string) {
    const ventana = window.open('', '_blank', 'width=800,height=600')
    if (!ventana) { toast.info('Habilita pop-ups para imprimir'); return }
    ventana.document.write(`
      <html><head><title>Acreditación — ${t.nombre_completo}</title>
      <style>body{font-family:Arial,sans-serif;padding:2rem;max-width:700px;margin:0 auto}
      h1{color:#1e3a8a;border-bottom:2px solid #1d4ed8;padding-bottom:0.5rem}
      .row{display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid #f1f5f9}
      .label{color:#64748b;font-size:0.9rem}.value{font-weight:700;color:#0f172a}
      .folio{background:#eff6ff;border:2px solid #1d4ed8;border-radius:8px;padding:0.75rem 1rem;text-align:center;margin:1rem 0;font-size:1.1rem;font-weight:800;color:#1e3a8a}
      .acred{background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;padding:1rem;text-align:center;margin:1rem 0;color:#166534;font-weight:700;font-size:1.05rem}
      </style></head><body>
      <h1>Instituto Tecnológico de Culiacán — TecNM</h1>
      <h2>Constancia de Acreditación del Programa de Tutorías</h2>
      <div class="folio">Folio: ${folio}</div>
      <div class="row"><span class="label">Nombre:</span><span class="value">${t.nombre_completo}</span></div>
      <div class="row"><span class="label">N° Control:</span><span class="value">${t.numero_control ?? '—'}</span></div>
      <div class="row"><span class="label">Carrera:</span><span class="value">${t.carrera ?? '—'}</span></div>
      <div class="row"><span class="label">Tutor:</span><span class="value">${t.tutor_nombre}</span></div>
      <div class="row"><span class="label">Periodo:</span><span class="value">${periodoNombre}</span></div>
      <div class="row"><span class="label">Calificación final:</span><span class="value">${t.calificacion_final?.toFixed(1) ?? '—'} / 4</span></div>
      <div class="acred">ACREDITADO — Programa de Tutorías</div>
      <p style="color:#94a3b8;font-size:0.8rem;text-align:center;margin-top:2rem">Generado el ${new Date().toLocaleDateString('es-MX')} · SGPT Campus Culiacán</p>
      <script>window.onload=()=>window.print()</script></body></html>
    `)
    ventana.document.close()
  }

  const acreditables = tutorados.filter(t => t.calificacion_final != null && t.calificacion_final >= 2)
  const pendientes   = tutorados.filter(t => t.calificacion_final == null || t.calificacion_final < 2)

  return (
    <>
      <style>{`
        .page-title{font-size:1.25rem;font-weight:800;color:#1e3a8a;margin:0}
        .page-sub{font-size:0.82rem;color:#64748b;margin:0.15rem 0 0}
        .section-head{font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#334155;margin:1.25rem 0 0.6rem}
        .table-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:1.25rem}
        table{width:100%;border-collapse:collapse}
        thead th{padding:0.75rem 1rem;text-align:left;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#64748b;border-bottom:1px solid #f1f5f9;background:#f8fafc}
        tbody tr{border-bottom:1px solid #f1f5f9;transition:background 0.12s}
        tbody tr:last-child{border-bottom:none}
        tbody tr:hover{background:#f8fafc}
        td{padding:0.85rem 1rem;font-size:0.86rem;color:#0f172a}
        .btn-gen{height:32px;padding:0 0.85rem;font-size:0.78rem;font-weight:700;border-radius:8px;border:none;background:#1d4ed8;color:#fff;cursor:pointer;transition:background 0.15s;display:inline-flex;align-items:center;gap:0.3rem}
        .btn-gen:hover{background:#1e40af}
        .btn-gen:disabled{opacity:0.5;cursor:not-allowed}
        .btn-print{height:32px;padding:0 0.85rem;font-size:0.78rem;font-weight:700;border-radius:8px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;cursor:pointer;transition:all 0.15s}
        .badge{display:inline-block;font-size:0.72rem;font-weight:700;padding:3px 9px;border-radius:8px;border:1px solid}
        .empty-state{padding:2.5rem;text-align:center;color:#94a3b8;font-size:0.9rem}
      `}</style>

      <div style={{ marginBottom:'1.25rem' }}>
        <h1 className="page-title">Imprimir Acreditación</h1>
        <p className="page-sub">Generación de constancias oficiales para tutorados que acreditaron</p>
      </div>

      {loading ? <div className="empty-state">Cargando datos…</div> : (
        <>
          <p className="section-head">Tutorados que acreditan ({acreditables.length})</p>
          <div className="table-wrap">
            {acreditables.length===0
              ? <div className="empty-state">Ningún tutorado acredita aún (requiere evaluación final ≥ 2)</div>
              : (
              <table>
                <thead><tr><th>Nombre</th><th>N° Control</th><th>Cal. Final</th><th>Folio</th><th>Acción</th></tr></thead>
                <tbody>
                  {acreditables.map(t=>(
                    <tr key={t.id}>
                      <td style={{ fontWeight:600 }}>{t.nombre_completo}</td>
                      <td style={{ color:'#475569' }}>{t.numero_control ?? '—'}</td>
                      <td><span style={{ fontWeight:800, color:'#1d4ed8' }}>{t.calificacion_final?.toFixed(1)}</span><span style={{ color:'#94a3b8' }}>/4</span></td>
                      <td>{t.folio ? <span className="badge" style={{ background:'#f0fdf4', color:'#166534', borderColor:'#bbf7d0' }}>{t.folio}</span> : <span style={{ color:'#94a3b8', fontSize:'0.8rem' }}>Sin folio</span>}</td>
                      <td style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                        {!t.folio
                          ? <button className="btn-gen" disabled={generando===t.id} onClick={()=>generarAcreditacion(t)}>{generando===t.id?'Generando…':'Generar constancia'}</button>
                          : <button className="btn-print" onClick={()=>imprimirPDF(t, t.folio!)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Reimprimir</button>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pendientes.length > 0 && (
            <>
              <p className="section-head">Tutorados sin acreditar / pendientes ({pendientes.length})</p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Nombre</th><th>N° Control</th><th>Cal. Final</th><th>Motivo</th></tr></thead>
                  <tbody>
                    {pendientes.map(t=>(
                      <tr key={t.id}>
                        <td style={{ fontWeight:600 }}>{t.nombre_completo}</td>
                        <td style={{ color:'#475569' }}>{t.numero_control ?? '—'}</td>
                        <td>{t.calificacion_final != null ? <><span style={{ fontWeight:800, color:'#dc2626' }}>{t.calificacion_final.toFixed(1)}</span><span style={{ color:'#94a3b8' }}>/4</span></> : <span style={{ color:'#94a3b8', fontSize:'0.8rem' }}>Sin evaluar</span>}</td>
                        <td style={{ color:'#94a3b8', fontSize:'0.82rem' }}>{t.calificacion_final==null ? 'Evaluación pendiente' : 'Calificación insuficiente (< 2)'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
