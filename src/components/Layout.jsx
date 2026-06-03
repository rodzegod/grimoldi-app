import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLocal } from '../hooks/useLocal'

const NAV = {
  vendedor: [
    { to: '/vendedor/tareas', label: 'Mis Tareas', icon: '✓' },
    { to: '/vendedor/incidencias/nueva', label: 'Reportar', icon: '+' },
    { to: '/vendedor/incidencias', label: 'Mis Reportes', icon: '!' },
    { to: '/vendedor/mapa', label: 'Mapa', icon: '⊞' },
  ],
  encargado: [
    { to: '/encargado/tareas', label: 'Tareas', icon: '✓' },
    { to: '/encargado/incidencias', label: 'Incidencias', icon: '!' },
    { to: '/encargado/historial', label: 'Historial', icon: '↺' },
    { to: '/encargado/zonas', label: 'Zonas', icon: '⊞' },
  ],
  supervisor: [
    { to: '/supervisor/dashboard', label: 'Dashboard', icon: '◈' },
    { to: '/supervisor/reportes', label: 'Reportes', icon: '↓' },
  ],
  admin: [
    { to: '/admin/catalogo', label: 'Catálogo', icon: '⬆' },
    { to: '/admin/usuarios', label: 'Usuarios', icon: '◎' },
  ],
}

const ROL_LABEL = {
  vendedor: 'Vendedor',
  encargado: 'Encargado',
  supervisor: 'Supervisor',
  admin: 'Admin',
}

const ROL_COLOR = {
  vendedor: 'bg-blue-600',
  encargado: 'bg-emerald-600',
  supervisor: 'bg-purple-600',
  admin: 'bg-gray-800',
}

export default function Layout({ children }) {
  const { usuario, signOut } = useAuth()
  const { rol } = useLocal()
  const navigate = useNavigate()
  const links = NAV[rol] ?? []

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className={`${ROL_COLOR[rol] ?? 'bg-gray-800'} text-white`}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-lg leading-tight">Vans Parque Brown</p>
            <p className="text-xs opacity-75">{ROL_LABEL[rol]} · {usuario?.nombre}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs opacity-75 hover:opacity-100 border border-white/30 rounded px-2 py-1"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4">
        {children}
      </main>

      {/* Bottom nav — mobile first */}
      <nav className="sticky bottom-0 bg-white border-t border-gray-200 safe-area-pb">
        <div className="max-w-2xl mx-auto flex">
          {links.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-colors
                ${isActive ? 'text-black' : 'text-gray-400'}`
              }
            >
              <span className="text-xl leading-none mb-0.5">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
