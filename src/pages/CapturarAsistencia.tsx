import { useState, useEffect, useCallback } from 'react'
import { useToast } from '../context/ToastContext'
import RefreshButton from '../components/RefreshButton'
import { gestionarAsistenciasTutor, gestionarGrupoTutor } from '../utils/gestionRpc'
import { CALIF_LABELS, fechaLarga, diaMes } from '../utils/sesionesSemestre'

type EstadoAsist = 'presente' | 'ausente' | 'justificado'

interface SesionCol {
  id: string
  numero_sesion: number
  fecha_realizada: string
  cerrada: boolean
  actividad_nombre?: string
}

interface TutoradoRow {
  tutorado_id: string
  nombre_completo: string
  numero_control: string | null
}

interface Celda {
  tutorado_id: string
  sesion_id: string
  numero_sesion: number
  estado: string
  evidencia_estado?: string | null
  evidencia_id?: string | null
  evidencia_nombre?: string | null
  calificacion?: number | null
}

const OPCIONES: { v: EstadoAsist; label: string; bg: string; border: string; text: string }[] = [
  { v: 'presente',    label: 'Sí', bg: '#f0fdf4', border: '#86efac', text: '#15803d' },
  { v: 'ausente',     label: 'No', bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
  { v: 'justificado', label: 'J',  bg: '#fffbeb', border: '#fcd34d', text: '#b45309' },
]

const EV_INFO: Record<string, { label: string; bg: string; text: string }> = {
  entregada:          { label: 'Entregada',   bg: '#eff6ff', text: '#1d4ed8' },
  aceptada:           { label: 'Aceptada',    bg: '#f0fdf4', text: '#15803d' },
  requiere_correccion:{ label: 'Correc.',     bg: '#fffbeb', text: '#b45309' },
  rechazada:          { label: 'Rechazada',   bg: '#fef2f2', text: '#b91c1c' },
}

export default function CapturarAsistencia() {
  const { toast } = useToast()

  const [grupos, setGrupos] = useState<Array<{ id: string; carrera: string; grupo: string; dia_semana: string; hora_inicio: string; sesiones_planificadas?: boolean }>>([])
  const [asignacionId, setAsignacionId] = useState('')
  const [sesiones, setSesiones] = useState<SesionCol[]>([])
  const [tutorados, setTutorados] = useState<TutoradoRow[]>([])
  const [celdas, setCeldas] = useState<Record<string, EstadoAsist>>({})
  const [metaCeldas, setMetaCeldas] = useState<Record<string, Celda>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const cellKey = (tid: string, sid: string) => `${tid}:${sid}`

  const loadMatriz = useCallback(async (aid: string) => {
    setLoading(true)
    const res = await gestionarAsistenciasTutor('matriz_semestre', { asignacion_id: aid })
    if (!res.ok) {
      toast.error('Error al cargar matriz', res.error)
      setLoading(false)
      return
    }
    const ses = (res.data?.sesiones as SesionCol[]) ?? []
    const tuts = (res.data?.tutorados as TutoradoRow[]) ?? []
    const raw = (res.data?.celdas as Celda[]) ?? []
    setSesiones(ses)
    setTutorados(tuts)
    const map: Record<string, EstadoAsist> = {}
    const meta: Record<string, Celda> = {}
    raw.forEach((c) => {
      if (c.estado === 'presente' || c.estado === 'ausente' || c.estado === 'justificado') {
        map[cellKey(c.tutorado_id, c.sesion_id)] = c.estado as EstadoAsist
      }
      meta[cellKey(c.tutorado_id, c.sesion_id)] = c
    })
    setCeldas(map)
    setMetaCeldas(meta)
    setLoading(false)
  }, [toast])

  async function loadGrupos() {
    const res = await gestionarGrupoTutor('listar_grupos')
    const lista = (res.data?.grupos as typeof grupos) ?? []
    setGrupos(lista)
    const aid = asignacionId || lista[0]?.id || ''
    if (aid && !asignacionId) setAsignacionId(aid)
    return { lista, aid: aid || lista[0]?.id || '' }
  }

  useEffect(() => {
    void (async () => {
      const { aid } = await loadGrupos()
      if (aid) await loadMatriz(aid)
      else setLoading(false)
    })()
  }, [])

  useEffect(() => {
    if (!asignacionId) return
    void loadMatriz(asignacionId)
  }, [asignacionId, loadMatriz])

  function toggleEstado(tid: string, sid: string, est: EstadoAsist, cerrada: boolean) {
    if (cerrada) return
    const k = cellKey(tid, sid)
    setCeldas((p) => {
      const next = { ...p }
      if (next[k] === est) {
        delete next[k]
      } else {
        next[k] = est
      }
      return next
    })
  }

  async function handleGuardar() {
    if (!asignacionId) return
    setSaving(true)
    const registros: Array<{ tutorado_id: string; sesion_id: string; estado: string }> = []
    tutorados.forEach((t) => {
      sesiones.forEach((s) => {
        if (!s.cerrada) {
          const k = cellKey(t.tutorado_id, s.id)
          if (celdas[k]) {
            registros.push({ tutorado_id: t.tutorado_id, sesion_id: s.id, estado: celdas[k] })
          }
        }
      })
    })
    const res = await gestionarAsistenciasTutor('registrar_matriz', { asignacion_id: asignacionId, registros })
    if (!res.ok) toast.error('Error al guardar', res.error)
    else {
      toast.success('Asistencia guardada correctamente')
      await loadMatriz(asignacionId)
    }
    setSaving(false)
  }

  const grupoActual = grupos.find((g) => g.id === asignacionId)
  const sinPlanificar = grupoActual && !grupoActual.sesiones_planificadas

  const marcados = Object.keys(celdas).length
  const total = tutorados.length * sesiones.filter((s) => !s.cerrada).length

  return (
    <>
      <style>{`
        .ca { --blue:#1d4ed8; --blue-s:#eff6ff; --border:#e8eef5; font-family:'Inter',sans-serif; }
        .ca-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem; }
        .ca-title { font-size:1.25rem; font-weight:800; color:#0f172a; margin:0; }
        .ca-sub { font-size:0.82rem; color:#64748b; margin:0.2rem 0 0; }
        .ca-bar { display:flex; gap:0.65rem; flex-wrap:wrap; align-items:center; margin-bottom:1.1rem; }
        .ca-select { height:40px; border:1px solid var(--border); border-radius:10px; padding:0 0.85rem 0 0.7rem; font-size:0.88rem; background:#fff; min-width:220px; font-weight:600; color:#0f172a; }
        .ca-info-pill { background:linear-gradient(90deg,var(--blue-s),#f0fdf4); border:1px solid #bfdbfe; border-radius:10px; padding:0.6rem 1rem; font-size:0.82rem; color:#1e40af; font-weight:700; display:flex; align-items:center; gap:0.5rem; }
        .ca-warn { background:#fffbeb; border:1px solid #fde68a; color:#92400e; border-radius:12px; padding:0.85rem 1rem; margin-bottom:1rem; font-size:0.86rem; font-weight:600; }
        .ca-stats { display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem; }
        .ca-stat { background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:0.45rem 0.85rem; font-size:0.78rem; color:#475569; font-weight:600; }
        .ca-stat strong { color:#0f172a; }
        .ca-wrap { overflow:auto; background:#fff; border:1px solid var(--border); border-radius:16px; box-shadow:0 2px 16px rgba(15,23,42,0.04); }
        .ca-table { border-collapse:collapse; min-width:max-content; width:100%; }
        .ca-table thead th { position:sticky; top:0; background:#f8fafc; z-index:2; padding:0.55rem 0.4rem; border-bottom:2px solid var(--border); font-size:0.65rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#64748b; text-align:center; min-width:96px; }
        .ca-table thead th.sticky-col { left:0; z-index:3; text-align:left; min-width:220px; padding-left:1rem; }
        .ca-table tbody td { border-bottom:1px solid #f1f5f9; padding:0.4rem 0.3rem; text-align:center; vertical-align:middle; }
        .ca-table tbody td.sticky-col { position:sticky; left:0; background:#fff; z-index:1; text-align:left; padding-left:1rem; border-right:1px solid var(--border); }
        .ca-table tbody tr:hover td { background:#f8faff; }
        .ca-table tbody tr:hover td.sticky-col { background:#f8faff; }
        .ca-name { font-weight:700; font-size:0.84rem; color:#0f172a; line-height:1.2; }
        .ca-ctrl { font-size:0.7rem; color:#94a3b8; font-family:monospace; margin-top:1px; }
        .ses-head-num { font-weight:900; font-size:0.82rem; color:#1e3a8a; }
        .ses-head-date { font-size:0.62rem; color:#64748b; font-weight:600; margin-top:1px; }
        .ses-head-act { font-size:0.6rem; color:#2563eb; font-weight:700; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:90px; }
        .ses-head-closed { font-size:0.58rem; color:#94a3b8; margin-top:1px; }
        .mini-btns { display:flex; gap:2px; justify-content:center; flex-wrap:nowrap; }
        .mini-btn { width:26px; height:24px; border-radius:6px; border:1.5px solid; font-size:0.62rem; font-weight:900; cursor:pointer; padding:0; transition:all 0.1s; }
        .mini-btn:disabled { opacity:0.3; cursor:not-allowed; }
        .mini-btn.active { box-shadow:0 1px 4px rgba(0,0,0,0.15); }
        .mini-btn.unmarked { background:#fff; border-color:#e2e8f0; color:#cbd5e1; }
        .ev-dot { display:inline-block; width:6px; height:6px; border-radius:50%; margin-top:3px; }
        .ev-tag { display:inline-block; font-size:0.55rem; font-weight:800; padding:1px 4px; border-radius:4px; margin-top:2px; line-height:1.4; }
        .btn-save { height:42px; padding:0 1.3rem; background:var(--blue); color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer; font-size:0.88rem; }
        .btn-save:disabled { opacity:0.5; cursor:not-allowed; }
        .empty-msg { text-align:center; color:#94a3b8; padding:3rem 1rem; font-size:0.9rem; }
        .loading-row td { text-align:center; padding:2rem; color:#94a3b8; font-size:0.88rem; }
      `}</style>

      <div className="ca">
        <div className="ca-head">
          <div>
            <h1 className="ca-title">Capturar Asistencia</h1>
            <p className="ca-sub">Matriz de 8 sesiones · Haz clic en Sí / No / J para marcar; clic de nuevo para desmarcar</p>
          </div>
          <RefreshButton
            onClick={async () => {
              setRefreshing(true)
              await loadGrupos()
              if (asignacionId) await loadMatriz(asignacionId)
              setRefreshing(false)
            }}
            loading={refreshing}
          />
        </div>

        <div className="ca-bar">
          {grupos.length > 0 && (
            <select className="ca-select" value={asignacionId} onChange={(e) => setAsignacionId(e.target.value)}>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>{g.carrera} — Grupo {g.grupo}</option>
              ))}
            </select>
          )}
          {grupoActual && (
            <div className="ca-info-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {grupoActual.carrera} · Grupo {grupoActual.grupo} · {grupoActual.dia_semana} {String(grupoActual.hora_inicio).slice(0, 5)}
            </div>
          )}
          {tutorados.length > 0 && !sinPlanificar && (
            <button type="button" className="btn-save" disabled={saving || loading} onClick={() => void handleGuardar()}>
              {saving ? 'Guardando…' : 'Guardar asistencia'}
            </button>
          )}
        </div>

        {sinPlanificar ? (
          <div className="ca-warn">Este grupo no tiene 8 sesiones planificadas. Edítalo en Mis tutorados para agregar el calendario.</div>
        ) : !loading && tutorados.length > 0 && (
          <div className="ca-stats">
            <div className="ca-stat">Tutorados: <strong>{tutorados.length}</strong></div>
            <div className="ca-stat">Sesiones: <strong>{sesiones.length}</strong></div>
            <div className="ca-stat">Celdas marcadas: <strong>{marcados}</strong> / {total}</div>
          </div>
        )}

        {loading ? (
          <div className="empty-msg">Cargando matriz…</div>
        ) : sesiones.length === 0 ? (
          <div className="empty-msg">Sin sesiones planificadas para este grupo</div>
        ) : tutorados.length === 0 ? (
          <div className="empty-msg">Sin tutorados asignados a este grupo</div>
        ) : (
          <div className="ca-wrap">
            <table className="ca-table">
              <thead>
                <tr>
                  <th className="sticky-col">Tutorado</th>
                  {sesiones.map((s) => {
                    const dm = diaMes(s.fecha_realizada)
                    return (
                      <th key={s.id} title={fechaLarga(s.fecha_realizada)}>
                        <div className="ses-head-num">S{s.numero_sesion}</div>
                        <div className="ses-head-date">{dm.dia} {dm.mes.slice(0, 3)}</div>
                        {s.actividad_nombre && (
                          <div className="ses-head-act" title={s.actividad_nombre}>{s.actividad_nombre.slice(0, 14)}{s.actividad_nombre.length > 14 ? '…' : ''}</div>
                        )}
                        {s.cerrada && <div className="ses-head-closed">Cerrada</div>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {tutorados.map((t) => (
                  <tr key={t.tutorado_id}>
                    <td className="sticky-col">
                      <div className="ca-name">{t.nombre_completo}</div>
                      <div className="ca-ctrl">{t.numero_control}</div>
                    </td>
                    {sesiones.map((s) => {
                      const k = cellKey(t.tutorado_id, s.id)
                      const est = celdas[k]
                      const meta = metaCeldas[k]
                      const ev = meta?.evidencia_estado
                      const evInfo = ev ? EV_INFO[ev] : null
                      return (
                        <td key={s.id}>
                          <div className="mini-btns">
                            {OPCIONES.map((o) => {
                              const active = est === o.v
                              return (
                                <button
                                  key={o.v}
                                  type="button"
                                  title={`${o.v}${s.cerrada ? ' (cerrada)' : ''}`}
                                  className={`mini-btn${active ? ' active' : ''}`}
                                  disabled={s.cerrada}
                                  style={{
                                    borderColor: active ? o.border : '#e2e8f0',
                                    color: active ? o.text : '#cbd5e1',
                                    background: active ? o.bg : '#fff',
                                  }}
                                  onClick={() => toggleEstado(t.tutorado_id, s.id, o.v, s.cerrada)}
                                >
                                  {o.label}
                                </button>
                              )
                            })}
                          </div>
                          {s.actividad_nombre && (
                            evInfo ? (
                              <div
                                className="ev-tag"
                                style={{ background: evInfo.bg, color: evInfo.text }}
                                title={meta?.calificacion ? `${CALIF_LABELS[meta.calificacion]}` : ev ?? ''}
                              >
                                {ev === 'aceptada' && meta?.calificacion ? CALIF_LABELS[meta.calificacion] : evInfo.label}
                              </div>
                            ) : (
                              <div className="ev-tag" style={{ background: '#f8fafc', color: '#cbd5e1' }}>—</div>
                            )
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
