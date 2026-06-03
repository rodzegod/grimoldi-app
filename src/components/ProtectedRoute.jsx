import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function ProtectedRoute({ children, roles }) {
  const { session, usuario, usuarioError } = useAuth()

  if (session === undefined) return <Spinner />
  if (!session) return <Navigate to="/login" replace />

  // Usuario en Auth pero sin perfil: redirigir a login donde se muestra el mensaje
  if (usuarioError) return <Navigate to="/login" replace />

  // Perfil cargando
  if (!usuario) return <Spinner />

  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to="/no-autorizado" replace />
  }

  return children
}
