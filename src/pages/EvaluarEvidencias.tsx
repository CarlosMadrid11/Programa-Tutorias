import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import RefreshButton from '../components/RefreshButton'
import { IconClose } from '../components/icons'
import { gestionarEvidenciasTutor } from '../utils/gestionRpc'
import { CALIF_LABELS, fechaLarga } from '../utils/sesionesSemestre'

interface Evidencia {
  id: string
  tutorado_nombre: string
  numero_control: string | null
  actividad_nombre: string
  archivo_nombre: string | null
  archivo_url: string | null
  comentario_alumno: string | null
  estado: string
  retroalimentacion: string | null
  fecha_entrega: string
  calificacion?: number | null
}

type ModalModo = 'evaluar' | 'editar'

const ESTADO_META: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  pendiente:           { label: 'Pendiente',        bg: '#f8fafc', text: '#64748b', border: '#e2e8f0', dot: '#cbd5e1' },
  entregada:           { label: 'Entregada',         bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  aceptada:            { label: 'Aceptada',          bg: '#f0fdf4', text: '#15803d', border: '#86efac', dot: '#22c55e' },
  requiere_correccion: { label: 'Req. corrección',   bg: '#fffbeb', text: '#b45309', border: '#fcd34d', dot: '#f59e0b' },
  rechazada:           { label: 'Rechazada',         bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5', dot: '#ef4444' },
}

const FILTROS = [
  { v: 'entregada', label: 'Por revisar' },
  { v: 'all',       label: 'Todas' },
  { v: 'aceptada',  label: 'Aceptadas' },
  { v: 'requiere_correccion', label: 'Corrección' },
  { v: 'rechazada', label: 'Rechazadas' },
]

export default function EvaluarEvidencias() {
  const { toast } = useToast()

  const [evidencias, setEvidencias] = useState<Evidencia[]>([])
  const [loading, setLoading]       = useState(true)
  const [filtro, setFiltro]         = useState('entregada')
  const [selected, setSelected]     = useState<Evidencia | null>(null)
  const [modo, setModo]             = useState<ModalModo>('evaluar')
  const [resultado, setResultado]   = useState('aceptada')
  const [retro, setRetro]           = useState('')
  const [calificacion, setCalif]    = useState(3)
  const [saving, setSaving]         = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function fetchEvidencias() {
    setLoading(true)
    const res = await gestionarEvidenciasTutor('listar')
    if (!res.ok) toast.error('Error al cargar', res.error)
    else setEvidencias((res.data?.evidencias as Evidencia[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { void fetchEvidencias() }, [])

  function openEval(ev: Evidencia) {
    setSelected(ev)
    setModo('evaluar')
    setResultado('aceptada')
    setRetro(ev.retroalimentacion ?? '')
    setCalif(ev.calificacion ?? 3)
  }

  function openEditar(ev: Evidencia) {
    setSelected(ev)
    setModo('editar')
    setResultado(ev.estado)
    setRetro(ev.retroalimentacion ?? '')
    setCalif(ev.calificacion ?? 3)
  }

  async function handleGuardar() {
    if (!selected) return
    if ((resultado === 'requiere_correccion' || resultado === 'rechazada') && !retro.trim()) {
      toast.warning('La retroalimentación es obligatoria cuando rechazas o pides corrección')
      return
    }
    if (resultado === 'aceptada' && (!calificacion || calificacion < 1 || calificacion > 4)) {
      toast.warning('Selecciona una calificación del 1 al 4')
      return
    }

    setSaving(true)
    const payload = {
      evidencia_id: selected.id,
      estado: resultado,
      retroalimentacion: retro || null,
      calificacion: resultado === 'aceptada' ? calificacion : null,
    }

    const res = modo === 'editar'
      ? await gestionarEvidenciasTutor('actualizar_evaluacion', payload)
      : await gestionarEvidenciasTutor('evaluar', payload)

    if (!res.ok) toast.error(modo === 'editar' ? 'Error al actualizar' : 'Error al evaluar', res.error)
    else {
      toast.success(modo === 'editar' ? 'Evaluación actualizada' : 'Evaluación guardada')
      setSelected(null)
      await fetchEvidencias()
    }
    setSaving(false)
  }

  const filtered = evidencias.filter((e) => filtro === 'all' || e.estado === filtro)
  const porRevisar = evidencias.filter((e) => e.estado === 'entregada').length
  const puedeEditar = (e: Evidencia) =>
    e.estado === 'aceptada' || e.estado === 'requiere_correccion' || e.estado === 'rechazada'

  return (
    <>
      <style>{`
        .ee { font-family:'Inter',system-ui,sans-serif; --blue:#1d4ed8; --blue-s:#eff6ff; max-width:1200px; margin:0 auto; }
        .ee-topbar { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.75rem; margin-bottom:1.1rem; }
        .ee-title { font-size:clamp(1.15rem,4vw,1.35rem); font-weight:800; color:#0f172a; margin:0; }
        .ee-sub { font-size:0.82rem; color:#64748b; margin:0.15rem 0 0; }
        .ee-alert { background:#fff7ed; border:1.5px solid #fed7aa; border-radius:14px; padding:0.8rem 1rem; margin-bottom:1rem; display:flex; align-items:center; gap:0.6rem; font-size:0.84rem; font-weight:700; color:#9a3412; flex-wrap:wrap; }
        .ee-filters { display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:1rem; overflow-x:auto; padding-bottom:0.15rem; -webkit-overflow-scrolling:touch; }
        .ee-filter { height:36px; padding:0 0.9rem; border:1.5px solid #e2e8f0; border-radius:10px; font-size:0.8rem; font-weight:700; cursor:pointer; background:#fff; color:#64748b; transition:all 0.15s; white-space:nowrap; flex-shrink:0; }
        .ee-filter.active { background:var(--blue); border-color:var(--blue); color:#fff; }
        .ee-table-wrap { background:#fff; border:1px solid #e8eef5; border-radius:16px; overflow:hidden; box-shadow:0 2px 16px rgba(15,23,42,0.04); }
        .ee-table-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; }
        .ee-table { width:100%; border-collapse:collapse; min-width:640px; }
        .ee-table thead th { background:#f8fafc; padding:0.65rem 0.85rem; font-size:0.68rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:#64748b; border-bottom:2px solid #e8eef5; text-align:left; }
        .ee-table tbody td { padding:0.8rem 0.85rem; border-bottom:1px solid #f1f5f9; vertical-align:top; font-size:0.84rem; color:#0f172a; }
        .ee-table tbody tr:last-child td { border-bottom:none; }
        .ee-table tbody tr:hover td { background:#f8faff; }
        .ee-cards { display:none; }
        .ev-badge { display:inline-flex; align-items:center; gap:0.3rem; font-size:0.72rem; font-weight:700; padding:3px 8px; border-radius:8px; border:1px solid; }
        .ev-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .tutorado-name { font-weight:700; }
        .tutorado-ctrl { font-size:0.72rem; color:#94a3b8; font-family:monospace; margin-top:1px; }
        .link-archivo { font-size:0.8rem; color:var(--blue); font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:0.3rem; }
        .link-archivo:hover { text-decoration:underline; }
        .btn-eval { height:32px; padding:0 0.85rem; background:var(--blue-s); color:var(--blue); border:1.5px solid #bfdbfe; border-radius:8px; font-size:0.78rem; font-weight:800; cursor:pointer; }
        .btn-eval:hover { background:#dbeafe; }
        .btn-edit { height:32px; padding:0 0.85rem; background:#f0fdf4; color:#15803d; border:1.5px solid #86efac; border-radius:8px; font-size:0.78rem; font-weight:800; cursor:pointer; margin-left:0.35rem; }
        .btn-edit:hover { background:#dcfce7; }
        .ee-actions { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:0.35rem; }
        .ee-empty { text-align:center; padding:3rem; color:#94a3b8; font-size:0.9rem; }
        .ee-card { padding:1rem; border-bottom:1px solid #f1f5f9; }
        .ee-card:last-child { border-bottom:none; }
        .ee-card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; margin-bottom:0.5rem; }
        .ee-card-meta { font-size:0.78rem; color:#64748b; margin-bottom:0.35rem; }
        .modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.5); backdrop-filter:blur(8px); z-index:100; display:flex; align-items:flex-end; justify-content:center; }
        @media (min-width:540px) { .modal-overlay { align-items:center; padding:1rem; } }
        .modal-ev-card { background:#fff; border-radius:24px 24px 0 0; width:100%; max-width:520px; max-height:92vh; overflow-y:auto; box-shadow:0 -8px 48px rgba(15,23,42,0.2); animation:evMod 0.28s cubic-bezier(0.22,1,0.36,1); }
        @media (min-width:540px) { .modal-ev-card { border-radius:20px; box-shadow:0 32px 64px rgba(15,23,42,0.2); } }
        @keyframes evMod { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:none} }
        .modal-ev-head { background:linear-gradient(135deg,#1e3a8a,#1d4ed8); padding:1.2rem 1.35rem; color:#fff; display:flex; justify-content:space-between; align-items:flex-start; position:sticky; top:0; z-index:2; }
        .modal-ev-head h2 { margin:0; font-size:1.05rem; font-weight:800; }
        .modal-ev-head p { margin:0.25rem 0 0; font-size:0.76rem; opacity:0.85; }
        .modal-close { width:36px; height:36px; border:none; background:rgba(255,255,255,0.15); border-radius:10px; cursor:pointer; color:#fff; display:grid; place-items:center; flex-shrink:0; }
        .modal-ev-body { padding:1.25rem 1.35rem; }
        .ev-info-row { display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1.15rem; }
        .ev-info-pill { display:inline-flex; align-items:center; gap:0.3rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:4px 10px; font-size:0.78rem; font-weight:600; color:#475569; }
        .field { display:flex; flex-direction:column; gap:0.3rem; margin-bottom:0.9rem; }
        .field label { font-size:0.7rem; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:0.06em; }
        .fi { height:42px; border:1.5px solid #e2e8f0; border-radius:10px; padding:0 0.85rem; font-size:0.88rem; width:100%; box-sizing:border-box; }
        .fi:focus { outline:none; border-color:var(--blue); box-shadow:0 0 0 3px rgba(29,78,216,0.1); }
        .fi-ta { min-height:88px; padding:0.65rem 0.85rem; resize:vertical; font-family:inherit; }
        .qual-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:0.4rem; }
        .qual-btn { height:44px; border-radius:10px; border:2px solid; font-weight:800; font-size:0.95rem; cursor:pointer; transition:all 0.15s; }
        .qual-label { font-size:0.72rem; font-weight:600; color:var(--blue); margin-top:0.2rem; }
        .modal-ev-foot { padding:0.9rem 1.35rem max(1.1rem, env(safe-area-inset-bottom)); border-top:1px solid #f1f5f9; display:flex; flex-direction:column-reverse; gap:0.5rem; background:#f8fafc; position:sticky; bottom:0; }
        @media (min-width:400px) { .modal-ev-foot { flex-direction:row; justify-content:flex-end; } }
        .btn-prim { height:44px; padding:0 1.2rem; background:var(--blue); color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer; width:100%; }
        @media (min-width:400px) { .btn-prim { width:auto; } }
        .btn-prim:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-ghost { height:44px; padding:0 1rem; border:1px solid #e2e8f0; border-radius:10px; background:#fff; cursor:pointer; color:#475569; font-weight:600; width:100%; }
        @media (min-width:400px) { .btn-ghost { width:auto; } }
        .comentario-box { background:#f8fafc; border:1px solid #e8eef5; border-radius:10px; padding:0.75rem 0.9rem; margin-bottom:0.85rem; font-size:0.82rem; color:#475569; line-height:1.5; }
        .comentario-box strong { font-size:0.7rem; font-weight:800; color:#334155; text-transform:uppercase; display:block; margin-bottom:0.2rem; }
        .edit-hint { background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:0.65rem 0.85rem; margin-bottom:0.85rem; font-size:0.8rem; color:#1e40af; line-height:1.45; }
        @media (max-width:720px) {
          .ee-table-scroll { display:none; }
          .ee-cards { display:block; }
        }
      `}</style>

      <div className="ee">
        <div className="ee-topbar">
          <div>
            <h1 className="ee-title">Evaluar Evidencias</h1>
            <p className="ee-sub">Revisión, calificación y edición de entregas de tu grupo</p>
          </div>
          <RefreshButton onClick={async () => { setRefreshing(true); await fetchEvidencias(); setRefreshing(false) }} loading={refreshing} />
        </div>

        {porRevisar > 0 && (
          <div className="ee-alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {porRevisar} evidencia{porRevisar > 1 ? 's' : ''} pendiente{porRevisar > 1 ? 's' : ''} de revisión
          </div>
        )}

        <div className="ee-filters">
          {FILTROS.map(({ v, label }) => (
            <button
              key={v}
              type="button"
              className={`ee-filter${filtro === v ? ' active' : ''}`}
              onClick={() => setFiltro(v)}
            >
              {label}
              {v === 'entregada' && porRevisar > 0 && (
                <span style={{ marginLeft: '0.4rem', background: '#dc2626', color: '#fff', borderRadius: '9999px', fontSize: '0.65rem', padding: '1px 5px', fontWeight: 900 }}>
                  {porRevisar}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="ee-table-wrap">
          {loading ? (
            <div className="ee-empty">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="ee-empty">Sin evidencias con ese filtro</div>
          ) : (
            <>
              <div className="ee-table-scroll">
                <table className="ee-table">
                  <thead>
                    <tr>
                      <th>Tutorado</th>
                      <th>Actividad</th>
                      <th>Entrega</th>
                      <th>Archivo</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => renderRow(e))}
                  </tbody>
                </table>
              </div>
              <div className="ee-cards">
                {filtered.map((e) => renderCard(e))}
              </div>
            </>
          )}
        </div>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={(ev) => { if (ev.target === ev.currentTarget) setSelected(null) }}>
          <div className="modal-ev-card" onClick={(ev) => ev.stopPropagation()}>
            <div className="modal-ev-head">
              <div>
                <h2>{modo === 'editar' ? 'Editar evaluación' : 'Evaluar evidencia'}</h2>
                <p>{selected.tutorado_nombre} · {selected.actividad_nombre}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setSelected(null)} aria-label="Cerrar"><IconClose /></button>
            </div>
            <div className="modal-ev-body">
              {modo === 'editar' && (
                <div className="edit-hint">
                  Puedes modificar la calificación y el comentario de retroalimentación. Los cambios se reflejan en el seguimiento del tutorado.
                </div>
              )}

              <div className="ev-info-row">
                <div className="ev-info-pill">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {fechaLarga(selected.fecha_entrega)}
                </div>
                {selected.archivo_url && (
                  <a className="link-archivo ev-info-pill" href={selected.archivo_url} target="_blank" rel="noreferrer">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    {selected.archivo_nombre ?? 'Ver archivo'}
                  </a>
                )}
              </div>

              {selected.comentario_alumno && (
                <div className="comentario-box">
                  <strong>Comentario del tutorado</strong>
                  {selected.comentario_alumno}
                </div>
              )}

              <div className="field">
                <label>Resultado *</label>
                <select
                  className="fi"
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value)}
                  disabled={modo === 'editar' && selected.estado === 'aceptada'}
                >
                  <option value="aceptada">Aceptar</option>
                  <option value="requiere_correccion">Requiere corrección</option>
                  <option value="rechazada">Rechazar</option>
                </select>
              </div>

              {resultado === 'aceptada' && (
                <div className="field">
                  <label>Calificación *</label>
                  <div className="qual-grid">
                    {([1, 2, 3, 4] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="qual-btn"
                        style={{
                          borderColor: calificacion === n ? '#1d4ed8' : '#e2e8f0',
                          background:  calificacion === n ? '#eff6ff' : '#fff',
                          color:       calificacion === n ? '#1d4ed8' : '#94a3b8',
                        }}
                        onClick={() => setCalif(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="qual-label">{CALIF_LABELS[calificacion]}</span>
                </div>
              )}

              <div className="field">
                <label>Retroalimentación{resultado !== 'aceptada' ? ' *' : ''}</label>
                <textarea
                  className="fi fi-ta"
                  value={retro}
                  onChange={(e) => setRetro(e.target.value)}
                  placeholder={resultado === 'aceptada' ? 'Comentario para el tutorado (opcional)…' : 'Explica qué debe corregir el tutorado…'}
                />
              </div>
            </div>
            <div className="modal-ev-foot">
              <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>Cancelar</button>
              <button type="button" className="btn-prim" disabled={saving} onClick={() => void handleGuardar()}>
                {saving ? 'Guardando…' : modo === 'editar' ? 'Guardar cambios' : 'Guardar evaluación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  function renderActions(e: Evidencia) {
    return (
      <div className="ee-actions">
        {(e.estado === 'entregada') && (
          <button type="button" className="btn-eval" onClick={() => openEval(e)}>Evaluar</button>
        )}
        {puedeEditar(e) && (
          <button type="button" className="btn-edit" onClick={() => openEditar(e)}>Editar</button>
        )}
      </div>
    )
  }

  function renderRow(e: Evidencia) {
    const em = ESTADO_META[e.estado] ?? ESTADO_META.pendiente
    const showActions = e.estado === 'entregada' || puedeEditar(e)
    return (
      <tr key={e.id}>
        <td>
          <div className="tutorado-name">{e.tutorado_nombre}</div>
          <div className="tutorado-ctrl">{e.numero_control}</div>
        </td>
        <td style={{ fontSize: '0.82rem', color: '#475569', maxWidth: 200 }}>{e.actividad_nombre}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 600 }}>{fechaLarga(e.fecha_entrega)}</div>
        </td>
        <td>
          {e.archivo_url ? (
            <a className="link-archivo" href={e.archivo_url} target="_blank" rel="noreferrer">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {e.archivo_nombre ?? 'Ver'}
            </a>
          ) : <span style={{ color: '#cbd5e1' }}>—</span>}
        </td>
        <td>
          <span className="ev-badge" style={{ background: em.bg, color: em.text, borderColor: em.border }}>
            <span className="ev-dot" style={{ background: em.dot }} />
            {em.label}
            {e.estado === 'aceptada' && e.calificacion ? ` · ${CALIF_LABELS[e.calificacion]}` : ''}
          </span>
        </td>
        <td style={{ textAlign: 'right' }}>
          {showActions ? renderActions(e) : <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>}
        </td>
      </tr>
    )
  }

  function renderCard(e: Evidencia) {
    const em = ESTADO_META[e.estado] ?? ESTADO_META.pendiente
    const showActions = e.estado === 'entregada' || puedeEditar(e)
    return (
      <div key={e.id} className="ee-card">
        <div className="ee-card-head">
          <div>
            <div className="tutorado-name">{e.tutorado_nombre}</div>
            <div className="tutorado-ctrl">{e.numero_control}</div>
          </div>
          <span className="ev-badge" style={{ background: em.bg, color: em.text, borderColor: em.border }}>
            <span className="ev-dot" style={{ background: em.dot }} />
            {em.label}
          </span>
        </div>
        <div className="ee-card-meta">{e.actividad_nombre}</div>
        <div className="ee-card-meta">{fechaLarga(e.fecha_entrega)}</div>
        {e.archivo_url && (
          <a className="link-archivo" href={e.archivo_url} target="_blank" rel="noreferrer" style={{ marginBottom: '0.5rem' }}>
            {e.archivo_nombre ?? 'Ver archivo'}
          </a>
        )}
        {showActions && renderActions(e)}
      </div>
    )
  }
}
