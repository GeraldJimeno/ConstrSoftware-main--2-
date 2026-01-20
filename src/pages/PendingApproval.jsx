import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const PendingApproval = ({ onLogout }) => {
  const navigate = useNavigate()

  useEffect(() => {
    const signOutAndRedirect = async () => {
      await onLogout()
      navigate('/', { replace: true, state: { pendingApproval: true } })
    }
    signOutAndRedirect()
  }, [navigate, onLogout])

  return (
    <div className="app-surface">
      <div className="app-header">
        <div className="app-brand">
          <span className="app-eyebrow">LabGuard Systems</span>
          <h1>Redirigiendo...</h1>
          <p>Tu cuenta aun no tiene rol asignado.</p>
        </div>
      </div>
    </div>
  )
}

export default PendingApproval
