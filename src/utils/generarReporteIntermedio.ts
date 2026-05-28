import { CALIF_LABELS, fechaLarga } from './sesionesSemestre'

export interface SesionReporte {
  numero_sesion: number
  fecha_realizada: string
  actividad_nombre: string | null
  requiere_evidencia: boolean
  asistencia_estado: string | null
  evidencia_estado: string | null
  calificacion: number | null
  retroalimentacion?: string | null
}

export interface ReporteIntermedioData {
  tutorado: { nombre_completo: string; numero_control: string | null; carrera: string | null }
  grupo: {
    carrera: string; grupo: string; dia_semana: string; hora_inicio: string
    salon: string; periodo_nombre: string; tutor_nombre: string
  }
  resumen: {
    total_sesiones: number
    asistencias_registradas: number
    actividades_requieren_evidencia: number
    actividades_calificadas: number
    promedio_calificaciones: number | null
  }
  puede_cerrar_semestre: boolean
  sesiones: SesionReporte[]
}

const ASIST_LABEL: Record<string, string> = {
  presente: 'Presente', ausente: 'Ausente', justificado: 'Justificado',
}
const EV_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', entregada: 'Entregada', aceptada: 'Aceptada',
  requiere_correccion: 'Requiere corrección', rechazada: 'Rechazada',
}

export function abrirReporteIntermedioPdf(data: ReporteIntermedioData) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return

  const prom = data.resumen.promedio_calificaciones != null
    ? `${data.resumen.promedio_calificaciones} — ${CALIF_LABELS[Math.round(data.resumen.promedio_calificaciones)] ?? ''}`
    : 'Sin calificaciones aún'

  const filas = data.sesiones.map((s) => `
    <tr>
      <td>S${s.numero_sesion}</td>
      <td>${fechaLarga(s.fecha_realizada)}</td>
      <td>${s.actividad_nombre ?? '—'}</td>
      <td>${s.asistencia_estado ? (ASIST_LABEL[s.asistencia_estado] ?? s.asistencia_estado) : 'Sin registrar'}</td>
      <td>${s.requiere_evidencia ? (s.evidencia_estado ? (EV_LABEL[s.evidencia_estado] ?? s.evidencia_estado) : 'Pendiente') : '—'}</td>
      <td>${s.calificacion ? `${s.calificacion} (${CALIF_LABELS[s.calificacion]})` : '—'}</td>
    </tr>
  `).join('')

  const aviso = data.puede_cerrar_semestre
    ? '<p class="ok">El tutorado cumple requisitos para evaluación final del semestre.</p>'
    : `<p class="warn">Reporte intermedio — no es evaluación final. Faltan asistencias (${data.resumen.asistencias_registradas}/${data.resumen.total_sesiones}) o calificaciones de actividades (${data.resumen.actividades_calificadas}/${data.resumen.actividades_requieren_evidencia}).</p>`

  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte intermedio</title>
  <style>
    *{box-sizing:border-box} body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;padding:2rem;max-width:800px;margin:0 auto}
    h1{font-size:1.35rem;margin:0 0 0.25rem;color:#1e3a8a} .sub{font-size:0.85rem;color:#64748b;margin-bottom:1.5rem}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1.25rem}
    .box{border:1px solid #e2e8f0;border-radius:10px;padding:0.75rem 1rem}
    .box span{display:block;font-size:0.65rem;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:0.2rem}
    .box strong{font-size:0.88rem}
    .kpi{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}
    .kpi div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0.5rem 0.85rem;font-size:0.8rem}
    .kpi b{display:block;font-size:1.1rem;color:#1d4ed8}
    table{width:100%;border-collapse:collapse;font-size:0.78rem;margin-top:0.5rem}
    th,td{border:1px solid #e2e8f0;padding:0.45rem 0.5rem;text-align:left}
    th{background:#f8fafc;font-weight:700}
    .warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:0.65rem 0.85rem;border-radius:8px;font-size:0.82rem}
    .ok{background:#f0fdf4;border:1px solid #86efac;color:#166534;padding:0.65rem 0.85rem;border-radius:8px;font-size:0.82rem}
    @media print{body{padding:1rem}}
  </style></head><body>
  <h1>Reporte intermedio de tutoría</h1>
  <p class="sub">Programa de Tutorías · ${data.grupo.periodo_nombre} · Generado ${fechaLarga(new Date().toISOString().slice(0, 10))}</p>
  ${aviso}
  <div class="meta">
    <div class="box"><span>Tutorado</span><strong>${data.tutorado.nombre_completo}</strong><br/>${data.tutorado.numero_control ?? ''} · ${data.tutorado.carrera ?? ''}</div>
    <div class="box"><span>Grupo</span><strong>${data.grupo.carrera} — ${data.grupo.grupo}</strong><br/>${data.grupo.dia_semana} ${String(data.grupo.hora_inicio).slice(0, 5)} · Salón ${data.grupo.salon}</div>
    <div class="box"><span>Tutor</span><strong>${data.grupo.tutor_nombre}</strong></div>
    <div class="box"><span>Promedio (solo calificaciones)</span><strong>${prom}</strong></div>
  </div>
  <div class="kpi">
    <div>Sesiones<b>${data.resumen.total_sesiones}</b></div>
    <div>Asistencias registradas<b>${data.resumen.asistencias_registradas}</b></div>
    <div>Actividades calificadas<b>${data.resumen.actividades_calificadas} / ${data.resumen.actividades_requieren_evidencia}</b></div>
  </div>
  <table><thead><tr><th>Ses.</th><th>Fecha</th><th>Actividad</th><th>Asistencia</th><th>Evidencia</th><th>Calificación</th></tr></thead><tbody>${filas}</tbody></table>
  <p style="margin-top:1.5rem;font-size:0.72rem;color:#94a3b8">Documento informativo. La evaluación final requiere todas las asistencias capturadas y todas las evidencias calificadas.</p>
  </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}
