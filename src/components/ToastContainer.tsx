import type { ReactElement } from 'react'
import { useToast, type ToastItem } from '../context/ToastContext'

const palette: Record<string, { bg: string; border: string; icon: string; text: string; iconColor: string }> = {
  success: { bg: '#f0fdf4', border: '#bbf7d0', icon: '#16a34a', text: '#166534', iconColor: '#16a34a' },
  error:   { bg: '#fef2f2', border: '#fecaca', icon: '#dc2626', text: '#991b1b', iconColor: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '#d97706', text: '#92400e', iconColor: '#d97706' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', text: '#1e40af', iconColor: '#2563eb' },
}

const svgIcons: Record<string, ReactElement> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const p = palette[toast.type]
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.65rem',
      padding: '0.85rem 1rem',
      background: p.bg,
      border: `1px solid ${p.border}`,
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
      minWidth: '280px',
      maxWidth: '380px',
      animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
      fontFamily: "'Inter','Segoe UI',sans-serif",
    }}>
      <span style={{ color: p.iconColor, marginTop: '1px', flexShrink: 0 }}>
        {svgIcons[toast.type]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: p.text }}>{toast.title}</p>
        {toast.message && (
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: p.text, opacity: 0.8 }}>{toast.message}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: p.text, opacity: 0.5, padding: '0', flexShrink: 0, lineHeight: 1,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(48px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: '1.25rem',
        right: '1.25rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'all' }}>
            <ToastCard toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </>
  )
}
