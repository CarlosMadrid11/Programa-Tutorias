interface RefreshButtonProps {
  onClick: () => void | Promise<void>
  loading?: boolean
  label?: string
}

export default function RefreshButton({ onClick, loading = false, label = 'Actualizar' }: RefreshButtonProps) {
  return (
    <>
      <style>{`
        .refresh-btn-premium {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          height: 40px;
          padding: 0 1rem;
          border: 1.5px solid #e2e8f0;
          border-radius: 11px;
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          color: #334155;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
          transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s, border-color 0.2s;
        }
        .refresh-btn-premium:hover:not(:disabled) {
          transform: translateY(-2px);
          border-color: #93c5fd;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.14);
          color: #1d4ed8;
        }
        .refresh-btn-premium:disabled {
          opacity: 0.65;
          cursor: wait;
        }
        .refresh-btn-premium .refresh-icon {
          display: inline-flex;
          transition: transform 0.6s ease;
        }
        .refresh-btn-premium.is-loading .refresh-icon {
          animation: refreshSpin 0.85s linear infinite;
        }
        @keyframes refreshSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <button
        type="button"
        className={`refresh-btn-premium${loading ? ' is-loading' : ''}`}
        onClick={() => void onClick()}
        disabled={loading}
        title="Recargar datos desde la base de datos"
      >
        <span className="refresh-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </span>
        {loading ? 'Actualizando…' : label}
      </button>
    </>
  )
}
