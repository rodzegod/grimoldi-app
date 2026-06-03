import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const PRIORIDAD_COLOR = {
  Urgente: 'bg-red-100 text-red-700 border-red-200',
  Importante: 'bg-amber-100 text-amber-700 border-amber-200',
  Relevante: 'bg-gray-100 text-gray-600 border-gray-200',
}

const TIPO_COLOR = {
  Admin: 'text-blue-600',
  Operativo: 'text-emerald-600',
  Liderazgo: 'text-purple-600',
}

export default function MisTareas() {
  const { usuario } = useAuth()
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [turno, setTurno] = useState('mañana')

  useEffect(() => {
    if (usuario) fetchTareas()
  }, [usuario, turno])

  async function fetchTareas() {
    setLoading(true)
    const hoy = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('tareas')
      .select('*')
      .eq('asignado_a', usuario.id)
      .eq('fecha', hoy)
      .in('turno', [turno, 'ambos'])
      .order('created_at', { ascending: true })
    const ORDEN = { Urgente: 0, Importante: 1, Relevante: 2 }
    const sorted = (data ?? []).sort((a, b) => (ORDEN[a.prioridad] ?? 3) - (ORDEN[b.prioridad] ?? 3))
    setTareas(sorted)
    setLoading(false)
  }

  async function cambiarEstado(id, estadoActual) {
    const siguiente = estadoActual === 'pendiente' ? 'en_progreso'
      : estadoActual === 'en_progreso' ? 'completada'
      : 'pendiente'

    const extra = siguiente === 'completada'
      ? { completado_at: new Date().toISOString() }
      : siguiente === 'pendiente' ? { completado_at: null } : {}

    await supabase
      .from('tareas')
      .update({ estado: siguiente, ...extra })
      .eq('id', id)
    fetchTareas()
  }

  const pendientes = tareas.filter(t => t.estado !== 'completada')
  const completadas = tareas.filter(t => t.estado === 'completada')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Mis Tareas</h1>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
          {['mañana', 'tarde'].map(t => (
            <button
              key={t}
              onClick={() => setTurno(t)}
              className={`px-3 py-1.5 capitalize ${turno === t ? 'bg-black text-white' : 'text-gray-500'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tareas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">✓</p>
          <p>No hay tareas para este turno</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendientes.map(tarea => (
            <TareaCard key={tarea.id} tarea={tarea} onChange={cambiarEstado} />
          ))}
          {completadas.length > 0 && (
            <>
              <p className="text-xs text-gray-400 font-medium mt-4 mb-2">Completadas ({completadas.length})</p>
              {completadas.map(tarea => (
                <TareaCard key={tarea.id} tarea={tarea} onChange={cambiarEstado} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TareaCard({ tarea, onChange }) {
  const isCompletada = tarea.estado === 'completada'

  return (
    <div className={`rounded-xl border p-4 ${isCompletada ? 'opacity-50' : ''} bg-white`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onChange(tarea.id, tarea.estado)}
          className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition
            ${tarea.estado === 'completada' ? 'bg-black border-black text-white'
              : tarea.estado === 'en_progreso' ? 'border-amber-500 bg-amber-50'
              : 'border-gray-300'}`}
        >
          {tarea.estado === 'completada' && <span className="text-xs">✓</span>}
          {tarea.estado === 'en_progreso' && <span className="w-2 h-2 bg-amber-500 rounded-full" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${isCompletada ? 'line-through' : ''}`}>
            {tarea.titulo}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-xs font-medium ${TIPO_COLOR[tarea.tipo] ?? 'text-gray-500'}`}>
              {tarea.tipo}
            </span>
            <span className={`text-xs border rounded-full px-2 py-0.5 ${PRIORIDAD_COLOR[tarea.prioridad] ?? ''}`}>
              {tarea.prioridad}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
