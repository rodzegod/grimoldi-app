import { NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLocal } from '../hooks/useLocal'
import { supabase } from '../lib/supabase'

const NAV = {
  vendedor: [
    { to: '/vendedor/tareas',              label: 'Tareas',    icon: '✓' },
    { to: '/vendedor/apertura',            label: 'Apertura',  icon: '☑' },
    { to: '/vendedor/incidencias/nueva',   label: 'Reportar',  icon: '+' },
    { to: '/vendedor/mapa',                label: 'Mapa',      icon: '⊞' },
    { to: '/vendedor/novedades',           label: 'Novedades', icon: '📋', badge: 'novedades' },
    { to: '/vendedor/horario',             label: 'Horario',   icon: '🗓' },
  ],
  encargado: [
    { to: '/encargado/tareas',      label: 'Tareas',     icon: '✓' },
    { to: '/encargado/incidencias', label: 'Inciden.',   icon: '!' },
    { to: '/encargado/aperturas',   label: 'Apertura',   icon: '☑' },
    { to: '/encargado/ventas',      label: 'Ventas',     icon: '$' },
    { to: '/encargado/stock',       label: 'Stock',      icon: '📦' },
    { to: '/encargado/comunicados', label: 'Comunic.',   icon: '📢', badge: 'movimientos' },
    { to: '/encargado/horarios',    label: 'Horarios',   icon: '🗓' },
    { to: '/encargado/recurrentes', label: 'Recurrentes',icon: '↻' },
    { to: '/encargado/zonas',       label: 'Zonas',      icon: '⊞' },
  ],
  supervisor: [
    { to: '/supervisor/dashboard',  label: 'Dashboard', icon: '◈' },
    { to: '/supervisor/ventas',     label: 'Ventas',    icon: '$' },
    { to: '/supervisor/reportes',   label: 'Reportes',  icon: '↓' },
  ],
  admin: [
    { to: '/admin/catalogo',   label: 'Catálogo',  icon: '⬆' },
    { to: '/admin/usuarios',   label: 'Usuarios',  icon: '◎' },
    { to: '/encargado/zonas',  label: 'Zonas',     icon: '⊞' },
    { to: '/encargado/stock',  label: 'Stock',     icon: '📦' },
  ],
}

const ROL_LABEL = { vendedor: 'Vendedor', encargado: 'Encargado', supervisor: 'Supervisor', admin: 'Admin' }

export default function Layout({ children }) {
  const { usuario, signOut } = useAuth()
  const { rol, localId } = useLocal()
  const navigate = useNavigate()
  const links = NAV[rol] ?? []

  const [movBadge, setMovBadge] = useState(0)
  const [novedadesBadge, setNovedadesBadge] = useState(0)

  useEffect(() => {
    if (!localId || !usuario) return
    if (rol === 'encargado') fetchMovBadge()
    if (rol === 'vendedor') fetchNovedadesBadge()
  }, [rol, localId, usuario])

  async function fetchMovBadge() {
    const hoy = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('movimientos_stock').select('*', { count: 'exact', head: true })
      .eq('local_id', localId).eq('revisado', false).gte('created_at', `${hoy}T00:00:00`)
    setMovBadge(count ?? 0)
  }

  async function fetchNovedadesBadge() {
    const hoy = new Date().toISOString().split('T')[0]
    const [{ data: coms }, { data: vistos }] = await Promise.all([
      supabase.from('comunicados').select('id').eq('local_id', localId)
        .or(`expira_at.is.null,expira_at.gte.${hoy}`),
      supabase.from('comunicados_vistos').select('comunicado_id').eq('usuario_id', usuario.id),
    ])
    const vistosSet = new Set((vistos ?? []).map(v => v.comunicado_id))
    setNovedadesBadge((coms ?? []).filter(c => !vistosSet.has(c.id)).length)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function getBadgeCount(badge) {
    if (badge === 'movimientos') return movBadge
    if (badge === 'novedades') return novedadesBadge
    return 0
  }

  return (
    <div className="min-h-screen flex flex-col bg-vans-gray-bg">
      {/* Header — siempre negro */}
      <header className="bg-vans-black text-white sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-black text-base leading-tight tracking-wide">VANS · Parque Brown</p>
            <p className="text-xs opacity-60 mt-0.5">{ROL_LABEL[rol]} · {usuario?.nombre}</p>
          </div>
          <div className="flex items-center gap-2">
            {rol === 'encargado' && movBadge > 0 && (
              <span className="bg-vans-red text-white text-xs font-bold rounded-full px-2 py-0.5">
                {movBadge}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="text-xs opacity-65 hover:opacity-100 border border-white/25 rounded-lg px-2.5 py-1 transition"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 pb-24">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-vans-gray-line z-40">
        <div className="max-w-2xl mx-auto overflow-x-auto">
          <div className="flex min-w-max">
            {links.map(({ to, label, icon, badge }) => {
              const count = badge ? getBadgeCount(badge) : 0
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex flex-col items-center py-2 px-3 text-[10px] font-medium transition-colors relative whitespace-nowrap
                    ${isActive ? 'text-vans-red' : 'text-vans-gray-text'}`
                  }
                >
                  <span className="text-lg leading-none mb-0.5 relative">
                    {icon}
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1.5 bg-vans-red text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </span>
                  {label}
                </NavLink>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}
