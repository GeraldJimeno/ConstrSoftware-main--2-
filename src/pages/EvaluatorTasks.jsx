import { useEffect, useMemo, useState, useCallback } from 'react'
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
}

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

const EvaluatorTasks = () => {
  const { user, accessToken, role, logout, loading: authLoading } = useAuth()
    const displayName = user || 'Dr. Faustom 3FN'
  const [allSamples, setAllSamples] = useState([])
  const [analystsMap, setAnalystsMap] = useState({})
  const [analysts, setAnalysts] = useState([])
  const [toAssign, setToAssign] = useState([])
  const [waiting, setWaiting] = useState([])
  const [pendingValidation, setPendingValidation] = useState([])
  const [evaluated, setEvaluated] = useState([])
  const [selected, setSelected] = useState(null)
  const [modalMode, setModalMode] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedAnalyst, setSelectedAnalyst] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [certStatus, setCertStatus] = useState('recibida')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const apiUrl = import.meta.env.VITE_API_URL

  const normalizeSample = (row) => {
    const status = normalizeStatus(row.status)
    const analystName = row.assigned_analyst_id ? analystsMap[row.assigned_analyst_id] : null
    // Merge analysis + validation payloads so meta fields are kept after validación
    const mergedPayload = {
      ...(row.analysis_payload || {}),
      ...(row.validation_payload || {}),
    }
    const payload = Object.keys(mergedPayload).length ? mergedPayload : {}
    return {
      id: row.id || row.code,
      code: row.code,
      type: row.type,
      status,
      analystId: row.assigned_analyst_id,
      analyst: analystName,
      dueDate: row.due_date?.slice(0, 10) || '',
      certification: row.certification_status || null,
      certified: row.certification_status
        ? row.certification_status.toLowerCase() === 'recibida'
        : null,
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

  useEffect(() => {
    if (authLoading) return
    if (!accessToken) {
      setInfo('Inicia sesión para ver tus tareas.')
      setAllSamples([])
      setToAssign([])
      setWaiting([])
      setPendingValidation([])
      setEvaluated([])
      return
    }

    const loadAnalysts = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/analysts`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        const payload = await res.json()
        if (!res.ok) return
        const map = {}
        const list = payload?.data || []
        list.forEach((row) => {
          map[row.id] = row.full_name
        })
        setAnalystsMap(map)
        setAnalysts(list)
      } catch (err) {
        console.warn('No se pudieron cargar analistas', err)
      }
    }

    loadAnalysts()
  }, [accessToken, role])

  const loadSamples = useCallback(async () => {
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
      if (!res.ok) {
        throw new Error(payload?.error || 'No se pudieron cargar las muestras')
      }
      setAllSamples(payload?.data || [])
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las muestras')
    } finally {
      setLoading(false)
    }
  }, [accessToken, apiUrl, role, authLoading])

  useEffect(() => {
    loadSamples()
  }, [loadSamples, authLoading])

  useEffect(() => {
    if (!allSamples.length) {
      setToAssign([])
      setWaiting([])
      setPendingValidation([])
      setEvaluated([])
      return
    }

    const mapped = allSamples.map((row) => normalizeSample(row))
    setToAssign(mapped.filter((row) => row.status === 'por_asignar'))
    setWaiting(mapped.filter((row) => row.status === 'esperando_analisis'))
    setPendingValidation(mapped.filter((row) => row.status === 'pendiente_validacion'))
    setEvaluated(mapped.filter((row) => row.status === 'evaluada'))
  }, [allSamples, analystsMap])

  const formatDateTime = (value) => {
    if (!value) return ''
    const date = new Date(value)
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const resolveToken = () => {
    if (accessToken) return accessToken
    const stored = localStorage.getItem('labguard_access_token') || getStoredSupabaseAccessToken()
    return stored || ''
  }

  const generatePdf = async (item) => {
    const token = resolveToken()
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${apiUrl}/api/samples/${item.id}/pdf`, { headers })
      if (!res.ok) {
        throw new Error('No se pudo generar el PDF')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer,width=900,height=1200')
    } catch (err) {
      setError(err.message || 'No se pudo generar el PDF')
    }
  }

  const openAssign = (item) => {
    setSelected(item)
    setSelectedAnalyst('')
    setDueDate('')
    setModalMode('assign')
    setShowModal(true)
  }

  const openDetails = (item) => {
    setSelected(item)
    setModalMode('detail')
    setShowModal(true)
  }

  const openValidate = (item) => {
    setSelected(item)
    setCertStatus('recibida')
    setModalMode('validate')
    setShowModal(true)
  }

  const closeDetails = () => {
    setShowModal(false)
    setSelected(null)
    setModalMode(null)
  }

  const submitAssign = async (event) => {
    event.preventDefault()
    if (!selected || !selectedAnalyst || !dueDate) return
    setActionLoading(true)
    setError('')
    try {
      const res = await fetch(`${apiUrl}/api/samples/${selected.id}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ analyst_id: selectedAnalyst, due_date: dueDate }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || 'No se pudo asignar la muestra')
      }
      await loadSamples()
      setShowModal(false)
      setSelected(null)
      setModalMode(null)
    } catch (err) {
      setError(err.message || 'No se pudo asignar la muestra')
    } finally {
      setActionLoading(false)
    }
  }

  const submitValidate = async (event) => {
    event.preventDefault()
    if (!selected) return
    setActionLoading(true)
    setError('')
    try {
      const validationPayload = {
        results: selected.detail?.results || [],
      }
      const res = await fetch(`${apiUrl}/api/samples/${selected.id}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ validation_payload: validationPayload, certification_status: certStatus }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || 'No se pudo validar la muestra')
      }
      await loadSamples()
      setShowModal(false)
      setSelected(null)
      setModalMode(null)
    } catch (err) {
      setError(err.message || 'No se pudo validar la muestra')
    } finally {
      setActionLoading(false)
    }
  }

  const statusGroups = useMemo(
    () => [
      { key: 'toAssign', title: 'POR ASIGNAR', accent: 'blue', data: toAssign, onAssign: openAssign },
      { key: 'waiting', title: 'ESPERANDO ANÁLISIS', accent: 'orange', data: waiting },
      { key: 'pending', title: 'PENDIENTE DE VALIDACIÓN', accent: 'yellow', data: pendingValidation },
      { key: 'evaluated', title: 'EVALUADAS', accent: 'green', data: evaluated },
    ],
    [evaluated, pendingValidation, toAssign, waiting]
  )

  return (
    <section className="evaluator-body">
      <div className="evaluator-shell">
        <header className="evaluator-bar">
          <div className="evaluator-heading">
            <h1>Panel del Evaluador</h1>
            <p className="evaluator-greeting">
              Hola, <span className="evaluator-link">{displayName}</span>
            </p>
          </div>
          <div className="evaluator-actions">
            <button className="evaluator-bell" type="button" aria-label="Ver notificaciones">
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
            Busqueda
          </NavLink>
        </nav>

        <section className="eval-tasks">
          {error && <div className="alert error">{error}</div>}
          {info && !error && <div className="alert info">{info}</div>}
          {loading && <div className="alert info">Cargando muestras...</div>}
          {statusGroups.map((group) => (
            <div className="eval-section" key={group.key}>
              <div className="eval-section__title">
                <span className={`dot dot-${group.accent}`} aria-hidden="true" />
                <h3>{group.title}</h3>
              </div>
              <div className="eval-cards">
                {group.data.map((item) => (
                  <article
                    key={item.id}
                    className={`eval-card is-${group.accent}`}
                    aria-label={`${group.title} ${item.code}`}
                  >
                    <div className="eval-card__meta">
                      <p>Código</p>
                      <strong>{item.code}</strong>
                      <p>Tipo</p>
                      <span>{item.type}</span>
                      {item.analyst && (
                        <>
                          <p>Analista</p>
                          <span className="eval-card__analyst">{item.analyst}</span>
                          {item.dueDate && (
                            <>
                              <p>Fecha límite</p>
                              <span className="eval-card__due">{item.dueDate}</span>
                            </>
                          )}
                        </>
                      )}
                      {group.key === 'evaluated' && (
                        <>
                          <p>Certificación</p>
                          <span className={item.certified ? 'eval-status ok' : 'eval-status bad'}>
                            {item.certification}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="eval-card__actions">
                      <button className="btn ghost" type="button" onClick={() => openDetails(item)}>
                        Ver Detalles
                      </button>
                      {group.onAssign && (
                        <button className="btn primary" type="button" onClick={() => group.onAssign(item)}>
                          Asignar
                        </button>
                      )}
                      {group.key === 'pending' && (
                        <button className="btn primary" type="button" onClick={() => openValidate(item)}>
                          Validar
                        </button>
                      )}
                      {group.key === 'evaluated' && (
                        <button
                          className="btn primary"
                          type="button"
                          onClick={() => generatePdf(item)}
                          disabled={item.certification?.toLowerCase() === 'rechazada'}
                        >
                          Generar PDF
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {group.data.length === 0 && <div className="eval-empty">Sin elementos</div>}
              </div>
            </div>
          ))}
        </section>
      </div>

      {showModal && selected && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card eval-modal">
            <header className="modal-header">
              <h3>
                {modalMode === 'assign'
                  ? 'Asignar analista'
                  : modalMode === 'validate'
                    ? 'Validar muestra'
                    : 'Detalles de la muestra'}
              </h3>
              <button className="modal-close" type="button" onClick={closeDetails} aria-label="Cerrar">
                ×
              </button>
            </header>

            {modalMode === 'assign' ? (
              <form className="eval-form" onSubmit={submitAssign}>
                <div className="form-field">
                  <label htmlFor="analyst">Analista</label>
                  <select
                    id="analyst"
                    value={selectedAnalyst}
                    onChange={(e) => setSelectedAnalyst(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {analysts.map((analyst) => (
                      <option key={analyst.id} value={analyst.id}>
                        {analyst.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="dueDate">Fecha límite</label>
                  <input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="modal-footer">
                  <button className="btn primary" type="submit" disabled={actionLoading}>
                    {actionLoading ? 'Asignando...' : 'Asignar'}
                  </button>
                </div>
              </form>
            ) : modalMode === 'validate' ? (
              <form className="eval-form" onSubmit={submitValidate}>
                <div className="form-field">
                  <label htmlFor="certStatus">Estatus de certificación</label>
                  <select
                    id="certStatus"
                    value={certStatus}
                    onChange={(e) => setCertStatus(e.target.value)}
                  >
                    <option value="recibida">Recibida</option>
                    <option value="rechazada">Rechazada</option>
                  </select>
                </div>
                <div className="modal-footer">
                  <button className="btn primary" type="submit" disabled={actionLoading}>
                    {actionLoading ? 'Validando...' : 'Validar'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="modal-body">
                <div className="detail-grid">
                  <div className="detail-field">
                    <label>Código</label>
                    <input value={selected.code} disabled />
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
                    <label>Dirección</label>
                    <input value={selected.detail?.address || ''} disabled />
                  </div>
                  <div className="detail-field">
                    <label>Condiciones de transporte</label>
                    <input value={selected.detail?.transportCondition || ''} disabled />
                  </div>
                  <div className="detail-field">
                    <label>Condiciones de almacenamiento</label>
                    <input value={selected.detail?.storageCondition || ''} disabled />
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
                  <button className="btn ghost" type="button" onClick={closeDetails}>Regresar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export default EvaluatorTasks
