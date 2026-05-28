import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import RefreshButton from '../components/RefreshButton'
import PremiumTable from '../components/PremiumTable'
import { IconCalendar } from '../components/icons'
import { gestionarActividadesGrupo, gestionarGrupoTutor } from '../utils/gestionRpc'

interface ActividadGrupo {
  id: string
  nombre: string
  fase: string
  fecha_programada: string
  fecha_limite_oficial: string | null
  fecha_limite_grupo: string | null
  fecha_limite_vigente: string | null
  requiere_evidencia: boolean
}

export default function FechasGrupo() {
  const { toast } = useToast()
  const [actividades, setActividades] = useState<ActividadGrupo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [fechaLimite, setFechaLimite] = useState('')
  const [saving, setSaving] = useState(false)
  const [grupos, setGrupos] = useState<Array<{ id: string; carrera: string; grupo: string }>>([])
  const [asignacionId, setAsignacionId] = useState('')

  async function fetchData(aid?: string) {
    const id = aid ?? asignacionId
    if (!id) return
    setLoading(true)
    const res = await gestionarActividadesGrupo('listar', { asignacion_id: id })
    if (!res.ok) toast.error('Error al cargar actividades', res.error)
    else setActividades((res.data?.actividades as ActividadGrupo[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    gestionarGrupoTutor('listar_grupos').then((r) => {
      const lista = (r.data?.grupos as Array<{ id: string; carrera: string; grupo: string }>) ?? []
      setGrupos(lista)
      if (lista[0]?.id) {
        setAsignacionId(lista[0].id)
        void fetchData(lista[0].id)
      } else setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (asignacionId) void fetchData(asignacionId)
  }, [asignacionId])

  function abrirEditar(a: ActividadGrupo) {
    setEditId(a.id)
    setFechaLimite(a.fecha_limite_grupo ?? a.fecha_limite_oficial ?? '')
  }

  async function guardarFecha() {
    if (!editId) return
    setSaving(true)
    const res = await gestionarActividadesGrupo('actualizar_fecha', {
      actividad_pt_id: editId,
      fecha_limite_evidencia: fechaLimite || null,
      asignacion_id: asignacionId,
    })
    if (!res.ok) toast.error('No se pudo actualizar', res.error)
    else {
      toast.success('Fecha actualizada solo para tu grupo')
      setEditId(null)
      await fetchData()
    }
    setSaving(false)
  }

  return (
    <>
      <style>{`
        .page-title{font-size:1.25rem;font-weight:800;color:#1e3a8a;margin:0;display:flex;align-items:center;gap:0.5rem}
        .page-sub{font-size:0.82rem;color:#64748b;margin:0.15rem 0 0}
        .info-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:0.85rem 1rem;font-size:0.84rem;color:#0369a1;margin-bottom:1rem;line-height:1.5}
        .btn-sm{height:32px;padding:0 0.75rem;font-size:0.78rem;font-weight:700;border-radius:8px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;cursor:pointer}
        .edit-row{display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap}
        .fi{height:36px;border:1px solid #e2e8f0;border-radius:8px;padding:0 0.65rem;font-size:0.85rem}
        .oficial{color:#94a3b8;font-size:0.8rem;text-decoration:line-through}
        .vigente{font-weight:700;color:#0f172a}
      `}</style>

      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title"><IconCalendar size={22} /> Fechas por grupo</h1>
          <p className="page-sub">Ajusta fechas de entrega solo para tu grupo; la fecha oficial del PT no cambia para otros tutores</p>
        </div>
        <RefreshButton onClick={async () => { setRefreshing(true); await fetchData(); setRefreshing(false) }} loading={refreshing} />
      </div>

      {grupos.length > 0 && (
        <select
          style={{ height: 40, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 0.85rem', marginBottom: '1rem', fontSize: '0.88rem' }}
          value={asignacionId}
          onChange={(e) => setAsignacionId(e.target.value)}
        >
          {grupos.map((g) => <option key={g.id} value={g.id}>{g.carrera} — Grupo {g.grupo}</option>)}
        </select>
      )}

      <div className="info-box">
        Los cambios aplican únicamente a los tutorados de tu grupo tutorial. La actividad oficial del Programa de Tutorías permanece igual para el resto de tutores.
      </div>

      <PremiumTable
        loading={loading}
        emptyMessage="No hay actividades activas"
        data={actividades}
        rowKey={(a) => a.id}
        columns={[
          { key: 'nom', header: 'Actividad', render: (a) => <span style={{ fontWeight: 700 }}>{a.nombre}</span> },
          { key: 'fase', header: 'Fase', render: (a) => <span style={{ color: '#64748b', fontSize: '0.82rem' }}>{a.fase}</span> },
          { key: 'prog', header: 'Programada', render: (a) => a.fecha_programada?.slice(0, 10) ?? '—' },
          {
            key: 'oficial',
            header: 'Límite oficial',
            render: (a) => a.fecha_limite_oficial ? <span className="oficial">{a.fecha_limite_oficial.slice(0, 10)}</span> : '—',
          },
          {
            key: 'vigente',
            header: 'Límite vigente (grupo)',
            render: (a) => (
              <span className="vigente">
                {a.fecha_limite_vigente?.slice(0, 10) ?? '—'}
                {a.fecha_limite_grupo && a.fecha_limite_grupo !== a.fecha_limite_oficial && (
                  <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600 }}>personalizada</span>
                )}
              </span>
            ),
          },
          {
            key: 'acc',
            header: 'Acción',
            align: 'right',
            render: (a) => (
              editId === a.id ? (
                <div className="edit-row">
                  <input className="fi" type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
                  <button type="button" className="btn-sm" disabled={saving} onClick={() => void guardarFecha()}>{saving ? '…' : 'Guardar'}</button>
                  <button type="button" className="btn-sm" style={{ borderColor: '#e2e8f0', background: '#fff', color: '#64748b' }} onClick={() => setEditId(null)}>Cancelar</button>
                </div>
              ) : (
                <button type="button" className="btn-sm" onClick={() => abrirEditar(a)}>Ajustar fecha</button>
              )
            ),
          },
        ]}
      />
    </>
  )
}
