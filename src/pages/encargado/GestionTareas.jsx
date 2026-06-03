import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useLocal } from '../../hooks/useLocal'

const PRIORIDADES = ['Urgente', 'Importante', 'Relevante']
const TIPOS_DB = ['Admin', 'Operativo', 'Liderazgo']
const TIPO_LABEL = { Admin: 'Administrativo', Operativo: 'Operativo', Liderazgo: 'Liderazgo' }
const TURNOS = ['mañana', 'tarde', 'ambos']
const PRIORIDAD_COLOR = {
  Urgente: 'text-red-600',
  Importante: 'text-amber-600',
  Relevante: 'text-gray-500',
}

export default function GestionTareas() {
  const { usuario } = useAuth()
  const { localId } = useLocal()
  const [tareas, setTareas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    titulo: '', tipo: 'Operativo', turno: 'mañana',
    prioridad: 'Importante', asignado_a: '',
  })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (localId) { fetchTareas(); fetchVendedores() }
  }, [localId])

  async function fetchTareas() {
    setLoading(true)
    const hoy = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('tareas')
      .select(`*, usuarios!tareas_asignado_a_fkey(nombre)`)
      .eq('local_id', localId)
      .eq('fecha', hoy)
      .order('created_at')
    // Ordenar por prioridad client-side
    const ORDEN = { Urgente: 0, Importante: 1, Relevante: 2 }
    const sorted = (data ?? []).sort((a, b) => (ORDEN[a.prioridad] ?? 3) - (ORDEN[b.prioridad] ?? 3))
    setTareas(sorted)
    setLoading(false)
  }

  async function fetchVendedores() {
    // Requiere policy "encargado ve usuarios del local" en Supabase
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, rol')
      .eq('local_id', localId)
      .in('rol', ['vendedor', 'encargado'])
      .order('nombre')
    if (error) console.warn('Sin acceso a usuarios del local — ejecutar supabase-etapa2.sql', error.message)
    setVendedores(data ?? [])
  }

  async function crearTarea(e) {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase.from('tareas').insert({
      ...form,
      asignado_a: form.asignado_a || null,
      creado_por: usuario.id,
      local_id: localId,
      fecha: new Date().toISOString().split('T')[0],
    })
    setGuardando(false)
    if (!error) {
      setShowForm(false)
      setForm({ titulo: '', tipo: 'Operativo', turno: 'mañana', prioridad: 'Importante', asignado_a: '' })
      fetchTareas()
    }
  }

  async function eliminar(id) {
    await supabase.from('tareas').delete().eq('id', id)
    fetchTareas()
  }

  const grupos = PRIORIDADES.reduce((acc, p) => {
    acc[p] = tareas.filter(t => t.prioridad === p)
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Gestión de Tareas</h1>
        <button onClick={() => setShowForm(true)}
          className="bg-black text-white text-sm rounded-xl px-4 py-2">
          + Nueva
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-8">
            <h2 className="font-bold mb-4">Nueva tarea</h2>
            <form onSubmit={crearTarea} className="space-y-3">
              <input required placeholder="Título de la tarea"
                value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black"
              />
              {/* Tipo */}
              <div className="grid grid-cols-3 gap-2">
                {TIPOS_DB.map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className={`py-2 rounded-xl text-xs font-medium border ${form.tipo === t ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}
                  >{TIPO_LABEL[t]}</button>
                ))}
              </div>
              {/* Turno */}
              <div className="grid grid-cols-3 gap-2">
                {TURNOS.map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, turno: t }))}
                    className={`py-2 rounded-xl text-xs font-medium border capitalize ${form.turno === t ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}
                  >{t}</button>
                ))}
              </div>
              {/* Prioridad */}
              <div className="grid grid-cols-3 gap-2">
                {PRIORIDADES.map(p => (
                  <button key={p} type="button"
                    onClick={() => setForm(f => ({ ...f, prioridad: p }))}
                    className={`py-2 rounded-xl text-xs font-medium border ${form.prioridad === p ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}
                  >{p}</button>
                ))}
              </div>
              {/* Asignado a */}
              <select value={form.asignado_a}
                onChange={e => setForm(f => ({ ...f, asignado_a: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black bg-white"
              >
                <option value="">— Sin asignar —</option>
                {vendedores.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
              </select>
              {vendedores.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                  Sin vendedores cargados. Ejecutá supabase-etapa2.sql en el dashboard.
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-200 rounded-xl py-3 text-sm">Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 bg-black text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Crear tarea'}
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
      ) : tareas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No hay tareas hoy. Creá la primera.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {PRIORIDADES.map(p => grupos[p].length > 0 && (
            <div key={p}>
              <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${PRIORIDAD_COLOR[p]}`}>{p}</p>
              <div className="space-y-2">
                {grupos[p].map(tarea => (
                  <div key={tarea.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{tarea.titulo}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {TIPO_LABEL[tarea.tipo] ?? tarea.tipo} · {tarea.turno} · {tarea.usuarios?.nombre ?? 'Sin asignar'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${
                        tarea.estado === 'completada' ? 'bg-emerald-100 text-emerald-700' :
                        tarea.estado === 'en_progreso' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {tarea.estado === 'completada' ? '✓' : tarea.estado === 'en_progreso' ? '▶' : '○'}
                      </span>
                      <button onClick={() => eliminar(tarea.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
