import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import EmailConfirmed from './pages/EmailConfirmed.jsx'
import PendingApproval from './pages/PendingApproval.jsx'
import ReceptionDashboard from './pages/ReceptionDashboard.jsx'
import AnalystDashboard from './pages/AnalystDashboard.jsx'
import AnalystTasks from './pages/AnalystTasks.jsx'
import EvaluatorDashboard from './pages/EvaluatorDashboard.jsx'
import EvaluatorTasks from './pages/EvaluatorTasks.jsx'
import EvaluatorSearch from './pages/EvaluatorSearch.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminUsers from './pages/AdminUsers.jsx'
import AdminCreateUser from './pages/AdminCreateUser.jsx'
import AdminRoles from './pages/AdminRoles.jsx'

function App() {
  const { user, role, loading, error, logout } = useAuth()
  const location = useLocation()
  const errorMessage = typeof error === 'string' ? error : error?.message

  // Normaliza los slugs de rol que vienen de la BD a los usados en el router
  const normalizeRole = (value) => {
    if (!value) return null
    switch (value) {
      case 'admin':
        return 'admin'
      case 'recepcionista':
      case 'recepcion':
        return 'recepcion'
      case 'analista':
      case 'analyst':
        return 'analyst'
      case 'evaluador':
      case 'evaluator':
        return 'evaluator'
      default:
        return value
    }
  }

  const normalizedRole = normalizeRole(role)

  if (loading) {
    return (
      <div className="app-surface">
        <div className="app-header">
          <div className="app-brand">
            <span className="app-eyebrow">LabGuard Systems</span>
            <h1>Cargando...</h1>
            <p>Validando tu acceso al portal.</p>
            {errorMessage ? <p>{errorMessage}</p> : null}
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-surface">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/confirmado" element={<EmailConfirmed />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    )
  }

  if (user && !role) {
    if (location.pathname === '/confirmado') {
      return (
        <div className="app-surface">
          <Routes>
            <Route path="/confirmado" element={<EmailConfirmed />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      )
    }
    return <PendingApproval onLogout={logout} />
  }

  const allLinks = [
    { to: '/recepcion', label: 'Recepcion', roles: ['recepcion'] },
    { to: '/analista', label: 'Panel del analista', roles: ['analyst'] },
    { to: '/evaluador', label: 'Panel del evaluador', roles: ['evaluator'] },
    { to: '/admin', label: 'Panel del administrador', roles: ['admin'] },
  ]

  const links = normalizedRole === 'admin'
    ? allLinks.filter((link) => link.roles.includes('admin'))
    : allLinks.filter((link) => link.roles.includes(normalizedRole))

  const isReceptionRoute = location.pathname.startsWith('/recepcion')
  const isEvaluatorRoute = location.pathname.startsWith('/evaluador')
  const isAdminRoute = location.pathname.startsWith('/admin')
  const isAnalystRoute = location.pathname.startsWith('/analista')

  return (
    <div className="app-surface">
      {!isReceptionRoute && !isEvaluatorRoute && !isAdminRoute && !isAnalystRoute && (
        <header className="app-header">
          <div className="app-brand">
            <span className="app-eyebrow">LabGuard Systems</span>
            <h1>Portal Operativo</h1>
            <p>Controla el acceso y seguimiento de muestras desde un solo lugar.</p>
          </div>
          <nav className="app-nav" aria-label="Secciones principales">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `app-nav__link${isActive ? ' is-active' : ''}`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {normalizedRole !== 'admin' ? (
              <button onClick={logout} className="logout-btn">
                Cerrar sesion
              </button>
            ) : null}
          </nav>
        </header>
      )}
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={
                normalizedRole === 'recepcion'
                  ? '/recepcion'
                  : normalizedRole === 'analyst'
                    ? '/analista'
                    : normalizedRole === 'evaluator'
                      ? '/evaluador'
                      : normalizedRole === 'admin'
                        ? '/admin'
                        : '/'
              }
            />
          }
        />
        <Route
          path="/recepcion"
          element={normalizedRole === 'admin' || normalizedRole === 'recepcion' ? <ReceptionDashboard /> : <Navigate to="/" />}
        />
        <Route
          path="/analista"
          element={normalizedRole === 'admin' || normalizedRole === 'analyst' ? <AnalystDashboard /> : <Navigate to="/" />}
        />
        <Route
          path="/analista/tareas"
          element={normalizedRole === 'admin' || normalizedRole === 'analyst' ? <AnalystTasks /> : <Navigate to="/" />}
        />
        <Route
          path="/evaluador"
          element={normalizedRole === 'admin' || normalizedRole === 'evaluator' ? <EvaluatorDashboard /> : <Navigate to="/" />}
        />
        <Route
          path="/evaluador/tareas"
          element={normalizedRole === 'admin' || normalizedRole === 'evaluator' ? <EvaluatorTasks /> : <Navigate to="/" />}
        />
        <Route
          path="/evaluador/busqueda"
          element={normalizedRole === 'admin' || normalizedRole === 'evaluator' ? <EvaluatorSearch /> : <Navigate to="/" />}
        />
        <Route path="/admin" element={normalizedRole === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
        <Route path="/admin/usuarios" element={normalizedRole === 'admin' ? <AdminUsers /> : <Navigate to="/" />} />
        <Route path="/admin/crear-usuario" element={normalizedRole === 'admin' ? <AdminCreateUser /> : <Navigate to="/" />} />
        <Route path="/admin/roles" element={normalizedRole === 'admin' ? <AdminRoles /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  )
}

export default App
