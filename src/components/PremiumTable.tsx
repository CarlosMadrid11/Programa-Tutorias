import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  align?: 'left' | 'center' | 'right'
}

interface PremiumTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
  loading?: boolean
}

export default function PremiumTable<T>({
  columns,
  data,
  rowKey,
  emptyMessage = 'Sin registros',
  loading = false,
}: PremiumTableProps<T>) {
  return (
    <>
      <style>{`
        .pt-wrap { background: #fff; border: 1px solid #e8edf4; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(15,23,42,0.04); }
        .pt-table { width: 100%; border-collapse: collapse; }
        .pt-table thead tr { background: linear-gradient(90deg, #f8fafc, #f1f5f9); }
        .pt-table th { padding: 0.85rem 1rem; text-align: left; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
        .pt-table th.center { text-align: center; }
        .pt-table th.right { text-align: right; }
        .pt-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s; }
        .pt-table tbody tr:last-child { border-bottom: none; }
        .pt-table tbody tr:hover { background: #f8faff; }
        .pt-table td { padding: 0.9rem 1rem; font-size: 0.875rem; color: #0f172a; vertical-align: middle; }
        .pt-table td.center { text-align: center; }
        .pt-table td.right { text-align: right; }
        .pt-empty { padding: 3rem 1rem; text-align: center; color: #94a3b8; font-size: 0.9rem; }
      `}</style>
      <div className="pt-wrap">
        {loading ? (
          <div className="pt-empty">Cargando…</div>
        ) : data.length === 0 ? (
          <div className="pt-empty">{emptyMessage}</div>
        ) : (
          <table className="pt-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={c.align ?? 'left'}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.align ?? 'left'}>{c.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
