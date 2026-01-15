import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { getStoredSupabaseAccessToken } from '../lib/supabaseSession.js'
import '../styles/admin.css'

const AdminRoles = () => {
  const { user, logout } = useAuth()
  const displayName = user || 'Administrador'
  const [roles, setRoles] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('labguard_access_token') : null
  const fallbackToken = getStoredSupabaseAccessToken()

  const getAuthToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    return sessionData?.session?.access_token || storedToken || fallbackToken || null
  }

  const loadRoles = async () => {
    setLoading(true)
    setLoadError('')
    const token = await getAuthToken()
    if (!token) {
      setLoading(false)
      setLoadError('No se encontro una sesion valida.')
      return
    }

    const response = await fetch(`${apiUrl}/api/admin/roles`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    setLoading(false)

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      setLoadError(payload.error || 'No se pudieron cargar los roles.')
      return
    }

    const payload = await response.json()
    setRoles(payload.data || [])
  }

  useEffect(() => {
    loadRoles()
  }, [])

  const handleDelete = (id) => {
    setConfirmDelete(id)
  }

  const confirmDeleteRole = async () => {
    if (confirmDelete === null) return
    setSubmitError('')
    setSubmitSuccess('')
    const token = await getAuthToken()
    if (!token) {
      setSubmitError('No se encontro una sesion valida.')
      return
    }

    const response = await fetch(`${apiUrl}/api/admin/roles/${confirmDelete}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      setSubmitError(payload.error || 'No se pudo eliminar el rol.')
      return
    }

    setSubmitSuccess('Rol eliminado.')
    setConfirmDelete(null)
    loadRoles()
  }

  const cancelDelete = () => {
    setConfirmDelete(null)
  }

  const openCreate = () => {
    setForm({ name: '', description: '' })
    setFormMode('create')
    setEditingId(null)
    setShowModal(true)
  }

  const openEdit = (role) => {
    setForm({ name: role.name, description: role.description })
    setFormMode('edit')
    setEditingId(role.id)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setSubmitError('')
    setSubmitSuccess('')
  }

  const handleFormChange = (field) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const name = form.name.trim()
    const description = form.description.trim()
    if (!name || !description) {
      setSubmitError('Completa el nombre y la descripcion del rol.')
      return
    }

    setSubmitError('')
    setSubmitSuccess('')
    const token = await getAuthToken()
    if (!token) {
      setSubmitError('No se encontro una sesion valida.')
      return
    }

    const url =
      formMode === 'edit' && editingId
        ? `${apiUrl}/api/admin/roles/${editingId}`
        : `${apiUrl}/api/admin/roles`
    const method = formMode === 'edit' && editingId ? 'PATCH' : 'POST'

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      setSubmitError(payload.error || 'No se pudo guardar el rol.')
      return
    }

    setSubmitSuccess(formMode === 'edit' ? 'Rol actualizado.' : 'Rol creado.')
    setShowModal(false)
    setEditingId(null)
    setForm({ name: '', description: '' })
    loadRoles()
  }

  return (
    <section className="admin-body">
      <div className="admin-shell">
        <header className="admin-bar">
          <div className="admin-heading">
            <h1>Panel de Administrador</h1>
            <p className="admin-greeting">Hola, <span className="admin-link">{displayName}</span></p>
          </div>
          <div className="admin-actions">
            <button className="admin-bell" type="button" aria-label="Ver notificaciones">
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
          <NavLink to="/admin/roles" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            Gestionar Roles
          </NavLink>
        </nav>

        <section className="admin-roles">
          <header className="users-head">
            <div className="users-title">
              <span className="dot dot-blue" aria-hidden="true" />
              <h3>Roles</h3>
            </div>
            <button className="roles-create" type="button" onClick={openCreate}>Crear nuevo rol</button>
          </header>

          <p className="hint">
            Los roles nuevos no habilitan pantallas automaticamente. Si necesitas accesos nuevos, hay que agregarlos en el frontend.
          </p>

          {loadError ? <div className="admin-alert error">{loadError}</div> : null}
          {submitSuccess ? <div className="admin-alert success">{submitSuccess}</div> : null}
          {submitError ? <div className="admin-alert error">{submitError}</div> : null}

          <div className="roles-table__wrap">
            <table className="roles-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {roles.length === 0 && (
                  <tr>
                    <td colSpan="3" className="users-empty">
                      {loading ? 'Cargando...' : 'Sin resultados'}
                    </td>
                  </tr>
                )}
                {roles.map((roleRow) => (
                  <tr key={roleRow.id}>
                    <td className="role-name">{roleRow.name}</td>
                    <td className="role-description">{roleRow.description}</td>
                    <td>
                      <div className="users-actions roles-actions">
                        <button className="btn link" type="button" onClick={() => openEdit(roleRow)}>
                          Editar
                        </button>
                        <button className="btn danger" type="button" onClick={() => handleDelete(roleRow.id)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <footer className="users-footer">
              <span>Mostrando {roles.length} de {roles.length} resultados</span>
              <div className="pager small">
                <button type="button" disabled>{'<'}</button>
                <button type="button" className="active">1</button>
                <button type="button" disabled>{'>'}</button>
              </div>
            </footer>
          </div>
        </section>
      </div>

      {showModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card admin-modal role-modal" role="document">
            <header className="modal-header">
              <h3>{formMode === 'edit' ? 'Editar rol' : 'Crear nuevo rol'}</h3>
              <button className="modal-close" type="button" aria-label="Cerrar" onClick={closeModal}></button>
            </header>
            <form className="admin-form role-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Nombre del rol</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={handleFormChange('name')}
                  placeholder="Ej. Supervisor de Calidad"
                  required
                />
                <small className="hint">Asigne un nombre único y descriptivo para este rol.</small>
              </label>
              <label className="form-field">
                <span>Descripción</span>
                <textarea
                  value={form.description}
                  onChange={handleFormChange('description')}
                  placeholder="Detalles del nuevo rol..."
                  required
                />
                <small className="hint">Proporcione detalles sobre el nivel de acceso y las funciones permitidas.</small>
              </label>
              <div className="modal-buttons">
                <button type="button" className="btn danger ghost" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="btn primary">{formMode === 'edit' ? 'Guardar cambios' : 'Crear rol'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmDelete !== null && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card admin-modal" role="document" style={{maxWidth: '400px'}}>
            <header className="modal-header">
              <h3>Confirmar eliminación</h3>
              <button className="modal-close" type="button" aria-label="Cerrar" onClick={cancelDelete}></button>
            </header>
            <div style={{padding: '16px 24px'}}>
              <p style={{margin: '0 0 16px', color: '#6c7489'}}>
                Estás seguro de que deseas eliminar este rol? Esta acción no se puede deshacer.
              </p>
              <div style={{display: 'flex', gap: '12px', justifyContent: 'flex-end'}}>
                <button type="button" className="btn ghost" onClick={cancelDelete}>Cancelar</button>
                <button type="button" className="btn danger" onClick={confirmDeleteRole}>Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default AdminRoles







