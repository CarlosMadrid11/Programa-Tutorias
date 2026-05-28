/** Genera matrícula de empleado: EMP-XXX (3 dígitos aleatorios) */
export function generarNumeroEmpleado(): string {
  const n = Math.floor(100 + Math.random() * 900)
  return `EMP-${n}`
}

/** Slug simple a partir del nombre para correo institucional */
function slugNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join('.')
    .replace(/[^a-z0-9.]/g, '')
}

/** Correo para personal (no tutorado): @itculiacan.edu.mx */
export function correoPersonalDesdeNombre(nombre: string): string {
  const base = slugNombre(nombre) || 'usuario'
  return `${base}@itculiacan.edu.mx`
}

/** Correo tutorado: L{numero_control}@culiacan.tecnm.mx */
export function correoTutoradoDesdeControl(numeroControl: string): string {
  const ctrl = numeroControl.trim().toUpperCase().replace(/^L/, '')
  return `L${ctrl}@culiacan.tecnm.mx`
}

export function generarPasswordTemporal(): string {
  return 'Sgpt' + Math.random().toString(36).slice(2, 8).toUpperCase() + '!'
}
