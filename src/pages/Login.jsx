import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const Login = () => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [showPending, setShowPending] = useState(false)
  const { login, error: authError } = useAuth()
  const authErrorMessage = typeof authError === 'string' ? authError : authError?.message
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.state?.pendingApproval) {
      setShowPending(true)
      navigate('/', { replace: true, state: {} })
    }
  }, [location.state, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.target)
    const email = formData.get('email')
    const password = formData.get('password')

    if (!email || !password) {
      setFormError('Completa todos los campos.')
      return
    }

    setIsSubmitting(true)
    setFormError('')
    setShowPending(false)
    const { error } = await login(email, password)
    setIsSubmitting(false)

    if (error) {
      setFormError(error.message || 'Credenciales invalidas o usuario sin acceso.')
      return
    }

    navigate('/')
  }

  return (
    <section className="login-page">
      <div className="login-split">
        <div className="login-left">
          <div className="login-content">
            <h1>Iniciar Sesión</h1>
            <p className="login-subtitle">Ingresa tus credenciales para acceder a tu cuenta</p>
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="field">
                <label className="field-label" htmlFor="email">
                  Usuario
                </label>
                <div className="field-input">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 22c0-4.418 3.582-8 8-8s8 3.582 8 8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <input id="email" name="email" type="email" placeholder="Ingresa tu usuario" />
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="password">
                  Contraseña
                </label>
                <div className="field-input">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="3"
                      y="11"
                      width="18"
                      height="10"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M7 11V7a5 5 0 0 1 10 0v4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Ingresa tu contraseña"
                  />
                </div>
              </div>
              {showPending ? (
                <div className="form-info">Cuenta pendiente de rol. Contacta al administrador.</div>
              ) : null}
              {formError ? <div className="form-error">{formError}</div> : null}
              {!formError && authErrorMessage ? (
                <div className="form-error">{authErrorMessage}</div>
              ) : null}
              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? 'Procesando...' : 'Iniciar Sesión'}
              </button>
            </form>
          </div>
        </div>
        <div className="login-right" aria-label="Acceso restringido">
          <div className="login-hero-image" />
          <div className="login-overlay">
            <div className="overlay-card">
              <svg className="overlay-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.5" />
                <path d="m16 32 16-16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <h3>Acceso Restringido</h3>
              <p>El acceso a este sistema está restringido a personal autorizado. Asegúrese de seguir todos los protocolos de seguridad.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Login
