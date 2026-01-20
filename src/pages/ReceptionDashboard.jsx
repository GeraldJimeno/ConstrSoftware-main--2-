import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getStoredSupabaseAccessToken } from '../lib/supabaseSession.js'

const sampleTypes = ['Agua', 'Alimento', 'Bebida alcoholica']
const origins = ['Planta A', 'Planta B', 'Cliente externo', 'Campo']
const transportConditions = ['Cadena en frío', 'Temperatura ambiente', 'Refrigerado']
const storageConditions = ['Refrigerado', 'Congelado', 'Temperatura ambiente']

const createFormState = () => ({
  code: null,
  sampleType: '',
  origin: '',
  transportCondition: '',
  storageCondition: '',
  businessName: '',
  phone: '',
  address: '',
})

const todayISO = () => new Date().toISOString().slice(0, 10)

const ReceptionDashboard = () => {
  const { user, accessToken, logout } = useAuth()
  const [samples, setSamples] = useState([])
  const [isRegisterModalOpen, setRegisterModalOpen] = useState(false)
  const [isDetailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedSample, setSelectedSample] = useState(null)
  const [formData, setFormData] = useState(createFormState())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resolvedToken = useMemo(
    () => accessToken || localStorage.getItem('labguard_access_token') || getStoredSupabaseAccessToken() || '',
    [accessToken],
  )

  const openRegisterModal = () => {
    setFormData(createFormState())
    setRegisterModalOpen(true)
  }

  const closeRegisterModal = () => setRegisterModalOpen(false)

  const openDetailModal = (sample) => {
    setSelectedSample(sample)
    setDetailModalOpen(true)
  }

  const closeDetailModal = () => {
    setSelectedSample(null)
    setDetailModalOpen(false)
  }

  const handleChange = (field) => (event) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    if (!formData.sampleType || !formData.origin || !formData.transportCondition ||
        !formData.storageCondition || !formData.businessName || !formData.phone || !formData.address) {
      alert('Completa todos los campos requeridos')
      return
    }

    const submit = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL
        if (!resolvedToken) {
          setError('Inicia sesion nuevamente para registrar la muestra.')
          return
        }
        const res = await fetch(`${apiUrl}/api/samples`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resolvedToken}`,
          },
          body: JSON.stringify({
            type: formData.sampleType,
            origin: formData.origin,
            transport_condition: formData.transportCondition,
            storage_condition: formData.storageCondition,
            business_name: formData.businessName,
            phone: formData.phone,
            address: formData.address,
          }),
        })

        const payload = await res.json()
        if (!res.ok) {
          throw new Error(payload?.error || 'No se pudo registrar la muestra')
        }

        const sample = payload.data
        // Refresca desde backend para que todos los dashboards vean el nuevo registro inmediatamente
        await loadSamples()
        setRegisterModalOpen(false)
        setFormData(createFormState())
      } catch (err) {
        setError(err.message || 'No se pudo registrar la muestra')
      }
    }

    submit()
  }

  const loadSamples = async () => {
    if (!resolvedToken) return
    setLoading(true)
    setError('')
    try {
      const apiUrl = import.meta.env.VITE_API_URL
      const res = await fetch(`${apiUrl}/api/samples`, {
        headers: { Authorization: `Bearer ${resolvedToken}` },
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || 'No se pudieron cargar las muestras')
      }
      const rows = payload?.data || []
      setSamples(
        rows.map((row) => ({
          code: row.code,
          type: row.type,
          receivedAt: row.received_at?.slice(0, 10) || todayISO(),
          status: row.status,
          origin: row.origin,
          transportCondition: row.transport_condition,
          storageCondition: row.storage_condition,
          businessName: row.business_name,
          phone: row.phone,
          address: row.address,
        })),
      )
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las muestras')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSamples()
  }, [accessToken])

  // Solo mostrar en esta vista las muestras por asignar, renombrando estado a "Recibida"
  const displayedSamples = (samples || []).filter(
    (sample) => (sample.status || '').toLowerCase() === 'por_asignar',
  )

  return (
    <section className="reception-body">
      <div className="reception-shell">
        <header className="reception-top">
          <div className="reception-headings">
            <h1>Panel del Recepcion</h1>
            <p>
              Hola, <span className="reception-name">{user}</span>
            </p>
          </div>
          <div className="reception-actions">
            <button className="reception-logout" type="button" onClick={logout}>
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
                  d="M20.5 3.5 14.5 9.5"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3.5 20.5 9.5 14.5"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Cerrar Sesión
            </button>
          </div>
        </header>

        <nav className="reception-tabs" aria-label="Navegacion de recepcion">
          <button className="reception-tab is-active" type="button">
            Inicio
          </button>
        </nav>

        <main className="reception-main">
          <div className="reception-header-row">
            <div className="reception-section-title">
              <span className="reception-dot" />
              <span>Muestras Recientes</span>
            </div>
            <button className="reception-primary" type="button" onClick={openRegisterModal}>
              Registrar nueva muestra
            </button>
          </div>

          <div className="reception-card">
            <div className="table-shell">
              <table className="samples-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Tipo</th>
                    <th>Fecha de Recepción</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="empty-cell" colSpan={5}>
                        Cargando muestras...
                      </td>
                    </tr>
                  ) : displayedSamples.length > 0 ? (
                    displayedSamples.map((sample) => (
                      <tr key={sample.code}>
                        <td>{sample.code}</td>
                        <td>{sample.type}</td>
                        <td>{sample.receivedAt}</td>
                        <td>
                          <span className="status-pill">Recibida</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="action-link action-link__button"
                            onClick={() => openDetailModal(sample)}
                          >
                            Ver Detalles
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="empty-cell" colSpan={5}>
                        {error ? error : 'Aun no se han registrado muestras.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                {displayedSamples.length > 0
                  ? `Mostrando ${displayedSamples.length} de ${displayedSamples.length} resultados`
                  : 'Sin resultados'}
              </span>
              {displayedSamples.length > 0 && (
                <div className="pager" aria-label="Paginacion">
                  <button type="button" aria-label="Pagina anterior">&lt;</button>
                  <button type="button" className="active" aria-label="Pagina 1">
                    1
                  </button>
                  <button type="button" aria-label="Pagina 2">2</button>
                  <button type="button" aria-label="Pagina 3">3</button>
                  <button type="button" aria-label="Mas paginas">...</button>
                  <button type="button" aria-label="Pagina 10">10</button>
                  <button type="button" aria-label="Pagina siguiente">&gt;</button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      {isRegisterModalOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-title"
          onClick={closeRegisterModal}
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 id="register-title">Registrar nueva muestra</h3>
              <button
                className="modal-close"
                type="button"
                aria-label="Cerrar formulario"
                onClick={closeRegisterModal}
              >
                ×
              </button>
            </div>
            <form className="sample-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="form-field">
                  <span>Tipo de muestra</span>
                  <select
                    value={formData.sampleType}
                    onChange={handleChange('sampleType')}
                    required
                  >
                    <option value="" disabled hidden>
                      Seleccionar...
                    </option>
                    {sampleTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Nombre/Razón social</span>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={handleChange('businessName')}
                    placeholder="Ingresar nombre"
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Origen</span>
                  <select value={formData.origin} onChange={handleChange('origin')} required>
                    <option value="" disabled hidden>
                      Seleccionar...
                    </option>
                    {origins.map((origin) => (
                      <option key={origin} value={origin}>
                        {origin}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Teléfono de contacto</span>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange('phone')}
                    placeholder="XXX-XXX-XXXX"
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Condiciones de transporte</span>
                  <select
                    value={formData.transportCondition}
                    onChange={handleChange('transportCondition')}
                    required
                  >
                    <option value="" disabled hidden>
                      Seleccionar...
                    </option>
                    {transportConditions.map((condition) => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>Dirección</span>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={handleChange('address')}
                    placeholder="Ingresar dirección"
                    required
                  />
                </label>
                <label className="form-field">
                  <span>Condiciones de almacenamiento</span>
                  <select
                    value={formData.storageCondition}
                    onChange={handleChange('storageCondition')}
                    required
                  >
                    <option value="" disabled hidden>
                      Seleccionar...
                    </option>
                    {storageConditions.map((condition) => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary-button form-submit">
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isDetailModalOpen && selectedSample && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-title"
          onClick={closeDetailModal}
        >
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 id="detail-title">Detalles de la muestra</h3>
              <button
                className="modal-close"
                type="button"
                aria-label="Cerrar detalles"
                onClick={closeDetailModal}
              >
                ×
              </button>
            </div>
            <form className="sample-form" onSubmit={(event) => event.preventDefault()}>
              <div className="form-grid">
                <label className="form-field">
                  <span>Código</span>
                  <input value={selectedSample.code} readOnly />
                </label>
                <label className="form-field">
                  <span>Condiciones de almacenamiento</span>
                  <input value={selectedSample.storageCondition || '—'} readOnly />
                </label>
                <label className="form-field">
                  <span>Tipo de muestra</span>
                  <input value={selectedSample.type || '—'} readOnly />
                </label>
                <label className="form-field">
                  <span>Nombre/Razón social</span>
                  <input value={selectedSample.businessName || '—'} readOnly />
                </label>
                <label className="form-field">
                  <span>Origen</span>
                  <input value={selectedSample.origin || '—'} readOnly />
                </label>
                <label className="form-field">
                  <span>Teléfono de contacto</span>
                  <input value={selectedSample.phone || '—'} readOnly />
                </label>
                <label className="form-field">
                  <span>Condiciones de transporte</span>
                  <input value={selectedSample.transportCondition || '—'} readOnly />
                </label>
                <label className="form-field">
                  <span>Dirección</span>
                  <input value={selectedSample.address || '—'} readOnly />
                </label>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="primary-button form-submit"
                  onClick={closeDetailModal}
                >
                  Regresar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default ReceptionDashboard
