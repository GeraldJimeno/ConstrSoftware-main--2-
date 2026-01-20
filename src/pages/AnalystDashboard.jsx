import { useMemo, useState, useEffect, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getStoredSupabaseAccessToken } from '../lib/supabaseSession.js'

const generateSparkline = (series) => {
  if (!series.length) return 'M0,80'
  const max = Math.max(...series.map((point) => point.value))
  const min = Math.min(...series.map((point) => point.value))
  const range = max - min || 1
  const widthStep = 350 / Math.max(1, series.length - 1)
  return series
    .map((point, index) => {
      const normalized = 80 - ((point.value - min) / range) * 70
      const x = index * widthStep
      return `${index === 0 ? 'M' : 'L'}${x},${normalized.toFixed(2)}`
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

const normalizeStatus = (value) => {
  const raw = (value || '').toString().toLowerCase().replace(/[-\s]+/g, '_')
  const map = {
    pendiente_validacion: 'pendiente_validacion',
    esperando_validacion: 'pendiente_validacion',
    validacion_pendiente: 'pendiente_validacion',
    en_revision: 'en_revision',
    esperando_revision: 'en_revision',
    pendiente_asignacion: 'pendiente_asignacion',
    pendiente_analisis: 'pendiente_analisis',
    esperando_analisis: 'pendiente_analisis',
    evaluada: 'evaluada',
    evaluado: 'evaluada',
    certificado: 'certificado',
  }
  return map[raw] || raw
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

const AnalystDashboard = () => {
  const { user, logout, accessToken, profile, loading: authLoading } = useAuth()
  const displayName = user || 'Analista'
  const apiUrl = import.meta.env.VITE_API_URL
  const [metrics, setMetrics] = useState([
    { key: 'analyzed', label: 'Numero de muestras analizadas', value: 0, trend: 0 },
    { key: 'pending', label: 'Muestras pendientes de validacion', value: 0, trend: 0 },
    { key: 'completed', label: 'Muestras completadas', value: 0, trend: 0 },
    { key: 'rejected', label: 'Muestras rechazadas', value: 0, trend: 0 },
  ])
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [monthsRange, setMonthsRange] = useState(6)
  const [dataRows, setDataRows] = useState([])

  const resolveToken = () =>
    accessToken || localStorage.getItem('labguard_access_token') || getStoredSupabaseAccessToken() || ''
  const resolveAnalystId = () => normalizeId(profile?.id || profile?.user_id || user?.id)

  const aggregateMetrics = (rows) => {
    const monthKey = (dateStr) => (dateStr ? dateStr.slice(0, 7) : '')
    const now = new Date()
    const pad = (v) => String(v).padStart(2, '0')
    const currentMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
    const prev = new Date()
    prev.setMonth(now.getMonth() - 1)
    const prevMonth = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`

    const totals = { analyzed: 0, pending: 0, completed: 0, rejected: 0 }
    const currentCounts = { ...totals }
    const prevCounts = { ...totals }

    const trend = (curr, prevVal) => {
      if (!prevVal && curr > 0) return 100
      if (!prevVal) return 0
      return Math.round(((curr - prevVal) / prevVal) * 100)
    }

    rows.forEach((r) => {
      const normalized = normalizeStatus(r.status)
      const cert = (r.certification_status || '').toLowerCase()
      const key = monthKey(r.received_at || r.created_at)

      const isPending =
        normalized === 'pendiente_asignacion' ||
        normalized === 'pendiente_analisis' ||
        normalized === 'en_revision' ||
        normalized === 'pendiente_validacion'

      const isAnalyzed =
        !!r.analysis_payload ||
        normalized === 'en_revision' ||
        normalized === 'pendiente_validacion' ||
        normalized === 'evaluada' ||
        normalized === 'certificado'

      const isCompleted = normalized === 'evaluada' || normalized === 'certificado' || cert === 'recibida'
      const isRejected = cert === 'rechazada'

      if (isAnalyzed) totals.analyzed += 1
      if (isPending) totals.pending += 1
      if (isCompleted) totals.completed += 1
      if (isRejected) totals.rejected += 1

      const bucket = key === currentMonth ? currentCounts : key === prevMonth ? prevCounts : null
      if (bucket) {
        if (isAnalyzed) bucket.analyzed += 1
        if (isPending) bucket.pending += 1
        if (isCompleted) bucket.completed += 1
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

  const buildSeries = (rows, count = monthsRange) => {
    const months = getLastMonths(count)
    const bucket = months.reduce((acc, m) => ({ ...acc, [m.key]: 0 }), {})
    rows.forEach((r) => {
      const dateKey = (r.received_at || r.created_at || '').slice(0, 7)
      if (dateKey && bucket[dateKey] !== undefined) {
        bucket[dateKey] += 1
      }
    })
    setSeries(months.map((m) => ({ label: m.label, value: bucket[m.key] || 0 })))
  }

  const loadSamples = useCallback(async () => {
    const token = resolveToken()
    const analystId = resolveAnalystId()
    if (authLoading) return
    if (!token || !analystId) {
      if (!token) setError('Inicia sesión para ver tu dashboard.')
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
      const allRows = payload?.data || []
      const assignedRows = allRows.filter((r) => resolveRowAnalystId(r) === normalizeId(analystId))
      if (!assignedRows.length && allRows.length) {
        setInfo('Mostrando datos generales porque no hay muestras asignadas a tu usuario.')
      } else if (assignedRows.length && assignedRows.length < allRows.length) {
        setInfo(`Mostrando todas las muestras. Asignadas a ti: ${assignedRows.length}.`)
      }

      setDataRows(allRows)
      aggregateMetrics(allRows)
      buildSeries(allRows)
      if (!allRows.length) {
        setSeries([])
      }
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las muestras')
    } finally {
      setLoading(false)
    }
  }, [apiUrl, accessToken, profile, user, authLoading])

  useEffect(() => {
    if (!authLoading) {
      loadSamples()
    }
  }, [loadSamples, authLoading])

  useEffect(() => {
    if (dataRows.length) {
      buildSeries(dataRows, monthsRange)
    }
  }, [monthsRange, dataRows])

  const sparkPath = useMemo(() => generateSparkline(series), [series])
  const analyzedTrend = useMemo(() => metrics.find((m) => m.key === 'analyzed')?.trend || 0, [metrics])

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
          <div className="analyst-actions">
            <button className="analyst-bell" type="button" aria-label="Ver notificaciones">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
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
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M16 3.5h4.5V8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8 20.5H3.5V16" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <path d="m20.5 3.5-6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                <path d="m3.5 20.5 6-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Cerrar Sesión
            </button>
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

        <h3 className="analyst-section-title">Dashboard Estadístico</h3>

        {error && <div className="alert error">{error}</div>}
        {info && !error && <div className="alert info">{info}</div>}
        {loading && <div className="alert info">Cargando datos...</div>}

        <section className="analyst-grid">
          {metrics.map((metric) => (
            <article className="analyst-card" key={metric.key}>
              <p>{metric.label}</p>
              <strong>{metric.value.toLocaleString('es-ES')}</strong>
              <span className={`trend ${metric.trend >= 0 ? 'up' : 'down'}`}>
                {metric.trend > 0 ? '+' : ''}
                {metric.trend}%
              </span>
            </article>
          ))}
        </section>

        <section className="analyst-chart">
          <header>
            <div>
              <p>Tendencia en el análisis de muestras a lo largo del tiempo</p>
              <strong>{series.reduce((acc, p) => acc + p.value, 0)}</strong>
              <span className="chart-subtext">
                Últimos {monthsRange} meses
                <em className={analyzedTrend >= 0 ? 'trend up' : 'trend down'}>
                  {analyzedTrend > 0 ? ` +${analyzedTrend}%` : analyzedTrend < 0 ? ` ${analyzedTrend}%` : ''}
                </em>
              </span>
            </div>
            <select
              aria-label="Seleccionar rango temporal"
              value={monthsRange}
              onChange={(e) => setMonthsRange(Number(e.target.value) || 6)}
            >
              <option value={6}>6 meses</option>
              <option value={12}>12 meses</option>
              <option value={24}>24 meses</option>
            </select>
          </header>
          <svg viewBox="0 0 360 80" preserveAspectRatio="none" aria-hidden="true">
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3f82ff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#3f82ff" stopOpacity="0" />
            </linearGradient>
            <path
              d={`${sparkPath} L360,80 L0,80 Z`}
              fill="url(#chartGradient)"
              stroke="none"
            />
            <path d={sparkPath} fill="none" stroke="#2763ff" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </section>
      </div>
    </section>
  )
}

export default AnalystDashboard
