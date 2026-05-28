import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../context/ToastContext'
import RefreshButton from '../components/RefreshButton'
import { gestionarGrupoTutor, gestionarSeguimientoTutor } from '../utils/gestionRpc'
import { CALIF_LABELS } from '../utils/sesionesSemestre'
import { abrirReporteIntermedioPdf, type ReporteIntermedioData } from '../utils/generarReporteIntermedio'

interface TutoradoRow {
  tutorado_id: string
  nombre_completo: string
  numero_control: string | null
  carrera: string | null
  total_sesiones: number
  asistencias_registradas: number
  actividades_con_evidencia: number
  actividades_calificadas: number
  promedio_calificaciones: number | null
}

interface GrupoOpt { id: string; carrera: string; grupo: string }

export default function EvaluarDesempeno() {
  const { toast } = useToast()

  const [grupos, setGrupos] = useState<GrupoOpt[]>([])
  const [asignacionId, setAsignacionId] = useState('')
  const [tutorados, setTutorados] = useState<TutoradoRow[]>([])
  const [selected, setSelected] = useState<TutoradoRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generandoPdf, setGenerandoPdf] = useState(false)

  const loadTutorados = useCallback(async (aid: string) => {
    const res = await gestionarSeguimientoTutor('listar_grupo', { asignacion_id: aid })
    if (!res.ok) {
      toast.error('Error al cargar seguimiento', res.error)
      return
    }
    setTutorados((res.data?.tutorados as TutoradoRow[]) ?? [])
  }, [toast])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const gRes = await gestionarGrupoTutor('listar_grupos')
      const lista = (gRes.data?.grupos as GrupoOpt[]) ?? []
      setGrupos(lista)
      const aid = lista[0]?.id ?? ''
      if (aid) {
        setAsignacionId(aid)
        await loadTutorados(aid)
      }
      setLoading(false)
    })()
  }, [loadTutorados])

  useEffect(() => {
    if (!asignacionId) return
    void loadTutorados(asignacionId)
    setSelected(null)
  }, [asignacionId, loadTutorados])

  async function handleRefresh() {
    setRefreshing(true)
    if (asignacionId) await loadTutorados(asignacionId)
    setRefreshing(false)
  }

  async function generarReporte(t: TutoradoRow) {
    if (!asignacionId) return
    setGenerandoPdf(true)
    const res = await gestionarSeguimientoTutor('reporte_intermedio', {
      asignacion_id: asignacionId,
      tutorado_id: t.tutorado_id,
    })
    if (!res.ok) {
      toast.error('No se pudo generar el reporte', res.error)
      setGenerandoPdf(false)
      return
    }
    abrirReporteIntermedioPdf(res.data as unknown as ReporteIntermedioData)
    toast.success('Reporte listo', 'Usa «Guardar como PDF» en el diálogo de impresión')
    setGenerandoPdf(false)
  }

  function puedeCerrar(t: TutoradoRow) {
    return (
      t.total_sesiones > 0 &&
      t.asistencias_registradas >= t.total_sesiones &&
      t.actividades_con_evidencia > 0 &&
      t.actividades_calificadas >= t.actividades_con_evidencia
    )
  }

  return (
    <>
      <style>{`
        .ed { font-family:'Inter',sans-serif; --blue:#1d4ed8; }
        .ed-top { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.75rem; margin-bottom:1.1rem; }
        .ed-title { font-size:1.25rem; font-weight:800; color:#0f172a; margin:0; }
        .ed-sub { font-size:0.82rem; color:#64748b; margin:0.15rem 0 0; max-width:520px; }
        .ed-info { background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:0.85rem 1rem; margin-bottom:1rem; font-size:0.84rem; color:#1e40af; line-height:1.5; }
        .ed-bar { display:flex; gap:0.6rem; flex-wrap:wrap; margin-bottom:1rem; align-items:center; }
        .ed-select { height:40px; border:1px solid #e2e8f0; border-radius:10px; padding:0 0.85rem; font-size:0.88rem; background:#fff; min-width:220px; font-weight:600; }
        .ed-grid { display:grid; grid-template-columns:300px 1fr; gap:1rem; }
        @media(max-width:800px){ .ed-grid{ grid-template-columns:1fr; } }
        .ed-list { background:#fff; border:1px solid #e8eef5; border-radius:16px; overflow:hidden; }
        .ed-list-head { padding:0.75rem 1rem; background:#f8fafc; border-bottom:1px solid #f1f5f9; font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; }
        .ed-item { padding:0.85rem 1rem; border-bottom:1px solid #f8fafc; cursor:pointer; transition:background 0.15s; }
        .ed-item:hover { background:#f8faff; }
        .ed-item.active { background:#eff6ff; border-left:3px solid var(--blue); }
        .ed-item-name { font-weight:700; font-size:0.88rem; color:#0f172a; }
        .ed-item-meta { font-size:0.72rem; color:#64748b; margin-top:2px; }
        .ed-prom { font-size:0.78rem; font-weight:800; color:var(--blue); margin-top:4px; }
        .ed-panel { background:#fff; border:1px solid #e8eef5; border-radius:16px; padding:1.25rem; min-height:280px; }
        .ed-panel h3 { margin:0 0 1rem; font-size:1rem; font-weight:800; color:#0f172a; }
        .ed-kpis { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:0.6rem; margin-bottom:1.15rem; }
        .ed-kpi { background:#f8fafc; border:1px solid #e8eef5; border-radius:12px; padding:0.75rem 0.9rem; }
        .ed-kpi span { display:block; font-size:0.62rem; font-weight:800; text-transform:uppercase; color:#64748b; letter-spacing:0.05em; }
        .ed-kpi strong { font-size:1.15rem; color:#0f172a; }
        .ed-kpi strong.blue { color:var(--blue); }
        .ed-status { padding:0.75rem 1rem; border-radius:12px; font-size:0.84rem; font-weight:600; margin-bottom:1rem; }
        .ed-status.ok { background:#f0fdf4; border:1px solid #86efac; color:#15803d; }
        .ed-status.warn { background:#fffbeb; border:1px solid #fde68a; color:#92400e; }
        .btn-pdf { height:42px; padding:0 1.25rem; background:var(--blue); color:#fff; border:none; border-radius:10px; font-weight:800; font-size:0.88rem; cursor:pointer; box-shadow:0 4px 14px rgba(29,78,216,0.25); }
        .btn-pdf:disabled { opacity:0.5; cursor:not-allowed; box-shadow:none; }
        .btn-pdf:not(:disabled):hover { background:#1e40af; }
        .ed-empty { text-align:center; color:#94a3b8; padding:2.5rem 1rem; font-size:0.9rem; }
      `}</style>

      <div className="ed">
        <div className="ed-top">
          <div>
            <h1 className="ed-title">Seguimiento y calificaciones</h1>
            <p className="ed-sub">
              La evaluación del tutorado se basa únicamente en las calificaciones (1–4) asignadas al aceptar evidencias en «Evaluar evidencias».
            </p>
          </div>
          <RefreshButton onClick={() => void handleRefresh()} loading={refreshing} />
        </div>

        <div className="ed-info">
          El promedio se calcula solo con evidencias <strong>aceptadas</strong> y calificadas.
          La evaluación final del semestre requiere todas las asistencias capturadas y todas las actividades con evidencia calificada.
          Use el reporte intermedio en PDF para ver el avance antes del cierre.
        </div>

        <div className="ed-bar">
          {grupos.length > 0 && (
            <select className="ed-select" value={asignacionId} onChange={(e) => setAsignacionId(e.target.value)}>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>{g.carrera} — Grupo {g.grupo}</option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="ed-empty">Cargando tutorados…</div>
        ) : (
          <div className="ed-grid">
            <div className="ed-list">
              <div className="ed-list-head">Tutorados ({tutorados.length})</div>
              {tutorados.length === 0 ? (
                <div className="ed-empty">Sin tutorados en este grupo</div>
              ) : tutorados.map((t) => (
                <div
                  key={t.tutorado_id}
                  className={`ed-item${selected?.tutorado_id === t.tutorado_id ? ' active' : ''}`}
                  onClick={() => setSelected(t)}
                >
                  <div className="ed-item-name">{t.nombre_completo}</div>
                  <div className="ed-item-meta">{t.numero_control ?? '—'} · {t.carrera ?? '—'}</div>
                  <div className="ed-prom">
                    {t.promedio_calificaciones != null
                      ? `Promedio: ${t.promedio_calificaciones} — ${CALIF_LABELS[Math.round(Number(t.promedio_calificaciones))] ?? ''}`
                      : 'Sin calificaciones aún'}
                  </div>
                </div>
              ))}
            </div>

            <div className="ed-panel">
              {!selected ? (
                <div className="ed-empty">Selecciona un tutorado para ver su avance y generar reporte</div>
              ) : (
                <>
                  <h3>{selected.nombre_completo}</h3>

                  <div className={`ed-status ${puedeCerrar(selected) ? 'ok' : 'warn'}`}>
                    {puedeCerrar(selected)
                      ? 'Listo para cierre de semestre: asistencias completas y todas las evidencias calificadas.'
                      : `Avance incompleto: asistencia ${selected.asistencias_registradas}/${selected.total_sesiones} · actividades calificadas ${selected.actividades_calificadas}/${selected.actividades_con_evidencia}.`}
                  </div>

                  <div className="ed-kpis">
                    <div className="ed-kpi">
                      <span>Promedio calificaciones</span>
                      <strong className="blue">
                        {selected.promedio_calificaciones != null ? selected.promedio_calificaciones : '—'}
                      </strong>
                    </div>
                    <div className="ed-kpi">
                      <span>Asistencias</span>
                      <strong>{selected.asistencias_registradas} / {selected.total_sesiones}</strong>
                    </div>
                    <div className="ed-kpi">
                      <span>Evidencias calificadas</span>
                      <strong>{selected.actividades_calificadas} / {selected.actividades_con_evidencia}</strong>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.5 }}>
                    Califica las evidencias en «Evaluar evidencias». Este reporte PDF es informativo y no sustituye el formato oficial de acreditación final.
                  </p>

                  <button
                    type="button"
                    className="btn-pdf"
                    disabled={generandoPdf}
                    onClick={() => void generarReporte(selected)}
                  >
                    {generandoPdf ? 'Generando…' : 'Generar reporte intermedio (PDF)'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
