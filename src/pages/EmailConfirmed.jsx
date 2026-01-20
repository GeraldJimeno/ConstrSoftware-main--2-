import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.js'

const EmailConfirmed = () => {
  const navigate = useNavigate()

  useEffect(() => {
    const clearSession = async () => {
      await supabase.auth.signOut()
    }
    clearSession()
  }, [])

  return (
    <section className="auth-body">
      <div className="auth-shell">
        <div className="auth-panel">
          <div className="brand-pill">LabGuard Systems</div>
          <div>
            <h2>Correo confirmado</h2>
            <p>Tu cuenta esta activa. Ahora puedes iniciar sesion.</p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate('/')}
          >
            Ir al login
          </button>
        </div>
        <div className="auth-hero" aria-label="Confirmacion de cuenta">
          <div className="hero-image" />
          <div className="hero-overlay">
            <div className="hero-card">
              <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="18" stroke="white" strokeWidth="2.5" />
                <path
                  d="m16 24 6 6 10-12"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <h3>Cuenta verificada</h3>
              <p>Gracias por confirmar tu correo. Espera la asignacion de rol si aplica.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default EmailConfirmed
