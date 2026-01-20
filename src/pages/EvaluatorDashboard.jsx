import { useMemo, useEffect, useState, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getStoredSupabaseAccessToken } from '../lib/supabaseSession.js'

const buildSparkPath = (series) => {
  if (!series.length) return 'M0,240'
  const max = Math.max(...series.map((p) => p.value))
  const min = Math.min(...series.map((p) => p.value))
  const range = max - min || 1
  const width = 720
  const height = 240
  const step = width / Math.max(1, series.length - 1)
  return series
    .map((point, index) => {
      const x = index * step
      const y = height - ((point.value - min) / range) * (height - 20)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

const getLastMonths = (count) => {
  const months = []
  const formatter = new Intl.DateTimeFormat('es-ES', { month: 'short' })
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ key, label: formatter.format(d) })
  }
  return months
}

const EvaluatorDashboard = () => {
  const { user, logout, accessToken, loading: authLoading } = useAuth()
  const apiUrl = import.meta.env.VITE_API_URL
  const displayName = user || 'Dr. Faustom 3FN'
  const [metrics, setMetrics] = useState([
    { key: 'assigned', label: 'Número de muestras asignadas', value: 0, trend: 0 },
    { key: 'pending', label: 'Muestras pendientes de evaluación', value: 0, trend: 0 },
    { key: 'certified', label: 'Muestras certificadas', value: 0, trend: 0 },
    { key: 'rejected', label: 'Muestras rechazadas', value: 0, trend: 0 },
  ])
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const resolveToken = () => accessToken || localStorage.getItem('labguard_access_token') || getStoredSupabaseAccessToken() || ''

  const aggregateMetrics = (rows) => {
    const monthKey = (dateStr) => (dateStr ? dateStr.slice(0, 7) : '')
    const now = new Date()
    const pad = (v) => String(v).padStart(2, '0')
    const currentMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
    const prev = new Date()
    prev.setMonth(now.getMonth() - 1)
    const prevMonth = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`

    const totals = { assigned: 0, pending: 0, certified: 0, rejected: 0 }
    const currentCounts = { ...totals }
    const prevCounts = { ...totals }

    const trend = (curr, prevVal) => {
      if (!prevVal && curr > 0) return 100
      if (!prevVal) return 0
      return Math.round(((curr - prevVal) / prevVal) * 100)
    }

    rows.forEach((r) => {
      const status = (r.status || '').toLowerCase()
      const cert = (r.certification_status || '').toLowerCase()
      const key = monthKey(r.received_at || r.created_at)

      const isAssigned = !!r.assigned_analyst_id
      const isPending = status === 'pendiente_validacion'
      const isCertified = cert === 'recibida'
      const isRejected = cert === 'rechazada'

      if (isAssigned) totals.assigned += 1
      if (isPending) totals.pending += 1
      if (isCertified) totals.certified += 1
      if (isRejected) totals.rejected += 1

      const bucket = key === currentMonth ? currentCounts : key === prevMonth ? prevCounts : null
      if (bucket) {
        if (isAssigned) bucket.assigned += 1
        if (isPending) bucket.pending += 1
        if (isCertified) bucket.certified += 1
        if (isRejected) bucket.rejected += 1
      }
    })

    setMetrics((prevState) =>
      prevState.map((m) => {
        const value = totals[m.key] ?? m.value
        const curr = currentCounts[m.key] ?? 0
        const prevVal = prevCounts[m.key] ?? 0
        return { ...m, value, trend: trend(curr, prevVal) }
      }),
    )
  }

  const buildSeries = (rows) => {
    const months = getLastMonths(6)
    const bucket = months.reduce((acc, m) => ({ ...acc, [m.key]: 0 }), {})
    rows.forEach((r) => {
      const dateKey = (r.received_at || r.created_at || '').slice(0, 7)
      if (dateKey && bucket[dateKey] !== undefined) {
        bucket[dateKey] += 1
      }
    })
    const data = months.map((m) => ({ label: m.label, value: bucket[m.key] || 0 }))
    setSeries(data)
  }

  const loadSamples = useCallback(async () => {
    const token = resolveToken()
    if (authLoading) return
    if (!token) {
      setInfo('Inicia sesión para ver el dashboard.')
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
      aggregateMetrics(rows)
      buildSeries(rows)
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

  const sparkPath = useMemo(() => buildSparkPath(series), [series])
  const assignedMetric = metrics.find((m) => m.key === 'assigned') || { value: 0, trend: 0 }
  const chartTrendLabel = `${assignedMetric.trend > 0 ? '+' : ''}${assignedMetric.trend}%`
  const chartTrendClass = assignedMetric.trend >= 0 ? 'chart-trend up' : 'chart-trend down'

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

        <section className="evaluator-section">
          <header className="evaluator-section__header">
            <h3>Dashboard Estadístico</h3>
          </header>
          {error && <div className="alert error">{error}</div>}
          {info && !error && <div className="alert info">{info}</div>}
          {loading && <div className="alert info">Cargando datos...</div>}
          <div className="evaluator-metrics">
            {metrics.map((metric) => {
              const trendClass = metric.trend >= 0 ? 'trend up' : 'trend down'
              const trendSymbol = metric.trend > 0 ? '+' : ''
              const accentClass = metric.key === 'rejected' ? ' is-accent' : ''
              return (
                <article className={`evaluator-card${accentClass}`} key={metric.key}>
                  <p>{metric.label}</p>
                  <strong>{metric.value.toLocaleString('es-ES')}</strong>
                  <span className={trendClass}>
                    {trendSymbol}
                    {metric.trend}%
                  </span>
                </article>
              )
            })}
          </div>
        </section>

        <section className="evaluator-chart-card">
          <header className="chart-header">
            <div>
              <h4>Tendencia en el análisis de muestras a lo largo del tiempo</h4>
              <div className="chart-summary">
                <strong>{assignedMetric.value.toLocaleString('es-ES')}</strong>
                <span>
                  Últimos 6 meses <span className={chartTrendClass}>{chartTrendLabel}</span>
                </span>
              </div>
            </div>
          </header>
          <div className="chart-shell" role="img" aria-label="Tendencia de muestras registradas">
            <svg viewBox="0 0 720 260" preserveAspectRatio="none">
              <defs>
                <linearGradient id="evalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2e6bff" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#2e6bff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${sparkPath} L720,260 L0,260 Z`} fill="url(#evalGradient)" />
              <path d={sparkPath} fill="none" stroke="#2e6bff" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </div>
        </section>
      </div>
    </section>
  )
}

export default EvaluatorDashboard
