import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const hasValidSession = Boolean(session);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  if (hasValidSession) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .login-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          background: #ffffff;
          font-family: 'Inter', 'Segoe UI', sans-serif;
        }
        .left {
          position: relative;
          overflow: hidden;
          padding: 2.8rem 3.2rem;
          background: radial-gradient(circle at 5% 0%, #eff6ff 0%, #dbeafe 35%, #ffffff 100%);
          border-right: 1px solid #dbeafe;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(0.3px);
          animation: float 8s ease-in-out infinite;
        }
        .orb.one {
          width: 240px;
          height: 240px;
          background: rgba(37, 99, 235, 0.16);
          top: -90px;
          right: -70px;
        }
        .orb.two {
          width: 180px;
          height: 180px;
          background: rgba(59, 130, 246, 0.12);
          left: -75px;
          bottom: -45px;
          animation-delay: 1.2s;
        }
        .intro {
          position: relative;
          z-index: 1;
          max-width: 540px;
        }
        .intro-badge {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          background: #ffffff;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          padding: 0.35rem 0.7rem;
          color: #1d4ed8;
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          margin-bottom: 1rem;
        }
        .intro-title {
          color: #1e3a8a;
          font-size: clamp(1.8rem, 3vw, 2.9rem);
          line-height: 1.08;
          margin-bottom: 0.9rem;
          letter-spacing: -0.03em;
          animation: rise 0.8s ease both;
        }
        .intro-title span {
          background: linear-gradient(90deg, #1d4ed8 0%, #2563eb 52%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          color: transparent;
        }
        .intro-text {
          color: #334155;
          font-size: 0.95rem;
          line-height: 1.7;
          max-width: 470px;
          margin-bottom: 1.4rem;
          animation: rise 0.95s ease both;
        }
        .feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.7rem;
          max-width: 500px;
          animation: rise 1.1s ease both;
        }
        .feature {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          border: 1px solid #dbeafe;
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(6px);
          border-radius: 10px;
          padding: 0.7rem 0.75rem;
          color: #1e293b;
          font-size: 0.82rem;
          font-weight: 600;
        }
        .feature i {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          background: #eff6ff;
          color: #1d4ed8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .right {
          display: grid;
          place-items: center;
          padding: 1.2rem;
          background: #ffffff;
        }
        .card {
          width: 100%;
          max-width: 430px;
          border: 1px solid #dbeafe;
          background: #ffffff;
          border-radius: 18px;
          box-shadow: 0 24px 48px rgba(37, 99, 235, 0.12);
          padding: 1.45rem;
          animation: rise 0.8s ease both;
        }
        .header {
          margin-bottom: 1.1rem;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.74rem;
          color: #1d4ed8;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          padding: 0.3rem 0.65rem;
          margin-bottom: 0.7rem;
        }
        .header h1 {
          color: #1e3a8a;
          font-size: 1.45rem;
          margin-bottom: 0.25rem;
        }
        .header p {
          color: #475569;
          font-size: 0.9rem;
        }
        .field-group {
          display: grid;
          gap: 0.9rem;
        }
        .label {
          display: block;
          color: #334155;
          font-size: 0.78rem;
          font-weight: 600;
          margin-bottom: 0.35rem;
        }
        .wrap {
          position: relative;
        }
        .icon {
          position: absolute;
          top: 50%;
          left: 0.75rem;
          transform: translateY(-50%);
          color: #2563eb;
          width: 16px;
          height: 16px;
          display: inline-flex;
        }
        .input {
          width: 100%;
          height: 44px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          padding: 0 0.8rem 0 2.2rem;
          font-size: 0.9rem;
          color: #0f172a;
          background: #ffffff;
          outline: none;
        }
        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
        }
        .pass-toggle {
          position: absolute;
          top: 50%;
          right: 0.7rem;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          color: #334155;
          cursor: pointer;
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .error-box {
          margin-top: 0.95rem;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
          font-size: 0.82rem;
          border-radius: 10px;
          padding: 0.7rem 0.8rem;
        }
        .btn {
          width: 100%;
          height: 44px;
          border: none;
          border-radius: 11px;
          background: linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%);
          color: #ffffff;
          margin-top: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          gap: 0.5rem;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(37, 99, 235, 0.25);
        }
        .btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .spinner {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;
          animation: spin .8s linear infinite;
        }
        .footer {
          margin-top: 1rem;
          border-top: 1px solid #e2e8f0;
          padding-top: 0.9rem;
          color: #64748b;
          font-size: 0.78rem;
        }
        @keyframes rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(10px); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 980px) {
          .login-root { grid-template-columns: 1fr; }
          .left { display: none; }
        }
        @media (max-width: 480px) {
          .card { padding: 1rem; }
          .header h1 { font-size: 1.25rem; }
        }
      `}</style>

      <div className="login-root">
        <section className="left">
          <div className="orb one" />
          <div className="orb two" />
          <div className="intro">
            <div className="intro-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3 7h7l-5 4 2 7-7-4-7 4 2-7-5-4h7z" />
              </svg>
              SGPT
            </div>
            <h2 className="intro-title">
              Gestión inteligente del <span>Programa de Tutorías</span>
            </h2>
            <p className="intro-text">
              Plataforma institucional para coordinar sesiones, seguimiento académico y evaluación tutorial con una experiencia clara, rápida y profesional.
            </p>
            <div className="feature-grid">
              <div className="feature">
                <i>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="17" rx="2" />
                    <path d="M8 2v4M16 2v4M3 10h18" />
                  </svg>
                </i>
                Planeación de periodos
              </div>
              <div className="feature">
                <i>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </i>
                Control de asistencia
              </div>
              <div className="feature">
                <i>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </i>
                Indicadores académicos
              </div>
              <div className="feature">
                <i>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                  </svg>
                </i>
                Evidencias centralizadas
              </div>
            </div>
          </div>
        </section>

        <section className="right">
          <div className="card">
            <div className="header">
              <div className="badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h18" />
                  <path d="M12 3v18" />
                </svg>
                Acceso seguro
              </div>
              <h1>Iniciar sesión</h1>
              <p>Ingresa con tu correo institucional.</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field-group">
                <div>
                  <label className="label" htmlFor="email">Correo institucional</label>
                  <div className="wrap">
                    <span className="icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M3 7l9 6 9-6" />
                      </svg>
                    </span>
                    <input
                      id="email"
                      type="email"
                      className="input"
                      placeholder="usuario@culiacan.tecnm.mx"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="password">Contraseña</label>
                  <div className="wrap">
                    <span className="icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="11" width="16" height="10" rx="2" />
                        <path d="M8 11V8a4 4 0 1 1 8 0v3" />
                      </svg>
                    </span>
                    <input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      className="input"
                      placeholder="Ingresa tu contraseña"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="pass-toggle"
                      onClick={() => setShowPass(v => !v)}
                      aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPass ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.94 10.94 0 0112 20C7 20 2.73 16.89 1 12c.63-1.77 1.7-3.34 3.06-4.6M9.9 4.24A10.94 10.94 0 0112 4c5 0 9.27 3.11 11 8a10.98 10.98 0 01-4.06 5.37M1 1l22 22" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {error && <div className="error-box" role="alert">{error}</div>}

              <button type="submit" className="btn" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner" />
                    Autenticando
                  </>
                ) : (
                  'Ingresar al sistema'
                )}
              </button>
            </form>

            <div className="footer">
              Si requieres soporte de acceso, contacta a coordinación institucional.
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
