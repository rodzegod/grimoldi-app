import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const ROL_HOME = {
  vendedor: '/vendedor/tareas',
  encargado: '/encargado/tareas',
  supervisor: '/supervisor/dashboard',
  admin: '/admin/catalogo',
}

export default function Login() {
  const { signIn, usuario, usuarioError, signOut } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError('Email o contraseña incorrectos')
    }
  }

  // Redirigir cuando el perfil ya cargó
  if (usuario) {
    const home = ROL_HOME[usuario.rol] ?? '/login'
    navigate(home, { replace: true })
    return null
  }

  // Usuario en Auth pero sin perfil en tabla usuarios (setup incompleto)
  if (usuarioError) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <p className="text-white font-bold text-lg mb-2">Perfil incompleto</p>
        <p className="text-gray-400 text-sm mb-6 max-w-xs">
          Tu cuenta fue creada pero no tiene perfil asignado en este local.
          Pedile al admin que ejecute el setup de Supabase.
        </p>
        <button
          onClick={signOut}
          className="text-gray-400 text-sm border border-gray-700 rounded-lg px-4 py-2 hover:border-white hover:text-white transition"
        >
          Cerrar sesión
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-white text-4xl font-black tracking-widest uppercase">VANS</h1>
          <p className="text-gray-400 text-sm mt-1">Gestión de Local · Parque Brown</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-white placeholder-gray-500"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-white placeholder-gray-500"
          />

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-bold rounded-lg py-3 text-sm uppercase tracking-wide hover:bg-gray-100 disabled:opacity-50 transition"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
