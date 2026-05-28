import { useState, type FormEvent } from 'react'
import { useToast } from '../context/ToastContext'
import { cambiarPasswordInicial, validarPasswordNueva } from '../utils/gestionRpc'

interface Props {
  open: boolean
  onSuccess: () => void
}

export default function CambiarPasswordModal({ open, onSuccess }: Props) {
  const { toast } = useToast()
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [saving, setSaving] = useState(false)
  const [show, setShow] = useState(false)

  if (!open) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validacion = validarPasswordNueva(nueva)
    if (!validacion.ok) {
      toast.warning('Contraseña inválida', validacion.error)
      return
    }
    if (nueva !== confirmar) {
      toast.warning('Las contraseñas no coinciden')
      return
    }
    setSaving(true)
    const res = await cambiarPasswordInicial(nueva, confirmar)
    setSaving(false)
    if (!res.ok) {
      toast.error('No se pudo actualizar', res.error)
      return
    }
    toast.success('Contraseña actualizada', 'Ya puedes usar el sistema con tu nueva contraseña.')
    setNueva('')
    setConfirmar('')
    onSuccess()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(10px)',
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: 'min(440px, 100%)',
          background: '#fff',
          borderRadius: 20,
          padding: '1.75rem',
          boxShadow: '0 32px 64px rgba(29, 78, 216, 0.22)',
        }}
      >
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
          Cambio de contraseña obligatorio
        </h2>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.86rem', color: '#64748b', lineHeight: 1.5 }}>
          Es tu primer acceso. Define una contraseña nueva: mínimo 8 caracteres, un número y un carácter especial.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                Nueva contraseña *
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
                <input
                  type={show ? 'text' : 'password'}
                  required
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  style={{ flex: 1, height: 44, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 0.85rem', fontSize: '0.9rem' }}
                />
                <button type="button" onClick={() => setShow((s) => !s)} style={{ height: 44, padding: '0 0.75rem', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer' }}>
                  {show ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase' }}>
                Confirmar contraseña *
              </label>
              <input
                type={show ? 'text' : 'password'}
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                style={{ width: '100%', height: 44, marginTop: '0.3rem', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 0.85rem', fontSize: '0.9rem' }}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: '1.25rem',
              width: '100%',
              height: 46,
              border: 'none',
              borderRadius: 12,
              background: 'linear-gradient(135deg,#1d4ed8,#1e40af)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Guardando…' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
