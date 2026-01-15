import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import '../styles/analyst-tasks.css'

const normalizeStatus = (value) => {
  const raw = (value || '').toString().toLowerCase().replace(/[-\s]+/g, '_')
  const map = {
    por_asignar: 'por_asignar',
    porasignar: 'por_asignar',
    esperando_analisis: 'esperando_analisis',
    en_espera_analisis: 'esperando_analisis',
    pendiente_analisis: 'esperando_analisis',
    pendiente_validacion: 'pendiente_validacion',
    pendiente_de_validacion: 'pendiente_validacion',
    esperando_validacion: 'pendiente_validacion',
    validacion_pendiente: 'pendiente_validacion',
    evaluada: 'evaluada',
    evaluado: 'evaluada',
  }
  return map[raw] || raw || 'por_asignar'
}

const normalizeId = (value) => (value === null || value === undefined ? '' : String(value).trim())

const resolveRowAnalystId = (row) =>
  normalizeId(
    row?.assigned_analyst_id ||
      row?.assigned_analyst ||
      row?.analyst_id ||
      row?.analystId ||
      row?.assignedAnalystId,
  )

const notifications = [
  { id: 1, type: 'Agua', accent: 'blue' },
  { id: 2, type: 'Alimento', accent: 'green' },
  { id: 3, type: 'Bebida alcoholica', accent: 'orange' },
]

const analysisParameters = [
  { id: 'ph', label: 'pH', unit: 'pH', range: '6.5 - 8.5' },
  { id: 'solidos', label: 'Solidos Totales', unit: 'mg/L', range: '0 - 500' },
]

const emptyForm = {
  color: '',
  texture: '',
  appearance: '',
  expiration: '',
  netWeight: '',
  flavor: '',
  ph: '',
  solids: '',
}

const AnalystTasks = () => {
  const { user, accessToken, logout, profile, loading: authLoading } = useAuth()
  const displayName = user || 'Analista'
  const [showNotifications, setShowNotifications] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedSample, setSelectedSample] = useState(null)
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [form, setForm] = useState(emptyForm)

  const apiUrl = import.meta.env.VITE_API_URL

  const pendientesAnalisis = useMemo(
    () => samples.filter((s) => s.status === 'esperando_analisis'),
    [samples],
  )
  const pendientesValidacion = useMemo(
    () => samples.filter((s) => s.status === 'pendiente_validacion'),
    [samples],
  )

  const resolveAnalystId = () => normalizeId(profile?.id || profile?.user_id || user?.id)

  const loadSamples = async () => {
    if (authLoading) return
    if (!accessToken) {
      setInfo('Inicia sesión para ver tus tareas.')
      return
    }
    setLoading(true)
    setError('')
    setInfo('')
    try {
      const res = await fetch(`${apiUrl}/api/samples`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'No se pudieron cargar las muestras')
      const rows = payload?.data || []
      const analystId = resolveAnalystId()
      const assignedRows = analystId
        ? rows.filter((r) => resolveRowAnalystId(r) === analystId)
        : rows
      if (analystId && !assignedRows.length && rows.length) {
        setInfo('No tienes muestras asignadas actualmente.')
      }
      if (!analystId) {
        setInfo('No se pudo determinar tu usuario. Inicia sesión nuevamente.')
      }
      const mapRow = (row) => ({
        id: row.id || row.code,
        code: row.code,
        type: row.type,
        status: normalizeStatus(row.status),
        dueDate: row.due_date?.slice(0, 10) || '',
        origin: row.origin,
        transportCondition: row.transport_condition,
        storageCondition: row.storage_condition,
        businessName: row.business_name,
        phone: row.phone,
        address: row.address,
      })
      setSamples(assignedRows.map(mapRow))
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las muestras')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSamples()
  }, [accessToken, authLoading])

  const handleOpenComplete = (sample) => {
    setSelectedSample(sample)
    setForm(emptyForm)
    setShowCompleteModal(true)
  }

  const handleOpenDetail = (sample) => {
    setSelectedSample(sample)
    setShowDetailModal(true)
  }

  const handleCompleteSample = async () => {
    if (!selectedSample) return
    setActionLoading(true)
    setError('')
    try {
      const analysisPayload = {
        color: form.color || null,
        texture: form.texture || null,
        appearance: form.appearance || null,
        expiration: form.expiration || null,
        net_weight: form.netWeight || null,
        flavor: form.flavor || null,
        results: [
          { param: 'pH', value: form.ph || null, unit: 'pH', range: '6.5 - 8.5', status: null },
          {
            param: 'Solidos Totales',
            value: form.solids || null,
            unit: 'mg/L',
            range: '0 - 500',
            status: null,
          },
        ],
      }

      const res = await fetch(`${apiUrl}/api/samples/${selectedSample.id}/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ analysis_payload: analysisPayload }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'No se pudo completar el analisis')
      await loadSamples()
      setShowCompleteModal(false)
      setSelectedSample(null)
    } catch (err) {
      setError(err.message || 'No se pudo completar el analisis')
    } finally {
      setActionLoading(false)
    }
  }

  const renderError = () =>
    error ? <div className="analyst-tasks-error">{error}</div> : null

  return (
    <section className="analyst-body">
      <div className="analyst-shell">
        <header className="analyst-bar">
          <div className="analyst-heading">
            <h1>Panel del Analista</h1>
            <p className="analyst-greeting">
              Hola, <span className="analyst-name">{displayName}</span>
            </p>
          </div>
          <div className="analyst-actions analyst-tasks-actions">
            <button
              className="analyst-bell"
              type="button"
              aria-label="Ver notificaciones"
              aria-expanded={showNotifications}
              onClick={() => setShowNotifications((prev) => !prev)}
            >
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
            <button className="analyst-logout" type="button" onClick={logout}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M16 3.5h4.5V8"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 20.5H3.5V16"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="m20.5 3.5-6 6"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="m3.5 20.5 6-6"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              Cerrar Sesión
            </button>
            {showNotifications && (
              <div className="analyst-tasks-notifications" role="dialog" aria-label="Notificaciones">
                <div className="analyst-tasks-notifications-title">Notificaciones</div>
                <div className="analyst-tasks-notifications-list">
                  {notifications.map((note) => (
                    <div className="analyst-tasks-notification" key={note.id}>
                      <div className={`analyst-tasks-notification-icon is-${note.accent}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M10 2h4v2h3a2 2 0 0 1 2 2v1H5V6a2 2 0 0 1 2-2h3V2Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M6 9h12l-1.2 10a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 9Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <div>
                        <div className="analyst-tasks-notification-title">
                          Ha sido asignado al analisis de una muestra
                        </div>
                        <div className="analyst-tasks-notification-meta">Tipo de muestra: {note.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>
        <nav className="analyst-tabs">
          <NavLink to="/analista" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            Inicio
          </NavLink>
          <NavLink
            to="/analista/tareas"
            className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
          >
            Tareas
          </NavLink>
        </nav>

        {loading && <div className="analyst-tasks-loading">Cargando...</div>}
        {info && !error && <div className="analyst-tasks-info">{info}</div>}
        {renderError()}

        <div className="analyst-tasks-content">
          <section className="analyst-tasks-section">
            <div className="analyst-tasks-section-title analyst-tasks-section-title--blue">
              <span className="dot dot--blue"></span>
              PENDIENTES DE ANALISIS
            </div>
            <div className="analyst-tasks-cards">
              {pendientesAnalisis.length === 0 && !loading && (
                <div className="analyst-tasks-empty">No hay muestras pendientes de analisis.</div>
              )}
              {pendientesAnalisis.map((item) => (
                <article className="analyst-tasks-card analyst-tasks-card--blue" key={item.id}>
                  <div className="analyst-tasks-card-body">
                    <div className="analyst-tasks-card-row">
                      <span>Código</span>
                      <strong>{item.code}</strong>
                    </div>
                    <div className="analyst-tasks-card-row">
                      <span>Tipo</span>
                      <strong>{item.type}</strong>
                    </div>
                    <div className="analyst-tasks-card-row">
                      <span>Fecha Límite</span>
                      <strong>{item.dueDate}</strong>
                    </div>
                  </div>
                  <div className="analyst-tasks-card-actions">
                    <button
                      className="analyst-tasks-secondary"
                      type="button"
                      onClick={() => handleOpenDetail(item)}
                    >
                      Ver detalles
                    </button>
                    <button
                      className="analyst-tasks-primary"
                      type="button"
                      onClick={() => handleOpenComplete(item)}
                    >
                      Completar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="analyst-tasks-section">
            <div className="analyst-tasks-section-title analyst-tasks-section-title--orange">
              <span className="dot dot--orange"></span>
              PENDIENTES DE VALIDACION
            </div>
            <div className="analyst-tasks-cards">
              {pendientesValidacion.length === 0 && !loading && (
                <div className="analyst-tasks-empty">No hay muestras pendientes de validacion.</div>
              )}
              {pendientesValidacion.map((item) => (
                <article className="analyst-tasks-card analyst-tasks-card--orange" key={item.id}>
                  <div className="analyst-tasks-card-body">
                    <div className="analyst-tasks-card-row">
                      <span>Código</span>
                      <strong>{item.code}</strong>
                    </div>
                    <div className="analyst-tasks-card-row">
                      <span>Tipo</span>
                      <strong>{item.type}</strong>
                    </div>
                    <div className="analyst-tasks-card-row">
                      <span>Fecha Límite</span>
                      <strong>{item.dueDate}</strong>
                    </div>
                    <div className="analyst-tasks-card-note">Pendiente de validacion</div>
                  </div>
                  <div className="analyst-tasks-card-actions single">
                    <button
                      className="analyst-tasks-secondary"
                      type="button"
                      onClick={() => handleOpenDetail(item)}
                    >
                      Ver detalles
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        {showCompleteModal && (
          <div
            className="analyst-tasks-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-title"
            onClick={() => setShowCompleteModal(false)}
          >
            <div className="analyst-tasks-modal" onClick={(event) => event.stopPropagation()}>
              <div className="analyst-tasks-modal-header">
                <h3 id="complete-title">Completar muestra y analisis</h3>
                <button
                  className="analyst-tasks-modal-close"
                  type="button"
                  aria-label="Cerrar formulario"
                  onClick={() => setShowCompleteModal(false)}
                >
                  x
                </button>
              </div>
              <form className="analyst-tasks-form">
                <div className="analyst-tasks-form-grid">
                  <label className="analyst-tasks-field">
                    <span>Color</span>
                    <select
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    >
                      <option value="" disabled>
                        Seleccionar...
                      </option>
                      <option>Transparente</option>
                      <option>Amarillo</option>
                      <option>Rojo</option>
                    </select>
                  </label>
                  <label className="analyst-tasks-field">
                    <span>Textura</span>
                    <select
                      value={form.texture}
                      onChange={(e) => setForm((f) => ({ ...f, texture: e.target.value }))}
                    >
                      <option value="" disabled>
                        Seleccionar...
                      </option>
                      <option>Liquida</option>
                      <option>Viscosa</option>
                      <option>Granulada</option>
                    </select>
                  </label>
                  <label className="analyst-tasks-field">
                    <span>Apariencia</span>
                    <select
                      value={form.appearance}
                      onChange={(e) => setForm((f) => ({ ...f, appearance: e.target.value }))}
                    >
                      <option value="" disabled>
                        Seleccionar...
                      </option>
                      <option>Clara</option>
                      <option>Turbria</option>
                      <option>Con sedimentos</option>
                    </select>
                  </label>
                  <label className="analyst-tasks-field">
                    <span>Fecha de expiracion</span>
                    <input
                      type="date"
                      value={form.expiration}
                      onChange={(e) => setForm((f) => ({ ...f, expiration: e.target.value }))}
                    />
                  </label>
                  <label className="analyst-tasks-field">
                    <span>Peso Neto (g)</span>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="0.01"
                      value={form.netWeight}
                      onChange={(e) => setForm((f) => ({ ...f, netWeight: e.target.value }))}
                    />
                  </label>
                  <label className="analyst-tasks-field">
                    <span>Sabor</span>
                    <select
                      value={form.flavor}
                      onChange={(e) => setForm((f) => ({ ...f, flavor: e.target.value }))}
                    >
                      <option value="" disabled>
                        Seleccionar...
                      </option>
                      <option>Neutro</option>
                      <option>Acido</option>
                      <option>Dulce</option>
                    </select>
                  </label>
                </div>

                <div className="analyst-tasks-results">
                  <div className="analyst-tasks-results-title">Resultados de analisis</div>
                  <div className="analyst-tasks-table">
                    <div className="analyst-tasks-table-row analyst-tasks-table-head">
                      <span>Parametro</span>
                      <span>Resultado</span>
                      <span>Unidad</span>
                      <span>Rango normal</span>
                    </div>
                    {analysisParameters.map((item) => (
                      <div className="analyst-tasks-table-row" key={item.id}>
                        <span>{item.label}</span>
                        <input
                          type="text"
                          placeholder="-"
                          value={item.id === 'ph' ? form.ph : form.solids}
                          onChange={(e) =>
                            setForm((f) =>
                              item.id === 'ph'
                                ? { ...f, ph: e.target.value }
                                : { ...f, solids: e.target.value },
                            )
                          }
                        />
                        <span>{item.unit}</span>
                        <span>{item.range}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="analyst-tasks-form-actions">
                  <button
                    className="analyst-tasks-primary"
                    type="button"
                    disabled={actionLoading}
                    onClick={handleCompleteSample}
                  >
                    {actionLoading ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDetailModal && selectedSample && (
          <div
            className="analyst-tasks-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onClick={() => setShowDetailModal(false)}
          >
            <div className="analyst-tasks-modal analyst-tasks-modal--details" onClick={(event) => event.stopPropagation()}>
              <div className="analyst-tasks-modal-header">
                <h3 id="detail-title">Detalles de la muestra</h3>
                <button
                  className="analyst-tasks-modal-close"
                  type="button"
                  aria-label="Cerrar detalles"
                  onClick={() => setShowDetailModal(false)}
                >
                  x
                </button>
              </div>
              <form className="analyst-tasks-form">
                <div className="analyst-tasks-form-grid">
                  <label className="analyst-tasks-field">
                    <span>Codigo</span>
                    <input value={selectedSample.code || ''} readOnly />
                  </label>
                  <label className="analyst-tasks-field">
                    <span>Tipo de muestra</span>
                    <select value={selectedSample.type || ''} disabled>
                      <option>{selectedSample.type}</option>
                    </select>
                  </label>
                  <label className="analyst-tasks-field">
                    <span>Nombre/Razon social</span>
                    <input value={selectedSample.businessName || ''} readOnly />
                  </label>
                  <label className="analyst-tasks-field">
                    <span>Origen</span>
                    <select value={selectedSample.origin || ''} disabled>
                      <option>{selectedSample.origin}</option>
                    </select>
                  </label>
                  <label className="analyst-tasks-field">
                    <span>Telefono de contacto</span>
                    <input value={selectedSample.phone || ''} readOnly />
                  </label>
                  <label className="analyst-tasks-field">
                    <span>Direccion</span>
                    <input value={selectedSample.address || ''} readOnly />
                  </label>
                  <label className="analyst-tasks-field">
                    <span>Condiciones de transporte</span>
                    <select value={selectedSample.transportCondition || ''} disabled>
                      <option>{selectedSample.transportCondition}</option>
                    </select>
                  </label>
                  <label className="analyst-tasks-field">
                    <span>Condiciones de almacenamiento</span>
                    <select value={selectedSample.storageCondition || ''} disabled>
                      <option>{selectedSample.storageCondition}</option>
                    </select>
                  </label>
                </div>
                <div className="analyst-tasks-form-actions analyst-tasks-form-actions--center">
                  <button
                    className="analyst-tasks-primary"
                    type="button"
                    onClick={() => setShowDetailModal(false)}
                  >
                    Regresar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default AnalystTasks
