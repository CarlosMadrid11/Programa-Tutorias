import { IconClose } from './icons'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  const confirmBg = variant === 'danger' ? '#dc2626' : '#1d4ed8'
  const confirmHover = variant === 'danger' ? '#b91c1c' : '#1e40af'

  return (
    <>
      <style>{`
        .cm-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); backdrop-filter:blur(6px); z-index:200; display:grid; place-items:center; padding:1rem; }
        .cm-card { background:#fff; border-radius:18px; width:100%; max-width:420px; box-shadow:0 32px 64px rgba(15,23,42,0.2); overflow:hidden; animation:cmIn 0.2s ease; }
        @keyframes cmIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .cm-head { padding:1.15rem 1.25rem 0.75rem; display:flex; justify-content:space-between; gap:0.75rem; }
        .cm-title { margin:0; font-size:1.05rem; font-weight:800; color:#0f172a; }
        .cm-msg { margin:0; padding:0 1.25rem 1.1rem; font-size:0.9rem; color:#475569; line-height:1.5; }
        .cm-foot { padding:0.85rem 1.25rem 1.15rem; display:flex; justify-content:flex-end; gap:0.5rem; background:#f8fafc; border-top:1px solid #f1f5f9; }
        .cm-btn { height:40px; padding:0 1rem; border-radius:10px; font-size:0.85rem; font-weight:700; cursor:pointer; border:none; }
        .cm-cancel { background:#fff; border:1px solid #e2e8f0; color:#334155; }
        .cm-ok { color:#fff; }
        .cm-ok:disabled { opacity:0.6; cursor:not-allowed; }
        .cm-close { width:34px; height:34px; border:none; background:#f1f5f9; border-radius:9px; cursor:pointer; flex-shrink:0; display:grid; place-items:center; }
      `}</style>
      <div className="cm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
        <div className="cm-card" role="dialog" aria-modal="true">
          <div className="cm-head">
            <h2 className="cm-title">{title}</h2>
            <button type="button" className="cm-close" onClick={onCancel} aria-label="Cerrar"><IconClose /></button>
          </div>
          <p className="cm-msg">{message}</p>
          <div className="cm-foot">
            <button type="button" className="cm-btn cm-cancel" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
            <button
              type="button"
              className="cm-btn cm-ok"
              style={{ background: confirmBg }}
              onMouseOver={(e) => { if (!loading) e.currentTarget.style.background = confirmHover }}
              onMouseOut={(e) => { e.currentTarget.style.background = confirmBg }}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? 'Procesando…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
