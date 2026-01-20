import { useMemo, useState, useEffect, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getStoredSupabaseAccessToken } from '../lib/supabaseSession.js'

const baseDetail = {
  storageCondition: 'En envase sellado',
  businessName: 'Grupo Ramos',
  phone: '829-376-6606',
  address: 'Calle Winston Arnaud #42',
  email: 'grupo.ramos@gmail.com',
  sampleType: 'Agua',
  origin: 'Fabrica',
  transportCondition: 'Temperatura ambiente',
  receptionDate: '2025-10-24T14:30:00Z',
  issueDate: '2025-10-30T07:30:00Z',
  color: 'Normal',
  texture: 'Líquida.',
  appearance: 'Homogeneo',
  netWeight: '200',
  flavor: 'Normal',
  expiration: '2025-12-14',
  results: [
    { param: 'pH', value: '5000', unit: 'pH', range: '6.5 - 8.5', status: 'high' },
    { param: 'Sólidos Totales', value: '7', unit: 'mg/L', range: '0 - 500', status: 'ok' },
    { param: 'Recuento Coliformes', value: '0.5', unit: 'NPM/100 mL', range: '0 - 1.1', status: 'ok' },
    { param: 'Coliformes Totales', value: '100', unit: '--', range: '---', status: 'ok' },
    { param: 'Turbidez', value: '1', unit: 'NTU', range: '0 - 5', status: 'ok' },
  ],
}

const EvaluatorSearch = () => {
  const { user, logout, accessToken } = useAuth()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [data, setData] = useState([])
  const [selected, setSelected] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [analystsMap, setAnalystsMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const apiUrl = import.meta.env.VITE_API_URL

  const resolveToken = () => accessToken || localStorage.getItem('labguard_access_token') || getStoredSupabaseAccessToken() || ''

  const normalizeSample = (row) => {
    const payload = {
      ...(row.analysis_payload || {}),
      ...(row.validation_payload || {}),
    }

    return {
      id: row.id || row.code,
      code: row.code,
      type: row.type,
      analyst: row.assigned_analyst_id ? analystsMap[row.assigned_analyst_id] || 'Sin asignar' : 'Sin asignar',
      detail: {
        ...baseDetail,
        sampleType: row.type,
        origin: row.origin,
        transportCondition: row.transport_condition,
        storageCondition: row.storage_condition,
        businessName: row.business_name,
        phone: row.phone,
        address: row.address,
        receptionDate: row.received_at,
        color: payload.color || '',
        texture: payload.texture || '',
        appearance: payload.appearance || '',
        expiration: payload.expiration || '',
        netWeight: payload.net_weight || payload.netWeight || '',
        flavor: payload.flavor || '',
        results: payload.results || baseDetail.results || [],
      },
    }
  }

  const loadAnalysts = useCallback(async () => {
    if (!resolveToken()) return
    try {
      const res = await fetch(`${apiUrl}/api/analysts`, {
        headers: { Authorization: `Bearer ${resolveToken()}` },
      })
      const payload = await res.json()
      if (!res.ok) return
      const map = {}
      ;(payload?.data || []).forEach((row) => {
        map[row.id] = row.full_name
      })
      setAnalystsMap(map)
    } catch (err) {
      console.warn('No se pudieron cargar analistas', err)
    }
  }, [apiUrl, accessToken])

  const loadSamples = useCallback(async () => {
    const token = resolveToken()
    if (!token) {
      setError('Necesitas iniciar sesión para ver las muestras.')
      setData([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${apiUrl}/api/samples`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || 'No se pudieron cargar las muestras')
      }
      const rows = payload?.data || []
      setData(rows.map((row) => normalizeSample(row)))
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las muestras')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [apiUrl, analystsMap, accessToken])

  useEffect(() => {
    loadAnalysts()
  }, [loadAnalysts])

  useEffect(() => {
    loadSamples()
  }, [loadSamples])

  const filtered = useMemo(() => {
    return data.filter((row) => {
      const matchesQuery = query ? row.code.toLowerCase().includes(query.toLowerCase()) : true
      const matchesType = type ? row.type === type : true
      return matchesQuery && matchesType
    })
  }, [data, query, type])

  const handleView = (item) => {
    setSelected(item)
    setShowModal(true)
  }

  const handleDelete = (item) => {
    setConfirmDelete(item)
  }

  const confirmDeleteSample = () => {
    if (confirmDelete) {
      setData((prev) => prev.filter((row) => row.id !== confirmDelete.id))
      setConfirmDelete(null)
    }
  }

  const cancelDelete = () => {
    setConfirmDelete(null)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelected(null)
  }

  return (
    <section className="evaluator-body">
      <div className="evaluator-shell">
        <header className="evaluator-bar">
          <div>
            <p className="evaluator-greeting">
              Hola, <span className="evaluator-link">{user || 'Evaluador'}</span>
            </p>
            <h2>Panel del Evaluador</h2>
          </div>
          <div className="evaluator-actions">
            <button className="icon-button" type="button" aria-label="Ver notificaciones">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
            <button className="evaluator-logout" type="button" onClick={logout}>
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

        <nav className="evaluator-tabs" aria-label="Secciones del evaluador">
          <NavLink to="/evaluador" className={({ isActive }) => `tab${isActive ? ' active' : ''}`} end>
            Inicio
          </NavLink>
          <NavLink to="/evaluador/tareas" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            Tareas
          </NavLink>
          <NavLink to="/evaluador/busqueda" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            Búsqueda
          </NavLink>
        </nav>

        <section className="eval-search">
          <header className="eval-search__header">
            <div className="eval-search__title">
              <span className="dot dot-blue" aria-hidden="true" />
              <h3>Muestras</h3>
            </div>
            {error && <div className="alert error">{error}</div>}
            {loading && <div className="alert info">Cargando muestras...</div>}
            <div className="eval-search__filters">
              <div className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m15 15 4 4" stroke="#98a0b3" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="11" cy="11" r="6" stroke="#98a0b3" strokeWidth="1.8" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por código..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="select-shell">
                <label className="sr-only" htmlFor="typeFilter">Tipo</label>
                <select id="typeFilter" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">Tipo: Todos</option>
                  <option value="Agua">Tipo: Agua</option>
                  <option value="Alimento">Tipo: Alimento</option>
                  <option value="Bebida alcoholica">Tipo: Bebida alcoholica</option>
                </select>
              </div>
            </div>
          </header>

          <div className="eval-table__wrap">
            <table className="eval-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Analista</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan="4" className="eval-table__empty">Sin resultados</td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td>{row.type}</td>
                    <td>{row.analyst}</td>
                    <td>
                      <div className="eval-actions">
                        <button className="btn link" type="button" onClick={() => handleView(row)}>
                          Visualizar
                        </button>
                        <button className="btn danger" type="button" onClick={() => handleDelete(row)}>
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <footer className="eval-table__footer">
              <span>Mostrando {filtered.length} de {data.length} resultados</span>
              <div className="pager small">
                <button type="button" disabled>{'<'}</button>
                <button type="button" className="active">1</button>
                <button type="button" disabled>2</button>
                <button type="button" disabled>...</button>
                <button type="button" disabled>{'>'}</button>
              </div>
            </footer>
          </div>
        </section>
      </div>

      {showModal && selected && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card eval-modal">
            <header className="modal-header">
              <h3>Detalles de la muestra</h3>
              <button className="modal-close" type="button" onClick={closeModal} aria-label="Cerrar">×</button>
            </header>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-field">
                  <label>Código</label>
                  <input value={selected.code} disabled />
                </div>
                <div className="detail-field">
                  <label>Condiciones de almacenamiento</label>
                  <input value={selected.detail?.storageCondition || ''} disabled />
                </div>
                <div className="detail-field">
                  <label>Tipo de muestra</label>
                  <input value={selected.detail?.sampleType || selected.type} disabled />
                </div>
                <div className="detail-field">
                  <label>Nombre/Razón social</label>
                  <input value={selected.detail?.businessName || ''} disabled />
                </div>
                <div className="detail-field">
                  <label>Origen</label>
                  <input value={selected.detail?.origin || ''} disabled />
                </div>
                <div className="detail-field">
                  <label>Teléfono de contacto</label>
                  <input value={selected.detail?.phone || ''} disabled />
                </div>
                <div className="detail-field">
                  <label>Condiciones de transporte</label>
                  <input value={selected.detail?.transportCondition || ''} disabled />
                </div>
                <div className="detail-field">
                  <label>Dirección</label>
                  <input value={selected.detail?.address || ''} disabled />
                </div>
              </div>

              {selected.detail?.results && (
                <div className="results-block">
                  <h4>Resultados de análisis</h4>
                  <div className="detail-grid small">
                    <div className="detail-field">
                      <label>Color</label>
                      <input value={selected.detail.color || ''} disabled />
                    </div>
                    <div className="detail-field">
                      <label>Textura</label>
                      <input value={selected.detail.texture || ''} disabled />
                    </div>
                    <div className="detail-field">
                      <label>Apariencia</label>
                      <input value={selected.detail.appearance || ''} disabled />
                    </div>
                    <div className="detail-field">
                      <label>Fecha de expiración</label>
                      <input value={selected.detail.expiration || ''} disabled />
                    </div>
                    <div className="detail-field">
                      <label>Peso Neto (g)</label>
                      <input value={selected.detail.netWeight || ''} disabled />
                    </div>
                    <div className="detail-field">
                      <label>Sabor</label>
                      <input value={selected.detail.flavor || ''} disabled />
                    </div>
                  </div>

                  <div className="results-table">
                    <div className="results-head">
                      <span>Parámetro</span>
                      <span>Resultado</span>
                      <span>Unidad</span>
                      <span>Rango normal</span>
                    </div>
                    {selected.detail.results.map((r) => (
                      <div className="results-row" key={r.param}>
                        <span>{r.param}</span>
                        <span>
                          <span className={`pill ${r.status === 'high' ? 'pill-danger' : 'pill-success'}`}>
                            {r.value}
                          </span>
                        </span>
                        <span>{r.unit}</span>
                        <span>{r.range}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button className="btn ghost" type="button" onClick={closeModal}>Regresar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <header className="modal-header">
              <h3>Eliminar muestra</h3>
              <button className="modal-close" type="button" aria-label="Cerrar" onClick={cancelDelete}>×</button>
            </header>
            <div className="modal-body">
              <p>
                ¿Estás seguro de que deseas eliminar esta muestra? Esta acción no se puede deshacer.
              </p>
              <div className="modal-buttons">
                <button type="button" className="btn ghost" onClick={cancelDelete}>Cancelar</button>
                <button type="button" className="btn danger" onClick={confirmDeleteSample}>Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default EvaluatorSearch
