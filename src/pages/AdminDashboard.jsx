import { useMemo, useState, useEffect, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getStoredSupabaseAccessToken } from '../lib/supabaseSession.js'
import '../styles/admin.css'

const buildAreaPath = (series) => {
  if (!series.length) return 'M0,200'
  const width = 640
  const height = 220
  const step = width / Math.max(1, series.length - 1)
  const max = Math.max(...series.map((p) => p.value))
  const min = Math.min(...series.map((p) => p.value))
  const range = max - min || 1

  const line = series
    .map((point, index) => {
      const x = index * step
      const y = height - ((point.value - min) / range) * (height - 30)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return {
    line,
    area: `${line} L${width},${height} L0,${height} Z`,
  }
}

const AdminDashboard = () => {
  const { user, logout, accessToken, loading: authLoading } = useAuth()
  const displayName = user || 'LeBron James'
  const apiUrl = import.meta.env.VITE_API_URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const [metrics, setMetrics] = useState([
    { key: 'received', label: 'Muestras Recibidas', value: 0, trend: 0 },
    { key: 'inProgress', label: 'Muestras en análisis', value: 0, trend: 0 },
    { key: 'evaluated', label: 'Muestras evaluadas', value: 0, trend: 0 },
    { key: 'certified', label: 'Muestras certificadas', value: 0, trend: 0 },
    { key: 'notCertified', label: 'Muestras no certificadas', value: 0, trend: 0 },
  ])
  const [series, setSeries] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [monthsRange, setMonthsRange] = useState(6)
  const [dataRows, setDataRows] = useState([])
  const [profilesMap, setProfilesMap] = useState({})

  const normalizeStatus = (value) => {
    const raw = (value || '').toString().toLowerCase().replace(/[-\s]+/g, '_')
    const map = {
      esperando_analisis: 'pendiente_analisis',
      pendiente_asignacion: 'pendiente_asignacion',
      pendiente_analisis: 'pendiente_analisis',
      en_revision: 'en_revision',
      pendiente_validacion: 'pendiente_validacion',
      evaluada: 'evaluada',
      certificado: 'certificado',
      certificado: 'certificado',
    }
    return map[raw] || raw
  }

  const actorsList = useMemo(() => {
    const seen = new Set()
    const list = []
    dataRows.forEach((row) => {
      const actorId = row.updated_by || row.evaluated_by || row.assigned_analyst_id || row.created_by
      if (!actorId || seen.has(actorId)) return

      const analysisBy = row.analysis_payload?.submitted_by_name || row.analysis_payload?.analyst_name
      const validationBy = row.validation_payload?.submitted_by_name || row.validation_payload?.evaluator_name

      const resolvedName =
        row.updated_by_name ||
        row.evaluated_by_name ||
        row.created_by_name ||
        row.assigned_analyst_name ||
        profilesMap[actorId] ||
        validationBy ||
        analysisBy ||
        `Usuario ${String(actorId).slice(0, 4)}`

      list.push({ id: actorId, name: resolvedName, sample: row.code })
      seen.add(actorId)
    })
    return list
  }, [dataRows, profilesMap])

  const resolveToken = () =>
    accessToken || localStorage.getItem('labguard_access_token') || getStoredSupabaseAccessToken() || ''

  const aggregateMetrics = (rows) => {
    const monthKey = (dateStr) => (dateStr ? dateStr.slice(0, 7) : '')
    const now = new Date()
    const pad = (v) => String(v).padStart(2, '0')
    const currentMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
    const prev = new Date()
    prev.setMonth(now.getMonth() - 1)
    const prevMonth = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`

    const totals = {
      received: rows.length,
      inProgress: 0,
      evaluated: 0,
      certified: 0,
      notCertified: 0,
    }

    const currentCounts = { received: 0, inProgress: 0, evaluated: 0, certified: 0, notCertified: 0 }
    const prevCounts = { received: 0, inProgress: 0, evaluated: 0, certified: 0, notCertified: 0 }

    const computeTrend = (curr, prevValue) => {
      if (!prevValue && curr > 0) return 100
      if (!prevValue) return 0
      return Math.round(((curr - prevValue) / prevValue) * 100)
    }

    rows.forEach((r) => {
      const status = normalizeStatus(r.status)
      const cert = (r.certification_status || '').toLowerCase()
      const key = monthKey(r.received_at || r.created_at)

      const isInProgress =
        status === 'pendiente_asignacion' ||
        status === 'pendiente_analisis' ||
        status === 'en_revision' ||
        status === 'pendiente_validacion'
      const isEvaluated = status === 'evaluada'
      const isCertified = cert === 'recibida'
      const isNotCertified = cert === 'rechazada'

      if (isInProgress) totals.inProgress += 1
      if (isEvaluated) totals.evaluated += 1
      if (isCertified) totals.certified += 1
      if (isNotCertified) totals.notCertified += 1

      const bucket = key === currentMonth ? currentCounts : key === prevMonth ? prevCounts : null
      if (bucket) {
        bucket.received += 1
        if (isInProgress) bucket.inProgress += 1
        if (isEvaluated) bucket.evaluated += 1
        if (isCertified) bucket.certified += 1
        if (isNotCertified) bucket.notCertified += 1
      }
    })

    setMetrics((prevState) =>
      prevState.map((m) => {
        const value = totals[m.key] ?? m.value
        const curr = currentCounts[m.key] ?? 0
        const prevVal = prevCounts[m.key] ?? 0
        const trend = computeTrend(curr, prevVal)
        return { ...m, value, trend }
      }),
    )
  }

  const buildSeries = (rows, count = monthsRange) => {
    const months = (() => {
      const list = []
      const formatter = new Intl.DateTimeFormat('es-ES', { month: 'short' })
      for (let i = count - 1; i >= 0; i -= 1) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        list.push({ key, label: formatter.format(d) })
      }
      return list
    })()

    const bucket = months.reduce((acc, m) => ({ ...acc, [m.key]: 0 }), {})
    rows.forEach((r) => {
      const dateKey = (r.received_at || r.created_at || '').slice(0, 7)
      if (dateKey && bucket[dateKey] !== undefined) {
        bucket[dateKey] += 1
      }
    })
    setSeries(months.map((m) => ({ label: m.label, value: bucket[m.key] || 0 })))
  }

  const buildActivity = (rows, mapOverride = profilesMap) => {
    const palette = ['yellow', 'green', 'purple', 'blue', 'orange']
    const items = [...rows]
      .sort((a, b) => new Date(b.received_at || b.created_at || 0) - new Date(a.received_at || a.created_at || 0))
      .slice(0, 5)
      .map((row, idx) => {
        const status = (row.status || '').toLowerCase()
        const cert = row.certification_status || '—'
        const label = status === 'evaluada' ? `Evaluada • Cert: ${cert}` : `Estado: ${row.status || 'N/D'}`

        // Extrae nombres desde payloads si vienen anidados
        const analysisBy = row.analysis_payload?.submitted_by_name || row.analysis_payload?.analyst_name
        const validationBy = row.validation_payload?.submitted_by_name || row.validation_payload?.evaluator_name
        const actorId = row.updated_by || row.evaluated_by || row.assigned_analyst_id || row.created_by || null
        const resolvedName = (actorId && mapOverride?.[actorId]) || null

        const actor =
          row.updated_by_name ||
          row.evaluated_by_name ||
          row.created_by_name ||
          row.assigned_analyst_name ||
          resolvedName ||
          validationBy ||
          analysisBy ||
          (actorId ? `Usuario ${String(actorId).slice(0, 4)}` : 'Usuario')

        return {
          id: row.id || row.code || idx,
          name: actor,
          action: `${row.code || '—'} · ${label}`,
          badge: row.type || 'Muestra',
          time: new Date(row.received_at || row.created_at || Date.now()).toLocaleString('es-ES', {
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          color: palette[idx % palette.length],
        }
      })
    setActivity(items)
  }

  const fetchProfilesMap = async (rows) => {
    const ids = new Set()
    rows.forEach((r) => {
      ;[r.updated_by, r.evaluated_by, r.assigned_analyst_id, r.created_by].forEach((id) => {
        if (id) ids.add(id)
      })
    })
    if (!ids.size) return {}

    const list = Array.from(ids)
    const idsParam = encodeURIComponent(list.join(','))
    const token = resolveToken()
    if (!token) return {}

    try {
      const res = await fetch(`${apiUrl}/api/admin/profiles?ids=${idsParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        console.warn('Perfil lookup fallo', res.status)
        return {}
      }
      const payload = await res.json()
      const data = payload?.data || []
      const map = {}
      data.forEach((p) => {
        map[p.id] = p.full_name || p.email || p.id
      })
      setProfilesMap(map)
      return map
    } catch (err) {
      console.warn('No se pudo resolver perfiles', err)
      return {}
    }
  }

  const loadSamples = useCallback(async () => {
    const token = resolveToken()
    if (authLoading) return
    if (!token) {
      setInfo('Inicia sesión para ver el dashboard de administrador.')
      return
    }
    setLoading(true)
    setError('')
    setInfo('')
    try {
      const res = await fetch(`${apiUrl}/api/samples`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'No se pudieron cargar las muestras')
      const rows = payload?.data || []
      const map = await fetchProfilesMap(rows)
      setDataRows(rows)
      aggregateMetrics(rows)
      buildSeries(rows)
      buildActivity(rows, map)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las muestras')
    } finally {
      setLoading(false)
    }
  }, [apiUrl, accessToken, authLoading])

  useEffect(() => {
    if (!authLoading) {
      loadSamples()
    }
  }, [loadSamples, authLoading])

  useEffect(() => {
    if (dataRows.length) {
      buildActivity(dataRows, profilesMap)
    }
  }, [profilesMap, dataRows])

  useEffect(() => {
    if (dataRows.length) {
      buildSeries(dataRows, monthsRange)
    }
  }, [monthsRange, dataRows])

  const spark = useMemo(() => buildAreaPath(series), [series])

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
          <NavLink to="/admin/crear-usuario" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            Crear Usuario
          </NavLink>
          <NavLink to="/admin/roles" className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            Gestionar Roles
          </NavLink>
        </nav>

        {error && <div className="alert error">{error}</div>}
        {info && !error && <div className="alert info">{info}</div>}
        {loading && <div className="alert info">Cargando datos...</div>}

        <section className="admin-metrics">
          {metrics.map((metric) => {
            const trendClass = metric.trend >= 0 ? 'trend up' : 'trend down'
            const trendSymbol = metric.trend > 0 ? '+' : ''
            return (
              <article className="admin-card" key={metric.key}>
                <p>{metric.label}</p>
                <strong>{metric.value.toLocaleString('es-ES')}</strong>
                <span className={trendClass}>
                  {trendSymbol}
                  {metric.trend}%
                </span>
              </article>
            )
          })}
        </section>

        <div className="admin-grid">
          <section className="admin-chart">
            <header className="chart-head">
              <div>
                <p className="chart-title">Tendencia de Muestras Registradas</p>
                <strong>Volumen de muestras analizadas</strong>
              </div>
            </header>
            <div className="chart-visual">
              <svg viewBox="0 0 640 240" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="adminGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2e6bff" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#2e6bff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={spark.area} fill="url(#adminGrad)" />
                <path d={spark.line} fill="none" stroke="#2e6bff" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </div>
          </section>

          <section className="admin-activity">
            <header className="activity-head">Actividad Reciente</header>
            {actorsList.length > 0 && (
              <div className="alert info" style={{ margin: '8px 0' }}>
                <strong>Ayuda para nombres:</strong>{' '}
                {actorsList.map((a) => `${a.id.slice(0, 8)}… ⇒ ${a.name}`).join(' · ')}
              </div>
            )}
            <div className="activity-list">
              {activity.map((item) => (
                <article className="activity-item" key={item.id}>
                  <div className={`avatar avatar-${item.color}`}>{item.name?.slice(0, 2).toUpperCase()}</div>
                  <div className="activity-meta">
                    <div className="activity-row">
                      <strong>{item.name}</strong>
                      <span className="activity-time">{item.time}</span>
                    </div>
                    <p className="activity-action">{item.action}</p>
                    <span className="badge">{item.badge}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}

export default AdminDashboard
