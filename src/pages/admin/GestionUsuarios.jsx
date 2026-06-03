import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'

const ROLES = ['vendedor', 'encargado', 'supervisor', 'admin']
const ROL_COLOR = {
  vendedor: 'bg-blue-100 text-blue-700',
  encargado: 'bg-emerald-100 text-emerald-700',
  supervisor: 'bg-purple-100 text-purple-700',
  admin: 'bg-gray-100 text-gray-700',
}

export default function GestionUsuarios() {
  const { localId } = useLocal()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', nombre: '', password: '', rol: 'vendedor' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (localId) fetchUsuarios()
  }, [localId])

  async function fetchUsuarios() {
    setLoading(true)
    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .eq('local_id', localId)
      .order('nombre')
    setUsuarios(data ?? [])
    setLoading(false)
  }

  async function crearUsuario(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')

    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true,
    })

    if (authError) {
      // auth.admin requiere service_role key — mostrar instrucción alternativa
      setError('Creá el usuario desde el panel de Supabase Auth y luego insertalo en la tabla usuarios manualmente.')
      setGuardando(false)
      return
    }

    // 2. Insertar en tabla usuarios
    await supabase.from('usuarios').insert({
      id: authData.user.id,
      email: form.email,
      nombre: form.nombre,
      rol: form.rol,
      local_id: localId,
    })

    setShowForm(false)
    setForm({ email: '', nombre: '', password: '', rol: 'vendedor' })
    setGuardando(false)
    fetchUsuarios()
  }

  async function cambiarRol(id, nuevoRol) {
    await supabase.from('usuarios').update({ rol: nuevoRol }).eq('id', id)
    fetchUsuarios()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Gestión de Usuarios</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-black text-white text-sm rounded-xl px-4 py-2"
        >
          + Usuario
        </button>
      </div>

      {/* Nota sobre creación */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700">
        Para crear usuarios, ir a{' '}
        <strong>Supabase → Authentication → Users → Add user</strong>{' '}
        y luego insertarlo en la tabla <code>usuarios</code> con su rol y local_id.
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5">
            <h2 className="font-bold mb-4">Nuevo usuario</h2>
            <form onSubmit={crearUsuario} className="space-y-3">
              <input
                required
                placeholder="Nombre completo"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black"
              />
              <input
                required
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black"
              />
              <input
                required
                type="password"
                placeholder="Contraseña temporal"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black"
              />
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => (
                  <button key={r} type="button"
                    onClick={() => setForm(f => ({ ...f, rol: r }))}
                    className={`py-2 rounded-xl text-xs font-medium border capitalize ${form.rol === r ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}
                  >{r}</button>
                ))}
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowForm(false); setError('') }}
                  className="flex-1 border border-gray-200 rounded-xl py-3 text-sm"
                >Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 bg-black text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50"
                >
                  {guardando ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {usuarios.map(u => (
            <div key={u.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{u.nombre}</p>
                <p className="text-xs text-gray-400">{u.email}</p>
              </div>
              <select
                value={u.rol}
                onChange={e => cambiarRol(u.id, e.target.value)}
                className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${ROL_COLOR[u.rol]} appearance-none cursor-pointer`}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
