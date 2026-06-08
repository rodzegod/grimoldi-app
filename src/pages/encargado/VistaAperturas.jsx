import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'

const ESTADO_COLOR = {
  completado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
  no_iniciado: 'bg-red-100 text-red-600 border-red-200',
}

export default function VistaAperturas() {
  const { localId } = useLocal()
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [aperturas, setAperturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!localId) return
    fetchAperturas()
    // Auto-refresh cada 30s para ver actualizaciones del vendedor en cuasi-tiempo real
    intervalRef.current = setInterval(fetchAperturas, 30000)
    return () => clearInterval(intervalRef.current)
  }, [localId, fecha])

  async function fetchAperturas() {
    setError('')
    const { data, error: fetchErr } = await supabase
      .from('aperturas')
      .select(`*, apertura_items(*), usuarios!aperturas_registrado_por_fkey(nombre)`)
      .eq('local_id', localId)
      .eq('fecha', fecha)
      .order('turno')
    if (fetchErr) setError('Error al cargar: ' + fetchErr.message)
    setAperturas(data ?? [])
    setLoading(false)
  }

  const turnos = ['mañana', 'tarde']

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Apertura / Cierre</h1>
        <div className="flex items-center gap-2">
          <button onClick={fetchAperturas}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-400 hover:border-black transition">
            ↻
          </button>
          <input type="date" value={fecha} onChange={e => { setLoading(true); setFecha(e.target.value) }}
            max={new Date().toISOString().split('T')[0]}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black" />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-sm text-red-600 flex justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 ml-2">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {turnos.map(turno => {
            const ap = aperturas.find(a => a.turno === turno)
            const items = ap?.apertura_items ?? []
            const completados = items.filter(i => i.completado).length
            const total = items.length
            const estado = !ap ? 'no_iniciado' : ap.estado === 'completado' ? 'completado' : 'pendiente'

            return (
              <div key={turno} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                  <p className="font-bold capitalize">{turno}</p>
                  <div className="flex items-center gap-2">
                    {ap && (
                      <span className="text-xs text-gray-400">{completados}/{total}</span>
                    )}
                    <span className={`text-xs rounded-full px-2 py-0.5 border ${ESTADO_COLOR[estado]}`}>
                      {estado === 'no_iniciado' ? 'No iniciado' : estado === 'completado' ? 'Completado' : 'En progreso'}
                    </span>
                  </div>
                </div>

                {!ap ? (
                  <p className="text-xs text-gray-400 px-4 py-3">Aún no iniciado</p>
                ) : (
                  <>
                    <div className="px-4 py-2">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${estado === 'completado' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                          style={{ width: total > 0 ? `${(completados / total) * 100}%` : '0%' }} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 px-4 pb-2">
                      Registrado por {ap.usuarios?.nombre ?? '—'}
                    </p>
                    <div className="divide-y divide-gray-100">
                      {items.map(item => (
                        <div key={item.id} className="px-4 py-2.5 flex items-start gap-2">
                          <span className={`text-base mt-0.5 shrink-0 ${item.completado ? 'text-emerald-500' : 'text-gray-300'}`}>
                            {item.completado ? '✓' : '○'}
                          </span>
                          <div className="min-w-0">
                            <p className={`text-xs ${item.completado ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>
                              {item.tarea}
                            </p>
                            {item.observacion && (
                              <p className="text-xs text-blue-500 mt-0.5">{item.observacion}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
