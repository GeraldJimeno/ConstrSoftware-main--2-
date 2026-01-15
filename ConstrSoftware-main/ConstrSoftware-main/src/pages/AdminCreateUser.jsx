import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { getStoredSupabaseAccessToken } from '../lib/supabaseSession.js'
import '../styles/admin.css'

const AdminCreateUser = () => {
  const { user, logout, accessToken } = useAuth()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', roleId: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')
  const [roles, setRoles] = useState([])
  const [rolesError, setRolesError] = useState('')
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('labguard_access_token') : null
  const fallbackToken = getStoredSupabaseAccessToken()
  const authToken = accessToken || storedToken || fallbackToken

  const getAuthToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    return sessionData?.session?.access_token || authToken || null
  }

  const loadRoles = async () => {
    setRolesError('')
    const token = await getAuthToken()
    if (!token) {
      setRolesError('No se encontro una sesion valida para cargar roles.')
      return
    }

    const response = await fetch(`${apiUrl}/api/admin/roles`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      setRolesError(payload.error || 'No se pudieron cargar los roles.')
      return
    }

    const payload = await response.json()
    setRoles(payload.data || [])
  }

  useEffect(() => {
    loadRoles()
  }, [])

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')
    setSubmitSuccess('')

    if (!form.fullName || !form.email || !form.password || !form.roleId) {
      setSubmitError('Completa todos los campos.')
      return
    }

    const requestToken = await getAuthToken()

    if (!requestToken) {
      setSubmitError('No se encontro una sesion valida. Cierra sesion e inicia de nuevo.')
      return
    }

    setIsSubmitting(true)
    const response = await fetch(`${apiUrl}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${requestToken}`,
      },
      body: JSON.stringify({
        full_name: form.fullName,
        email: form.email,
        password: form.password,
        role_id: form.roleId,
      }),
    })

    setIsSubmitting(false)

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      setSubmitError(payload.error || 'No se pudo crear el usuario.')
      return
    }

    setSubmitSuccess('Usuario creado.')
    setForm({ fullName: '', email: '', password: '', roleId: '' })
  }

  return (
    <section className="admin-body">
      <div className="admin-shell">
        <header className="admin-bar">
          <div>
            <p className="admin-greeting">
              Hola, <span className="admin-link">{user || 'Administrador'}</span>
            </p>
            <h2>Panel de Administrador</h2>
          </div>
          <div className="admin-actions">
            <button className="icon-button" type="button" aria-label="Ver notificaciones">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M18 14V10.5C18 7.462 15.538 5 12.5 5S7 7.462 7 10.5V14l-2 2v1h15v-1l-2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.73 20c-.176.303-.428.555-.732.726s-.65.257-.998.246a1.93 1.93 0 0 1-.998-.246 2 2 0 0 1-.732-.726"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button className="admin-logout" type="button" onClick={logout}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M16 3.5h4.5V8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8 20.5H3.5V16" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <path d="m20.5 3.5-6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <path d="m3.5 20.5 6-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Cerrar Sesión
            </button>
          </div>
        </header>

        <nav className="admin-tabs" aria-label="Secciones del administrador">
          <NavLink to="/admin" className={({ isActive }) => `tab${isActive ? ' active' : ''}`} end>
            Inicio
          </NavLink>
          <NavLink to="/admin/usuarios" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            Gestionar Usuarios
          </NavLink>
          <NavLink to="/admin/crear-usuario" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            Crear Usuario
          </NavLink>
          <NavLink to="/admin/roles" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            Gestionar Roles
          </NavLink>
        </nav>

        <section className="admin-users">
          <header className="users-head">
            <div className="users-title">
              <span className="dot dot-blue" aria-hidden="true" />
              <h3>Crear usuario</h3>
            </div>
          </header>

          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="admin-form-grid">
              <label className="form-field">
                <span>Nombre completo</span>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={handleChange('fullName')}
                  placeholder="Nombre y apellido"
                  required
                />
              </label>
              <label className="form-field">
                <span>Correo</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="correo@labguard.com"
                  required
                />
              </label>
              <label className="form-field">
                <span>Contrasena temporal</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={handleChange('password')}
                  placeholder="Minimo 8 caracteres"
                  required
                />
              </label>
              <label className="form-field">
                <span>Rol</span>
                <select value={form.roleId} onChange={handleChange('roleId')} required>
                  <option value="">Seleccionar...</option>
                  {roles.map((roleOption) => (
                    <option key={roleOption.id} value={roleOption.id}>
                      {roleOption.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {submitError ? <div className="admin-alert error">{submitError}</div> : null}
            {submitSuccess ? <div className="admin-alert success">{submitSuccess}</div> : null}
            {rolesError ? <div className="admin-alert error">{rolesError}</div> : null}
            {!authToken ? <div className="admin-alert info">Token no disponible en el navegador.</div> : null}
            <div className="modal-buttons">
              <button type="submit" className="btn primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </section>
  )
}

export default AdminCreateUser
