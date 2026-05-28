export const MAX_SESIONES_SEMESTRE = 8

export interface SesionPlanificada {
  numero_sesion: number
  fecha_realizada: string
  actividad_pt_id?: string | null
  fecha_limite_grupo?: string | null
}

export function generarFechasSemanales(fechaInicio: string): string[] {
  const base = new Date(fechaInicio + 'T12:00:00')
  if (Number.isNaN(base.getTime())) return []
  const fechas: string[] = []
  for (let i = 0; i < MAX_SESIONES_SEMESTRE; i++) {
    const d = new Date(base)
    d.setDate(d.getDate() + i * 7)
    fechas.push(d.toISOString().slice(0, 10))
  }
  return fechas
}

export function buildSesionesPayload(
  fechas: string[],
  actividadesPorSesion: Record<number, string>,
  limitesPorSesion: Record<number, string> = {},
): SesionPlanificada[] {
  return fechas.slice(0, MAX_SESIONES_SEMESTRE).map((fecha, i) => ({
    numero_sesion: i + 1,
    fecha_realizada: fecha,
    actividad_pt_id: actividadesPorSesion[i + 1] || null,
    fecha_limite_grupo: limitesPorSesion[i + 1] || null,
  }))
}

export function validarSesionesFrontend(fechas: string[]): string | null {
  if (fechas.length !== MAX_SESIONES_SEMESTRE) {
    return `Debes definir exactamente ${MAX_SESIONES_SEMESTRE} sesiones semanales.`
  }
  for (let i = 0; i < fechas.length; i++) {
    if (!fechas[i]) return `Falta la fecha de la sesión ${i + 1}.`
    if (i > 0) {
      const prev = new Date(fechas[i - 1] + 'T12:00:00')
      const curr = new Date(fechas[i] + 'T12:00:00')
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
      if (diff < 6 || diff > 8) {
        return `Entre la sesión ${i} y ${i + 1} debe haber aproximadamente 7 días.`
      }
    }
  }
  return null
}

export const CALIF_LABELS: Record<number, string> = {
  1: 'Insuficiente',
  2: 'Suficiente',
  3: 'Bueno',
  4: 'Excelente',
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export function fechaLarga(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return fecha
  return `${d} de ${MESES[m - 1]} del ${y}`
}

export function diaMes(fecha: string | null | undefined): { dia: number; mes: string; anio: number; diaSemana: string } {
  const DIAS_SEM = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  if (!fecha) return { dia: 0, mes: '', anio: 0, diaSemana: '' }
  const d = new Date(fecha.slice(0, 10) + 'T12:00:00')
  return {
    dia: d.getDate(),
    mes: MESES[d.getMonth()],
    anio: d.getFullYear(),
    diaSemana: DIAS_SEM[d.getDay()],
  }
}
