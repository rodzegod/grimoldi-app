import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

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
  const [ok, setOk] = useState('')

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
    setOk('')

    // Signup via fetch directo — no reemplaza la sesión del admin
    const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: form.email, password: form.password }),
    })

    const signupData = await signupRes.json()

    if (!signupRes.ok || !signupData.id) {
      const msg = signupData.msg || signupData.error_description || 'Error al crear la cuenta'
      setError(msg)
      setGuardando(false)
      return
    }

    // Insertar en tabla usuarios usando la sesión del admin (RLS permite)
    const { error: dbError } = await supabase.from('usuarios').insert({
      id: signupData.id,
      email: form.email,
      nombre: form.nombre,
      rol: form.rol,
      local_id: localId,
    })

    setGuardando(false)

    if (dbError) {
      setError('Cuenta creada en Auth pero no se pudo insertar el perfil: ' + dbError.message)
      return
    }

    setOk(`Usuario ${form.nombre} creado. Que confirme su email antes de ingresar.`)
    setShowForm(false)
    setForm({ email: '', nombre: '', password: '', rol: 'vendedor' })
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
          onClick={() => { setShowForm(true); setError(''); setOk('') }}
          className="bg-vans-red text-white text-sm font-bold rounded-xl px-4 py-2"
        >
          + Usuario
        </button>
      </div>

      {ok && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-xs text-emerald-700">
          ✓ {ok}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-8">
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
                minLength={6}
                placeholder="Contraseña (mín. 6 caracteres)"
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
              {error && <p className="text-xs text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowForm(false); setError('') }}
                  className="flex-1 border border-gray-900 text-gray-900 rounded-xl py-3 text-sm font-medium"
                >Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 bg-vans-red text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50"
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
      ) : usuarios.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No hay usuarios en este local todavía.</p>
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
                className={`text-xs font-medium rounded-full px-3 py-1 border-0 cursor-pointer ${ROL_COLOR[u.rol]}`}
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
