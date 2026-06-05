import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useLocal } from '../../hooks/useLocal'

const ITEMS_MANIANA = [
  'Encender luces y música',
  'Revisar vidriera',
  'Armar mesa central (lista antes de las 10:00)',
  'Verificar pared de calzado (degradé claro → oscuro)',
  'Reponer lo vendido del día anterior',
  'Revisar limpieza general',
]

const ITEMS_TARDE = [
  'Reponer lo vendido en el turno mañana',
  'Revisar vidriera',
  'Verificar mesa central',
  'Control de caja',
  'Ordenar depósito',
  'Reporte de cierre',
]

export default function Apertura() {
  const { usuario } = useAuth()
  const { localId } = useLocal()
  const hoy = new Date().toISOString().split('T')[0]

  const [turno, setTurno] = useState('mañana')
  const [apertura, setApertura] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [iniciando, setIniciando] = useState(false)
  const [observaciones, setObservaciones] = useState({})
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (localId) fetchApertura()
  }, [localId, turno])

  async function fetchApertura() {
    setLoading(true)
    setError('')
    const { data: ap, error: fetchErr } = await supabase
      .from('aperturas')
      .select(`*, apertura_items(*)`)
      .eq('local_id', localId)
      .eq('fecha', hoy)
      .eq('turno', turno)
      .maybeSingle()  // maybeSingle no lanza error si no hay filas

    if (fetchErr) {
      setError('Error al cargar: ' + fetchErr.message)
    } else if (ap) {
      setApertura(ap)
      // Ordenar items por id para consistencia
      setItems((ap.apertura_items ?? []).sort((a, b) => a.id.localeCompare(b.id)))
    } else {
      setApertura(null)
      setItems([])
    }
    setLoading(false)
  }

  async function iniciarApertura() {
    setIniciando(true)
    setError('')

    // Crear apertura
    const { data: ap, error: apErr } = await supabase
      .from('aperturas')
      .insert({ local_id: localId, fecha: hoy, turno, registrado_por: usuario.id })
      .select()
      .single()

    if (apErr || !ap) {
      setError('Error al iniciar: ' + (apErr?.message ?? 'sin respuesta'))
      setIniciando(false)
      return
    }

    // Crear items del checklist
    const tareas = turno === 'mañana' ? ITEMS_MANIANA : ITEMS_TARDE
    const { data: itemsCreados, error: itErr } = await supabase
      .from('apertura_items')
      .insert(tareas.map(t => ({ apertura_id: ap.id, tarea: t })))
      .select()

    if (itErr) {
      setError('Apertura creada pero error en ítems: ' + itErr.message)
    }

    setApertura(ap)
    setItems(itemsCreados ?? [])
    setIniciando(false)
  }

  async function toggleItem(item) {
    const nuevoEstado = !item.completado
    const update = nuevoEstado
      ? { completado: true, completado_at: new Date().toISOString(), completado_por: usuario.id }
      : { completado: false, completado_at: null, completado_por: null }

    const { data: updated, error: updErr } = await supabase
      .from('apertura_items')
      .update(update)
      .eq('id', item.id)
      .select()
      .single()

    if (updErr) { setError('Error al actualizar ítem: ' + updErr.message); return }

    const newItems = items.map(i => i.id === item.id ? updated : i)
    setItems(newItems)

    // Auto-completar apertura si todos los ítems están marcados
    if (nuevoEstado && newItems.every(i => i.completado)) {
      await supabase.from('aperturas').update({ estado: 'completado' }).eq('id', apertura.id)
      setApertura(a => ({ ...a, estado: 'completado' }))
    } else if (!nuevoEstado && apertura.estado === 'completado') {
      // Si se desmarca uno, volver a pendiente
      await supabase.from('aperturas').update({ estado: 'pendiente' }).eq('id', apertura.id)
      setApertura(a => ({ ...a, estado: 'pendiente' }))
    }
  }

  async function guardarObservacion(item) {
    const obs = observaciones[item.id] ?? ''
    const { data: updated, error: obsErr } = await supabase
      .from('apertura_items')
      .update({ observacion: obs || null })
      .eq('id', item.id)
      .select()
      .single()

    if (obsErr) { setError('Error al guardar observación: ' + obsErr.message); return }
    setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    setEditando(null)
  }

  const completados = items.filter(i => i.completado).length
  const total = items.length
  const pct = total > 0 ? Math.round((completados / total) * 100) : 0

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Selector de turno */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Apertura / Cierre</h1>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
          {['mañana', 'tarde'].map(t => (
            <button key={t} onClick={() => setTurno(t)}
              className={`px-3 py-1.5 capitalize ${turno === t ? 'bg-black text-white' : 'text-gray-500'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-600 flex justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 ml-2">✕</button>
        </div>
      )}

      {/* Sin apertura iniciada */}
      {!apertura ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-2">No hay checklist de <strong>{turno}</strong> para hoy</p>
          <p className="text-xs text-gray-300 mb-6">{hoy}</p>
          <button
            onClick={iniciarApertura}
            disabled={iniciando}
            className="bg-black text-white rounded-xl px-8 py-3.5 text-sm font-bold disabled:opacity-50"
          >
            {iniciando ? 'Iniciando...' : `Iniciar checklist de ${turno}`}
          </button>
        </div>
      ) : (
        <>
          {/* Barra de progreso */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">{completados} / {total} ítems</span>
              <span className={`font-bold ${apertura.estado === 'completado' ? 'text-emerald-600' : 'text-gray-400'}`}>
                {apertura.estado === 'completado' ? '✓ Completado' : `${pct}%`}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${apertura.estado === 'completado' ? 'bg-emerald-400' : 'bg-black'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Lista de ítems */}
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id}
                className={`bg-white border rounded-xl p-4 transition ${item.completado ? 'border-emerald-200' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleItem(item)}
                    className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition
                      ${item.completado ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-black'}`}
                  >
                    {item.completado && <span className="text-xs leading-none">✓</span>}
                  </button>

                  <div className="flex-1">
                    <p className={`text-sm font-medium ${item.completado ? 'line-through text-gray-400' : ''}`}>
                      {item.tarea}
                    </p>

                    {/* Observación inline */}
                    {editando === item.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          autoFocus
                          value={observaciones[item.id] ?? item.observacion ?? ''}
                          onChange={e => setObservaciones(o => ({ ...o, [item.id]: e.target.value }))}
                          placeholder="Observación..."
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-black"
                        />
                        <button onClick={() => guardarObservacion(item)}
                          className="text-xs bg-black text-white rounded-lg px-2 py-1.5 font-bold">
                          OK
                        </button>
                        <button onClick={() => setEditando(null)} className="text-xs text-gray-400">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setObservaciones(o => ({ ...o, [item.id]: item.observacion ?? '' }))
                          setEditando(item.id)
                        }}
                        className="mt-1 text-xs text-left w-full"
                      >
                        {item.observacion
                          ? <span className="text-blue-500 italic">{item.observacion}</span>
                          : <span className="text-gray-300 italic">+ observación</span>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
