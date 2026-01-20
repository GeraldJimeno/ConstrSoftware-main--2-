import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { getStoredSupabaseAccessToken } from '../lib/supabaseSession.js'
import '../styles/admin.css'

const AdminUsers = () => {
  const { user, logout, accessToken } = useAuth()
  const displayName = user || 'Administrador'
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('labguard_access_token') : null
  const fallbackToken = getStoredSupabaseAccessToken()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('Todos')
  const [roleOpen, setRoleOpen] = useState(false)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [rolesList, setRolesList] = useState([])
  const [rolesError, setRolesError] = useState('')
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ roleId: '' })
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState('')

  const getAuthToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    return sessionData?.session?.access_token || accessToken || storedToken || fallbackToken || null
  }

  const roleLabelBySlug = useMemo(() => {
    return rolesList.reduce((acc, roleRow) => {
      acc[roleRow.slug] = roleRow.name
      return acc
    }, {})
  }, [rolesList])

  const roleFilterOptions = useMemo(() => {
    return ['Todos', 'Sin rol', ...rolesList.map((roleRow) => roleRow.name)]
  }, [rolesList])

  const loadRoles = async () => {
    setRolesError('')
    const token = await getAuthToken()
    if (!token) {
      setRolesError('No se pudo validar la sesion para cargar roles.')
      return
    }

    const response = await fetch(`${apiUrl}/api/admin/roles`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      setRolesError(payload.error || 'No se pudieron cargar los roles.')
      return
    }

    const payload = await response.json()
    setRolesList(payload.data || [])
  }

  const updateProfileRole = async (profileId, roleId) => {
    const token = await getAuthToken()
    if (!token) {
      return { error: new Error('No se pudo actualizar el rol.') }
    }

    const response = await fetch(`${apiUrl}/api/admin/users/${profileId}/role`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role_id: roleId }),
    })

    if (!response.ok) {
      return { error: new Error('No se pudo actualizar el rol.') }
    }

    return { error: null }
  }

  const fetchProfiles = async () => {
    const token = await getAuthToken()
    if (!token) {
      return { data: null, error: new Error('No se pudo validar la sesión.') }
    }

    const response = await fetch(`${apiUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      return { data: null, error: new Error(payload.error || 'No se pudo cargar la lista de usuarios.') }
    }

    const payload = await response.json()
    return { data: payload.data || [], error: null }
  }

  const loadProfiles = async () => {
    setLoading(true)
    setLoadError('')
    const { data: rows, error } = await fetchProfiles()
    setLoading(false)

    if (error) {
      setLoadError(error.message || 'No se pudo cargar la lista de usuarios.')
      return
    }

    setData(rows || [])
  }

  useEffect(() => {
    loadRoles()
    loadProfiles()
  }, [])

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const matchesSearch = search ? row.full_name?.toLowerCase().includes(search.toLowerCase()) : true
      const currentRoleLabel = row.roles?.slug
        ? roleLabelBySlug[row.roles.slug] || row.roles?.name
        : null
      const matchesRole =
        role === 'Todos'
          ? true
          : role === 'Sin rol'
            ? !row.roles?.slug
            : currentRoleLabel === role
      return matchesSearch && matchesRole
    })
  }, [data, role, roleLabelBySlug, search])

  const handleEdit = (row) => {
    setEditing(row)
    setEditForm({ roleId: row.role_id || '' })
    setSubmitError('')
    setSubmitSuccess('')
  }

  const closeEdit = () => {
    setEditing(null)
    setEditForm({ roleId: '' })
  }

  const handleEditChange = (field) => (event) => {
    setEditForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const submitEdit = async (event) => {
    event.preventDefault()
    if (!editing) return
    setSubmitError('')
    setSubmitSuccess('')

    if (!editForm.roleId) {
      setSubmitError('Selecciona un rol valido.')
      return
    }

    const { error } = await updateProfileRole(editing.id, editForm.roleId)

    if (error) {
      setSubmitError('No se pudo actualizar el rol.')
      return
    }

    setSubmitSuccess('Rol actualizado.')
    setEditing(null)
    setEditForm({ roleId: '' })
    await loadProfiles()
  }

  const handleRoleSelect = (value) => {
    setRole(value)
    setRoleOpen(false)
  }

  return (
    <section className="admin-body">
      <div className="admin-shell">
        <header className="admin-bar">
          <div className="admin-heading">
            <h1>Panel de Administrador</h1>
            <p className="admin-greeting">
              Hola, <span className="admin-link">{displayName}</span>
            </p>
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
              <h3>Usuarios</h3>
            </div>
            <div className="users-head__actions">
              <button className="primary-button users-refresh" type="button" onClick={loadProfiles}>
                {loading ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
          </header>
          <p className="hint">Los usuarios se crean desde aqui y puedes revisar o asignar roles.</p>

          <div className="users-filters">
            <div className="input-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m15 15 4 4" stroke="#98a0b3" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="11" cy="11" r="6" stroke="#98a0b3" strokeWidth="1.8" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="select-shell">
              <label className="sr-only" htmlFor="roleFilter">Rol</label>
              <button
                id="roleFilter"
                type="button"
                className="role-filter"
                aria-haspopup="listbox"
                aria-expanded={roleOpen}
                onClick={() => setRoleOpen((prev) => !prev)}
              >
                <span>Rol: {role}</span>
                <span aria-hidden="true">v</span>
              </button>
              {roleOpen && (
                <div className="role-dropdown" role="listbox" aria-label="Filtrar por rol">
                    {roleFilterOptions.map((r) => (
                    <button
                      type="button"
                      key={r}
                      className="role-option"
                      role="option"
                      aria-selected={role === r}
                      onClick={() => handleRoleSelect(r)}
                    >
                      <span className={`check ${role === r ? 'is-active' : ''}`} aria-hidden="true" />
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loadError ? <div className="admin-alert error">{loadError}</div> : null}
          {rolesError ? <div className="admin-alert error">{rolesError}</div> : null}

          <div className="users-table__wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>ID</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="4" className="users-empty">
                      {loading ? 'Cargando...' : 'Sin resultados'}
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.full_name || 'Sin nombre'}</td>
                    <td>{roleLabelBySlug[row.roles?.slug] || row.roles?.name || 'Sin rol'}</td>
                    <td>{row.id}</td>
                    <td>
                      <div className="users-actions">
                        <button className="btn link" type="button" onClick={() => handleEdit(row)}>
                          Asignar rol
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <footer className="users-footer">
              <span>Mostrando {filtered.length} de {data.length} resultados</span>
              <div className="pager small">
                <button type="button" disabled>{'<'}</button>
                <button type="button" className="active">1</button>
                <button type="button" disabled>{'>'}</button>
              </div>
            </footer>
          </div>
        </section>
      </div>

      {editing && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card admin-modal" role="document">
            <header className="modal-header">
              <h3>Asignar rol</h3>
              <button className="modal-close" type="button" aria-label="Cerrar" onClick={closeEdit}>
                x
              </button>
            </header>
            <form className="admin-form" onSubmit={submitEdit}>
              <div className="admin-form-grid">
                <label className="form-field">
                  <span>Nombre</span>
                  <input value={editing.full_name || ''} readOnly />
                </label>
                <label className="form-field">
                  <span>Rol</span>
                  <select value={editForm.roleId} onChange={handleEditChange('roleId')} required>
                    <option value="">Seleccionar...</option>
                    {rolesList.map((roleOption) => (
                      <option key={roleOption.id} value={roleOption.id}>
                        {roleOption.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {submitError ? <div className="admin-alert error">{submitError}</div> : null}
              {submitSuccess ? <div className="admin-alert success">{submitSuccess}</div> : null}
              <div className="modal-buttons">
                <button type="button" className="btn danger ghost" onClick={closeEdit}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary">
                  Guardar rol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default AdminUsers
