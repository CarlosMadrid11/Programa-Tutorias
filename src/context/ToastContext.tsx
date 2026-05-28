import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  toast: {
    success: (title: string, message?: string) => void
    error: (title: string, message?: string) => void
    warning: (title: string, message?: string) => void
    info: (title: string, message?: string) => void
  }
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const add = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2, 9)
    setToasts(prev => [...prev.slice(-4), { id, type, title, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  const toast = {
    success: (title: string, message?: string) => add('success', title, message),
    error:   (title: string, message?: string) => add('error',   title, message),
    warning: (title: string, message?: string) => add('warning', title, message),
    info:    (title: string, message?: string) => add('info',    title, message),
  }

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
