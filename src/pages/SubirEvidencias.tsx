import { useState, useEffect, useRef, useMemo } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'
import RefreshButton from '../components/RefreshButton'
import { gestionarMiTutorTutorado, gestionarCalendarioTutorado, gestionarEvidenciasTutorado } from '../utils/gestionRpc'
import { CALIF_LABELS, fechaLarga, diaMes } from '../utils/sesionesSemestre'

interface GrupoCal {
  carrera: string
  grupo: string
  semestre_generacional?: string | null
  dia_semana: string
  hora_inicio: string
  hora_fin?: string
  salon?: string | null
  tutor_nombre: string
  tutor_correo?: string
  periodo_nombre?: string
}

interface SesionCal {
  id: string
  numero_sesion: number
  fecha_realizada: string
  actividad_pt_id: string | null
  actividad_nombre: string | null
  actividad_descripcion?: string | null
  requiere_evidencia: boolean
  tipo_archivo_aceptado?: string[] | null
  fecha_limite_oficial?: string | null
  fecha_limite_grupo?: string | null
  fecha_limite_vigente?: string | null
  asistencia_estado: string | null
  evidencia_id: string | null
  evidencia_estado: string | null
  archivo_nombre: string | null
  calificacion: number | null
  retroalimentacion?: string | null
}

interface ActividadSel {
  id: string
  sesion_id: string
  nombre: string
  tipos_aceptados: string[] | null
  evidencia?: { id: string; estado: string; archivo_nombre: string | null } | null
}

const ESTADO_INFO: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  pendiente:           { label: 'Pendiente',          bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', dot: '#fb923c' },
  entregada:           { label: 'Entregada',           bg: '#fff7ed', text: '#ea580c', border: '#fdba74', dot: '#f97316' },
  aceptada:            { label: 'Aceptada',            bg: '#f0fdf4', text: '#15803d', border: '#86efac', dot: '#22c55e' },
  requiere_correccion: { label: 'Corregir',            bg: '#fffbeb', text: '#b45309', border: '#fcd34d', dot: '#f59e0b' },
  rechazada:           { label: 'Rechazada',           bg: '#fef2f2', text: '#b91c1c', border: '#fca5a5', dot: '#ef4444' },
}

const ASIST_INFO: Record<string, { label: string; color: string }> = {
  presente:    { label: 'Presente',    color: '#15803d' },
  ausente:     { label: 'Ausente',     color: '#b91c1c' },
  justificado: { label: 'Justificado', color: '#b45309' },
}

function SkeletonCards() {
  return (
    <div className="cal-grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="cal-card skel-card">
          <div className="skel-bar" />
          <div className="cal-card-top">
            <div className="skel-day" />
            <div className="skel-body">
              <div className="skel-line sm" />
              <div className="skel-line lg" />
              <div className="skel-line md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SubirEvidencias() {
  const { perfil } = useAuth()
  const { toast }  = useToast()
  const fileRef    = useRef<HTMLInputElement>(null)

  const [sesiones, setSesiones]     = useState<SesionCal[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<ActividadSel | null>(null)
  const [file, setFile]             = useState<File | null>(null)
  const [comentario, setComentario] = useState('')
  const [saving, setSaving]         = useState(false)
  const [periodoId, setPeriodoId]   = useState('')
  const [refreshTick, setRefreshTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [grupoInfo, setGrupoInfo]   = useState<GrupoCal | null>(null)
  const [periodoNombre, setPeriodoNombre] = useState('')
  const [sinTutor, setSinTutor]     = useState(false)

  useEffect(() => {
    if (!perfil) return
    setLoading(true)
    Promise.all([
      supabase.from('periodos_escolares').select('id').eq('activo', true).single(),
      gestionarCalendarioTutorado(),
      gestionarMiTutorTutorado(),
    ]).then(([perRes, calRes, tutRes]) => {
      if (perRes.data) setPeriodoId((perRes.data as { id: string }).id)
      if (calRes.ok && calRes.data?.tiene_grupo) {
        setSesiones((calRes.data.sesiones as SesionCal[]) ?? [])
        setGrupoInfo((calRes.data.grupo as GrupoCal) ?? null)
        setPeriodoNombre(
          (calRes.data.periodo_nombre as string) ??
          (calRes.data.grupo as GrupoCal)?.periodo_nombre ?? ''
        )
        setSinTutor(false)
      } else {
        setSesiones([])
        setGrupoInfo(null)
        setSinTutor(!(tutRes.ok && tutRes.data?.tiene_tutor))
      }
      setLoading(false)
    })
  }, [perfil, refreshTick])

  async function handleSubir() {
    if (!selected || !perfil || !periodoId) return
    if (!file) { toast.warning('Selecciona un archivo'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Archivo muy grande', 'Límite 10 MB'); return }
    setSaving(true)
    const ext = file.name.split('.').pop()
    const path = `${perfil.id}/${selected.sesion_id}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('evidencias').upload(path, file, { upsert: true })
    if (upErr) { toast.error('Error al subir archivo', upErr.message); setSaving(false); return }
    const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(path)
    const res = await gestionarEvidenciasTutorado('entregar', {
      actividad_pt_id: selected.id,
      sesion_id: selected.sesion_id,
      evidencia_id: selected.evidencia?.id ?? null,
      archivo_url: urlData.publicUrl,
      archivo_nombre: file.name,
      archivo_tipo: file.type,
      archivo_tamano_kb: Math.round(file.size / 1024),
      comentario_alumno: comentario || null,
    })
    if (!res.ok) toast.error('Error al registrar evidencia', res.error)
    else {
      toast.success('Evidencia entregada', 'Tu tutor la revisará pronto.')
      setRefreshTick((t) => t + 1)
      setSelected(null)
      setFile(null)
      setComentario('')
    }
    setSaving(false)
  }

  const stats = useMemo(() => {
    const total = sesiones.length
    const requiere = sesiones.filter((s) => s.requiere_evidencia).length
    const entregadas = sesiones.filter((s) =>
      s.evidencia_estado === 'entregada' || s.evidencia_estado === 'aceptada' ||
      s.evidencia_estado === 'requiere_correccion' || s.evidencia_estado === 'rechazada'
    ).length
    const aceptadas = sesiones.filter((s) => s.evidencia_estado === 'aceptada').length
    const pct = requiere > 0 ? Math.round((aceptadas / requiere) * 100) : 0
    return { total, requiere, entregadas, aceptadas, pct }
  }, [sesiones])

  const sesionesPorMes = useMemo(() => {
    const map = new Map<string, SesionCal[]>()
    for (const s of sesiones) {
      const dm = diaMes(s.fecha_realizada)
      const key = dm.mes && dm.anio ? `${dm.mes} ${dm.anio}` : 'Sin fecha'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return Array.from(map.entries())
  }, [sesiones])

  return (
    <>
      <style>{`
        :root { --or:#ea580c; --or-h:#c2410c; --or-s:#fff7ed; --or-b:#fed7aa; --or-d:#7c2d12; --or-g:linear-gradient(135deg,#9a3412 0%,#ea580c 55%,#fb923c 100%); }
        .ev-page { font-family:'Inter',system-ui,sans-serif; max-width:1200px; margin:0 auto; }
        .ev-hero { background:var(--or-g); border-radius:22px; padding:1.35rem 1.5rem; margin-bottom:1.15rem; color:#fff; position:relative; overflow:hidden; box-shadow:0 16px 40px rgba(234,88,12,0.28); }
        .ev-hero::after { content:''; position:absolute; right:-40px; top:-40px; width:180px; height:180px; border-radius:50%; background:rgba(255,255,255,0.08); pointer-events:none; }
        .ev-hero-inner { position:relative; z-index:1; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.85rem; }
        .ev-title { font-size:clamp(1.15rem,4vw,1.45rem); font-weight:900; margin:0; letter-spacing:-0.02em; }
        .ev-sub { font-size:clamp(0.78rem,2.5vw,0.86rem); opacity:0.9; margin:0.2rem 0 0; max-width:420px; line-height:1.45; }
        .ev-topbar-actions { flex-shrink:0; }
        .ev-grupo { background:#fff; border:1px solid var(--or-b); border-radius:20px; padding:1.15rem 1.25rem; margin-bottom:1rem; box-shadow:0 4px 24px rgba(234,88,12,0.07); }
        .ev-grupo-title { font-size:0.7rem; font-weight:800; color:var(--or); text-transform:uppercase; letter-spacing:0.07em; margin:0 0 0.65rem; }
        .ev-grupo-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,140px),1fr)); gap:0.5rem; }
        .ev-grupo-stat { background:linear-gradient(180deg,#fff 0%,#fffaf5 100%); border:1px solid var(--or-b); border-radius:12px; padding:0.55rem 0.75rem; }
        .ev-grupo-stat span { display:block; font-size:0.6rem; font-weight:800; color:var(--or); text-transform:uppercase; letter-spacing:0.05em; }
        .ev-grupo-stat strong { font-size:0.82rem; color:#0f172a; font-weight:700; display:block; margin-top:0.15rem; word-break:break-word; }
        .ev-stats-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,130px),1fr)); gap:0.55rem; margin-bottom:1rem; }
        .ev-stat-card { background:#fff; border:1px solid #f1e0d4; border-radius:14px; padding:0.75rem 0.9rem; display:flex; align-items:center; gap:0.65rem; box-shadow:0 2px 12px rgba(15,23,42,0.04); }
        .ev-stat-icon { width:38px; height:38px; border-radius:11px; background:var(--or-s); border:1px solid var(--or-b); display:grid; place-items:center; flex-shrink:0; color:var(--or); }
        .ev-stat-val { font-size:1.15rem; font-weight:900; color:#0f172a; line-height:1; }
        .ev-stat-lbl { font-size:0.68rem; font-weight:700; color:#64748b; margin-top:0.1rem; }
        .ev-progress-wrap { background:#fff; border:1px solid var(--or-b); border-radius:14px; padding:0.85rem 1rem; margin-bottom:1.1rem; }
        .ev-progress-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.45rem; font-size:0.75rem; font-weight:800; color:var(--or-d); }
        .ev-progress-track { height:8px; background:#fde8d4; border-radius:999px; overflow:hidden; }
        .ev-progress-fill { height:100%; background:var(--or-g); border-radius:999px; transition:width 0.4s ease; }
        .ev-no-tutor { background:var(--or-s); border:1.5px solid var(--or-b); border-radius:16px; padding:1.15rem 1.25rem; margin-bottom:1rem; display:flex; gap:0.85rem; align-items:flex-start; }
        .ev-no-tutor h3 { margin:0 0 0.3rem; font-size:0.98rem; font-weight:800; color:var(--or-d); }
        .ev-no-tutor p { margin:0; font-size:0.84rem; color:#9a3412; line-height:1.5; }
        .cal-month-row { font-size:0.68rem; font-weight:800; color:#94a3b8; text-transform:uppercase; letter-spacing:0.1em; margin:1.25rem 0 0.55rem; padding-left:2px; }
        .cal-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr)); gap:0.85rem; }
        .cal-card { background:#fff; border:1px solid #ece5df; border-radius:20px; overflow:hidden; transition:box-shadow 0.2s, transform 0.2s, border-color 0.2s; position:relative; box-shadow:0 2px 14px rgba(15,23,42,0.04); }
        .cal-card:hover { box-shadow:0 10px 28px rgba(15,23,42,0.07); }
        .cal-card.clickable { cursor:pointer; }
        .cal-card.clickable:hover { border-color:var(--or); box-shadow:0 14px 32px rgba(234,88,12,0.16); transform:translateY(-3px); }
        .cal-card-top { padding:1rem 1rem 0.65rem; display:flex; align-items:flex-start; gap:0.85rem; }
        .cal-day-block { min-width:56px; text-align:center; background:linear-gradient(180deg,#fff7ed,#fff); border:1px solid var(--or-b); border-radius:14px; padding:0.5rem 0.35rem; flex-shrink:0; }
        .cal-day-num { font-size:clamp(1.6rem,5vw,2.1rem); font-weight:900; color:#0f172a; line-height:1; }
        .cal-day-mes { font-size:0.62rem; font-weight:800; color:var(--or); text-transform:uppercase; letter-spacing:0.06em; }
        .cal-day-year { font-size:0.58rem; color:#94a3b8; font-weight:600; }
        .cal-right { flex:1; min-width:0; }
        .cal-sesion-num { font-size:0.62rem; font-weight:800; color:var(--or); text-transform:uppercase; letter-spacing:0.07em; }
        .cal-fecha-larga { font-size:0.68rem; color:#94a3b8; font-weight:600; margin-top:0.1rem; }
        .cal-act-name { font-size:0.9rem; font-weight:800; color:#0f172a; margin:0.2rem 0 0; line-height:1.3; }
        .cal-act-desc { font-size:0.72rem; color:#64748b; margin-top:0.3rem; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
        .cal-no-act { font-size:0.8rem; color:#94a3b8; font-style:italic; margin-top:0.2rem; }
        .cal-card-body { padding:0 1rem 0.75rem; }
        .cal-chips { display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.45rem; }
        .cal-chip { display:inline-flex; align-items:center; gap:0.3rem; font-size:0.65rem; font-weight:700; padding:4px 9px; border-radius:8px; border:1px solid; }
        .cal-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
        .cal-limite { font-size:0.72rem; color:#b45309; font-weight:700; margin-top:0.5rem; display:flex; align-items:flex-start; gap:0.35rem; line-height:1.4; }
        .cal-retro { background:linear-gradient(180deg,#fff7ed,#fff); border:1px solid var(--or-b); border-radius:12px; padding:0.55rem 0.7rem; margin-top:0.6rem; font-size:0.74rem; color:#9a3412; line-height:1.5; }
        .cal-retro strong { font-weight:800; display:block; margin-bottom:0.15rem; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--or); }
        .cal-calif-badge { display:inline-flex; align-items:center; gap:0.35rem; margin-top:0.5rem; background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:0.35rem 0.65rem; font-size:0.75rem; font-weight:800; color:#15803d; }
        .cal-card-action { padding:0 1rem 1rem; }
        .cal-btn { width:100%; height:40px; background:var(--or-g); color:#fff; border:none; border-radius:12px; font-size:0.82rem; font-weight:800; cursor:pointer; box-shadow:0 4px 14px rgba(234,88,12,0.35); transition:transform 0.15s, box-shadow 0.15s; }
        .cal-btn:hover { transform:translateY(-1px); box-shadow:0 6px 18px rgba(234,88,12,0.45); }
        .cal-btn:active { transform:translateY(0); }
        .cal-status-bar { height:4px; }
        .skel-card { pointer-events:none; }
        .skel-bar { height:4px; background:linear-gradient(90deg,#fde8d4 25%,#fed7aa 50%,#fde8d4 75%); background-size:200% 100%; animation:shimmer 1.2s infinite; }
        .skel-day { width:56px; height:72px; border-radius:14px; background:#f1f5f9; flex-shrink:0; animation:shimmer 1.2s infinite; }
        .skel-body { flex:1; }
        .skel-line { height:10px; background:#f1f5f9; border-radius:6px; margin-bottom:0.45rem; animation:shimmer 1.2s infinite; }
        .skel-line.sm { width:35%; }
        .skel-line.md { width:70%; }
        .skel-line.lg { width:90%; height:14px; }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.5); backdrop-filter:blur(8px); z-index:100; display:flex; align-items:flex-end; justify-content:center; padding:0; }
        @media (min-width:540px) { .modal-overlay { align-items:center; padding:1rem; } }
        .modal-ev { background:#fff; border-radius:24px 24px 0 0; width:100%; max-width:480px; max-height:92vh; overflow-y:auto; box-shadow:0 -8px 48px rgba(234,88,12,0.2); animation:evIn 0.28s cubic-bezier(0.22,1,0.36,1); }
        @media (min-width:540px) { .modal-ev { border-radius:22px; box-shadow:0 32px 64px rgba(234,88,12,0.22); animation:evInDesk 0.28s cubic-bezier(0.22,1,0.36,1); } }
        @keyframes evIn { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:none} }
        @keyframes evInDesk { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:none} }
        .modal-ev-head { background:var(--or-g); padding:1.2rem 1.35rem; color:#fff; position:sticky; top:0; z-index:2; }
        .modal-ev-head h2 { margin:0; font-size:1.05rem; font-weight:800; line-height:1.3; }
        .modal-ev-head p { margin:0.35rem 0 0; font-size:0.76rem; opacity:0.9; }
        .modal-drag { width:36px; height:4px; background:rgba(255,255,255,0.4); border-radius:999px; margin:0 auto 0.75rem; }
        @media (min-width:540px) { .modal-drag { display:none; } }
        .modal-ev-body { padding:1.25rem 1.35rem; }
        .drop-zone { border:2px dashed var(--or-b); border-radius:16px; padding:1.6rem 1rem; text-align:center; cursor:pointer; background:var(--or-s); transition:all 0.18s; margin-bottom:0.9rem; }
        .drop-zone:hover { border-color:var(--or); background:#fef3e2; }
        .drop-zone.has-file { border-color:#16a34a; background:#f0fdf4; border-style:solid; }
        .fi-ta { width:100%; min-height:80px; border:1.5px solid var(--or-b); border-radius:12px; padding:0.7rem 0.9rem; font-size:0.88rem; background:#fff; outline:none; resize:vertical; margin-bottom:0; box-sizing:border-box; font-family:inherit; }
        .fi-ta:focus { border-color:var(--or); box-shadow:0 0 0 3px rgba(234,88,12,0.14); }
        .modal-ev-foot { padding:0.9rem 1.35rem max(1.1rem, env(safe-area-inset-bottom)); display:flex; flex-direction:column-reverse; gap:0.5rem; background:#fafafa; border-top:1px solid #f1f5f9; position:sticky; bottom:0; }
        @media (min-width:400px) { .modal-ev-foot { flex-direction:row; justify-content:flex-end; } }
        .btn-or { height:44px; padding:0 1.25rem; background:var(--or-g); color:#fff; border:none; border-radius:12px; font-weight:800; cursor:pointer; font-size:0.88rem; width:100%; box-shadow:0 4px 14px rgba(234,88,12,0.3); }
        @media (min-width:400px) { .btn-or { width:auto; } }
        .btn-or:hover { filter:brightness(1.05); }
        .btn-or:disabled { opacity:0.5; cursor:not-allowed; box-shadow:none; }
        .btn-ghost { height:44px; padding:0 1rem; border:1.5px solid #e2e8f0; border-radius:12px; background:#fff; cursor:pointer; font-size:0.88rem; color:#475569; font-weight:700; width:100%; }
        @media (min-width:400px) { .btn-ghost { width:auto; } }
        .empty-cal { text-align:center; padding:3rem 1.25rem; color:#94a3b8; font-size:0.9rem; background:#fff; border:1px dashed var(--or-b); border-radius:18px; }
        @media (max-width:480px) {
          .ev-hero { border-radius:18px; padding:1.1rem 1.15rem; }
          .ev-grupo { padding:1rem; border-radius:16px; }
          .cal-card-top { flex-direction:column; align-items:stretch; }
          .cal-day-block { display:flex; align-items:center; gap:0.65rem; min-width:unset; text-align:left; padding:0.55rem 0.75rem; }
          .cal-day-num { font-size:1.5rem; }
          .cal-day-mes, .cal-day-year { display:inline; margin-left:0.25rem; }
        }
      `}</style>

      <div className="ev-page">
        <div className="ev-hero">
          <div className="ev-hero-inner">
            <div>
              <h1 className="ev-title">Mis evidencias</h1>
              <p className="ev-sub">Calendario de sesiones · Sube archivos y consulta la retroalimentación de tu tutor</p>
            </div>
            <div className="ev-topbar-actions">
              <RefreshButton
                onClick={() => { setRefreshing(true); setRefreshTick((t) => t + 1); setTimeout(() => setRefreshing(false), 800) }}
                loading={refreshing}
              />
            </div>
          </div>
        </div>

        {grupoInfo && (
          <div className="ev-grupo">
            <p className="ev-grupo-title">Mi grupo{periodoNombre ? ` · ${periodoNombre}` : ''}</p>
            <div className="ev-grupo-grid">
              <div className="ev-grupo-stat"><span>Tutor</span><strong>{grupoInfo.tutor_nombre}</strong></div>
              <div className="ev-grupo-stat"><span>Carrera</span><strong>{grupoInfo.carrera}</strong></div>
              <div className="ev-grupo-stat"><span>Grupo</span><strong>{grupoInfo.grupo}</strong></div>
              <div className="ev-grupo-stat">
                <span>Horario</span>
                <strong>{grupoInfo.dia_semana} {String(grupoInfo.hora_inicio).slice(0, 5)}{grupoInfo.hora_fin ? ` – ${String(grupoInfo.hora_fin).slice(0, 5)}` : ''}</strong>
              </div>
              {grupoInfo.salon && <div className="ev-grupo-stat"><span>Salón</span><strong>{grupoInfo.salon}</strong></div>}
              {grupoInfo.semestre_generacional && <div className="ev-grupo-stat"><span>Semestre</span><strong>{grupoInfo.semestre_generacional}</strong></div>}
            </div>
          </div>
        )}

        {!loading && grupoInfo && stats.requiere > 0 && (
          <>
            <div className="ev-stats-row">
              <div className="ev-stat-card">
                <div className="ev-stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                  <div className="ev-stat-val">{stats.total}</div>
                  <div className="ev-stat-lbl">Sesiones</div>
                </div>
              </div>
              <div className="ev-stat-card">
                <div className="ev-stat-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div>
                  <div className="ev-stat-val">{stats.entregadas}</div>
                  <div className="ev-stat-lbl">Con entrega</div>
                </div>
              </div>
              <div className="ev-stat-card">
                <div className="ev-stat-icon" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <div className="ev-stat-val">{stats.aceptadas}</div>
                  <div className="ev-stat-lbl">Aceptadas</div>
                </div>
              </div>
            </div>
            <div className="ev-progress-wrap">
              <div className="ev-progress-head">
                <span>Progreso del semestre</span>
                <span>{stats.pct}% aceptadas</span>
              </div>
              <div className="ev-progress-track">
                <div className="ev-progress-fill" style={{ width: `${stats.pct}%` }} />
              </div>
            </div>
          </>
        )}

        {sinTutor && !loading && (
          <div className="ev-no-tutor">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>
              <h3>Sin tutor asignado</h3>
              <p>Aún no tienes un grupo de tutoría asignado para este semestre. Contacta a tu coordinador departamental.</p>
            </div>
          </div>
        )}

        {loading ? (
          <SkeletonCards />
        ) : sesiones.length === 0 && grupoInfo ? (
          <div className="empty-cal">Tu tutor aún no ha planificado las sesiones del semestre</div>
        ) : (
          sesionesPorMes.map(([mesLabel, items]) => (
            <div key={mesLabel}>
              <div className="cal-month-row">{mesLabel}</div>
              <div className="cal-grid">
                {items.map((s) => {
                  const ei = s.evidencia_estado ? ESTADO_INFO[s.evidencia_estado] : null
                  const asistInfo = s.asistencia_estado ? ASIST_INFO[s.asistencia_estado] : null
                  const canUpload = s.requiere_evidencia && s.actividad_pt_id &&
                    (!s.evidencia_estado || s.evidencia_estado === 'requiere_correccion')
                  const dm = diaMes(s.fecha_realizada)

                  let barColor = '#e2e8f0'
                  if (s.evidencia_estado === 'aceptada') barColor = '#22c55e'
                  else if (s.evidencia_estado === 'entregada') barColor = '#f97316'
                  else if (s.evidencia_estado === 'requiere_correccion') barColor = '#f59e0b'
                  else if (s.evidencia_estado === 'rechazada') barColor = '#ef4444'

                  return (
                    <div
                      key={s.id}
                      className={`cal-card${canUpload ? ' clickable' : ''}`}
                      role={canUpload ? 'button' : undefined}
                      tabIndex={canUpload ? 0 : undefined}
                      onKeyDown={canUpload ? (ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault()
                          openUpload(s)
                        }
                      } : undefined}
                      onClick={canUpload ? () => openUpload(s) : undefined}
                    >
                      <div className="cal-status-bar" style={{ background: barColor }} />
                      <div className="cal-card-top">
                        <div className="cal-day-block">
                          <div>
                            <div className="cal-day-num">{dm.dia || '—'}</div>
                            <div className="cal-day-mes">{dm.mes.slice(0, 3)}</div>
                            <div className="cal-day-year">{dm.anio}</div>
                          </div>
                        </div>
                        <div className="cal-right">
                          <div className="cal-sesion-num">Sesión {s.numero_sesion}</div>
                          <div className="cal-fecha-larga">{fechaLarga(s.fecha_realizada)}</div>
                          {s.actividad_nombre
                            ? <div className="cal-act-name">{s.actividad_nombre}</div>
                            : <div className="cal-no-act">Sin actividad vinculada</div>
                          }
                          {s.actividad_descripcion && (
                            <div className="cal-act-desc">{s.actividad_descripcion}</div>
                          )}
                        </div>
                      </div>

                      <div className="cal-card-body">
                        <div className="cal-chips">
                          {asistInfo && (
                            <span className="cal-chip" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: asistInfo.color }}>
                              <span className="cal-dot" style={{ background: asistInfo.color }} />
                              {asistInfo.label}
                            </span>
                          )}
                          {s.requiere_evidencia && ei && (
                            <span className="cal-chip" style={{ background: ei.bg, borderColor: ei.border, color: ei.text }}>
                              <span className="cal-dot" style={{ background: ei.dot }} />
                              {ei.label}
                            </span>
                          )}
                          {s.requiere_evidencia && !s.evidencia_estado && (
                            <span className="cal-chip" style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#ea580c' }}>
                              Pendiente
                            </span>
                          )}
                        </div>

                        {s.calificacion && s.evidencia_estado === 'aceptada' && (
                          <div className="cal-calif-badge">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            {CALIF_LABELS[s.calificacion]}
                          </div>
                        )}

                        {s.fecha_limite_vigente && s.requiere_evidencia && (
                          <div className="cal-limite">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 2 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Límite: {fechaLarga(s.fecha_limite_vigente)}
                          </div>
                        )}

                        {s.retroalimentacion && (
                          <div className="cal-retro">
                            <strong>Retroalimentación</strong>
                            {s.retroalimentacion}
                          </div>
                        )}
                      </div>

                      {canUpload && (
                        <div className="cal-card-action">
                          <button
                            type="button"
                            className="cal-btn"
                            onClick={(ev) => { ev.stopPropagation(); openUpload(s) }}
                          >
                            {s.evidencia_estado === 'requiere_correccion' ? 'Reenviar evidencia' : 'Subir evidencia'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setSelected(null); setFile(null) } }}>
          <div className="modal-ev" onClick={(e) => e.stopPropagation()}>
            <div className="modal-ev-head">
              <div className="modal-drag" aria-hidden />
              <h2>{selected.nombre}</h2>
              <p>
                {selected.tipos_aceptados?.join(', ')} · Máx. 10 MB
                {selected.evidencia ? ' · Reenvío' : ''}
              </p>
            </div>
            <div className="modal-ev-body">
              <input
                ref={fileRef}
                type="file"
                style={{ display: 'none' }}
                accept={selected.tipos_aceptados?.map((t) => `.${t}`).join(',') ?? '*'}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div
                className={`drop-zone${file ? ' has-file' : ''}`}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(ev) => { if (ev.key === 'Enter') fileRef.current?.click() }}
                role="button"
                tabIndex={0}
              >
                {file ? (
                  <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#15803d', fontWeight: 800 }}>{file.name}</p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.76rem', color: '#16a34a' }}>{(file.size / 1024).toFixed(1)} KB</p>
                  </>
                ) : (
                  <>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#ea580c', fontWeight: 800 }}>Toca para seleccionar archivo</p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.74rem', color: '#9a3412' }}>
                      {selected.tipos_aceptados?.join(', ')}
                    </p>
                  </>
                )}
              </div>
              <label htmlFor="ev-comentario" style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7c2d12', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.35rem' }}>
                Comentario para tu tutor
              </label>
              <textarea
                id="ev-comentario"
                className="fi-ta"
                placeholder="Opcional: contexto sobre tu entrega…"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
              />
            </div>
            <div className="modal-ev-foot">
              <button type="button" className="btn-ghost" onClick={() => { setSelected(null); setFile(null) }}>Cancelar</button>
              <button type="button" className="btn-or" disabled={saving || !file} onClick={() => void handleSubir()}>
                {saving ? 'Subiendo…' : 'Entregar evidencia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  function openUpload(s: SesionCal) {
    setSelected({
      id: s.actividad_pt_id!,
      sesion_id: s.id,
      nombre: s.actividad_nombre ?? `Sesión ${s.numero_sesion}`,
      tipos_aceptados: s.tipo_archivo_aceptado ?? ['pdf', 'docx', 'jpg', 'png'],
      evidencia: s.evidencia_id
        ? { id: s.evidencia_id, estado: s.evidencia_estado ?? 'pendiente', archivo_nombre: s.archivo_nombre }
        : null,
    })
    setFile(null)
    setComentario('')
  }
}
