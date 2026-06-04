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
const TIPO_LABEL = { Admin: 'Administrativo', Operativo: 'Operativo', Liderazgo: 'Liderazgo' }

export default function MisTareas() {
  const { usuario } = useAuth()
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [turno, setTurno] = useState('mañana')
  const [modalTarea, setModalTarea] = useState(null) // tarea seleccionada para el popup

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

  function tocarTarea(tarea) {
    // Si ya está completada o derivada, toque vuelve a pendiente directamente
    if (tarea.estado === 'completada' || tarea.estado === 'pendiente_derivar') {
      marcarEstado(tarea.id, 'pendiente', null)
      return
    }
    // Si está pendiente → en_progreso directo
    if (tarea.estado === 'pendiente') {
      marcarEstado(tarea.id, 'en_progreso', null)
      return
    }
    // Si está en_progreso → mostrar modal con opciones
    setModalTarea(tarea)
  }

  async function marcarEstado(id, estado, completado_at) {
    await supabase.from('tareas').update({
      estado,
      completado_at: completado_at ?? null,
    }).eq('id', id)
    setModalTarea(null)
    fetchTareas()
  }

  async function marcarHecha() {
    await marcarEstado(modalTarea.id, 'completada', new Date().toISOString())
  }

  async function marcarPendienteDerivada() {
    await marcarEstado(modalTarea.id, 'pendiente_derivar', null)
  }

  const activas = tareas.filter(t => t.estado !== 'completada' && t.estado !== 'pendiente_derivar')
  const derivadas = tareas.filter(t => t.estado === 'pendiente_derivar')
  const completadas = tareas.filter(t => t.estado === 'completada')

  return (
    <div>
      {/* Modal de completado */}
      {modalTarea && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <p className="font-bold text-base mb-1">{modalTarea.titulo}</p>
            <p className="text-xs text-gray-400 mb-5">
              {TIPO_LABEL[modalTarea.tipo] ?? modalTarea.tipo} · {modalTarea.prioridad}
            </p>

            <div className="space-y-2">
              <button
                onClick={marcarHecha}
                className="w-full bg-black text-white rounded-xl py-3.5 text-sm font-bold flex items-center justify-center gap-2"
              >
                <span className="text-base">✓</span> Hecha
              </button>
              <button
                onClick={marcarPendienteDerivada}
                className="w-full bg-amber-50 text-amber-700 border border-amber-200 rounded-xl py-3.5 text-sm font-bold"
              >
                Quedó pendiente
              </button>
              <button
                onClick={() => setModalTarea(null)}
                className="w-full text-gray-400 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Mis Tareas</h1>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
          {['mañana', 'tarde'].map(t => (
            <button key={t} onClick={() => setTurno(t)}
              className={`px-3 py-1.5 capitalize ${turno === t ? 'bg-black text-white' : 'text-gray-500'}`}>
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
          {activas.map(tarea => (
            <TareaCard key={tarea.id} tarea={tarea} onTocar={tocarTarea} />
          ))}

          {derivadas.length > 0 && (
            <>
              <p className="text-xs text-amber-600 font-medium mt-4 mb-2">
                Pendiente de derivar ({derivadas.length})
              </p>
              {derivadas.map(tarea => (
                <TareaCard key={tarea.id} tarea={tarea} onTocar={tocarTarea} />
              ))}
            </>
          )}

          {completadas.length > 0 && (
            <>
              <p className="text-xs text-gray-400 font-medium mt-4 mb-2">
                Completadas ({completadas.length})
              </p>
              {completadas.map(tarea => (
                <TareaCard key={tarea.id} tarea={tarea} onTocar={tocarTarea} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TareaCard({ tarea, onTocar }) {
  const isCompletada = tarea.estado === 'completada'
  const isDerivada = tarea.estado === 'pendiente_derivar'

  const iconEstado = isCompletada ? '✓'
    : isDerivada ? '⏸'
    : tarea.estado === 'en_progreso' ? null
    : null

  const btnClass = isCompletada
    ? 'bg-black border-black text-white'
    : isDerivada
    ? 'bg-amber-100 border-amber-400 text-amber-600'
    : tarea.estado === 'en_progreso'
    ? 'border-amber-500 bg-amber-50'
    : 'border-gray-300'

  return (
    <div className={`rounded-xl border p-4 bg-white ${isCompletada ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => onTocar(tarea)}
          className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${btnClass}`}
        >
          {iconEstado && <span className="text-[10px] leading-none">{iconEstado}</span>}
          {tarea.estado === 'en_progreso' && <span className="w-2 h-2 bg-amber-500 rounded-full" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${isCompletada ? 'line-through' : ''}`}>
            {tarea.titulo}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-xs font-medium ${TIPO_COLOR[tarea.tipo] ?? 'text-gray-500'}`}>
              {TIPO_LABEL[tarea.tipo] ?? tarea.tipo}
            </span>
            <span className={`text-xs border rounded-full px-2 py-0.5 ${PRIORIDAD_COLOR[tarea.prioridad] ?? ''}`}>
              {tarea.prioridad}
            </span>
            {isDerivada && (
              <span className="text-xs text-amber-600 font-medium">pendiente de derivar</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
