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
  const [apertura, setApertura] = useState(null) // registro en DB
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [observaciones, setObservaciones] = useState({}) // idx → texto
  const [editando, setEditando] = useState(null) // idx

  useEffect(() => {
    if (localId) fetchApertura()
  }, [localId, turno])

  async function fetchApertura() {
    setLoading(true)
    const { data: ap } = await supabase
      .from('aperturas')
      .select(`*, apertura_items(*)`)
      .eq('local_id', localId)
      .eq('fecha', hoy)
      .eq('turno', turno)
      .single()

    if (ap) {
      setApertura(ap)
      setItems(ap.apertura_items ?? [])
    } else {
      setApertura(null)
      setItems([])
    }
    setLoading(false)
  }

  async function iniciarApertura() {
    // Crear apertura + items vacíos
    const { data: ap, error } = await supabase
      .from('aperturas')
      .insert({ local_id: localId, fecha: hoy, turno, registrado_por: usuario.id })
      .select().single()
    if (error || !ap) return

    const tareas = turno === 'mañana' ? ITEMS_MANIANA : ITEMS_TARDE
    const { data: itemsCreados } = await supabase
      .from('apertura_items')
      .insert(tareas.map(t => ({ apertura_id: ap.id, tarea: t })))
      .select()

    setApertura(ap)
    setItems(itemsCreados ?? [])
  }

  async function toggleItem(item) {
    if (item.completado) {
      // desmarcar
      const { data } = await supabase
        .from('apertura_items')
        .update({ completado: false, completado_at: null, completado_por: null })
        .eq('id', item.id).select().single()
      setItems(prev => prev.map(i => i.id === item.id ? data : i))
    } else {
      const { data } = await supabase
        .from('apertura_items')
        .update({ completado: true, completado_at: new Date().toISOString(), completado_por: usuario.id })
        .eq('id', item.id).select().single()
      setItems(prev => prev.map(i => i.id === item.id ? data : i))

      // Si todos completos, marcar apertura como completada
      const todos = items.map(i => i.id === item.id ? true : i.completado)
      if (todos.every(Boolean)) {
        await supabase.from('aperturas').update({ estado: 'completado' }).eq('id', apertura.id)
        setApertura(a => ({ ...a, estado: 'completado' }))
      }
    }
  }

  async function guardarObservacion(item) {
    const obs = observaciones[item.id] ?? ''
    const { data } = await supabase
      .from('apertura_items')
      .update({ observacion: obs || null })
      .eq('id', item.id).select().single()
    setItems(prev => prev.map(i => i.id === item.id ? data : i))
    setEditando(null)
  }

  const completados = items.filter(i => i.completado).length
  const total = items.length

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div>
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

      {!apertura ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-6">No hay checklist de {turno} para hoy</p>
          <button onClick={iniciarApertura}
            className="bg-black text-white rounded-xl px-6 py-3 text-sm font-bold">
            Iniciar checklist de {turno}
          </button>
        </div>
      ) : (
        <>
          {/* Progreso */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">{completados} / {total} ítems</span>
              <span className={`font-bold ${apertura.estado === 'completado' ? 'text-emerald-600' : 'text-gray-400'}`}>
                {apertura.estado === 'completado' ? 'Completado ✓' : 'En progreso'}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${apertura.estado === 'completado' ? 'bg-emerald-400' : 'bg-black'}`}
                style={{ width: total > 0 ? `${(completados / total) * 100}%` : '0%' }} />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className={`bg-white border rounded-xl p-4 ${item.completado ? 'border-emerald-200' : 'border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleItem(item)}
                    className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition
                      ${item.completado ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'}`}
                  >
                    {item.completado && <span className="text-xs">✓</span>}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${item.completado ? 'line-through text-gray-400' : ''}`}>
                      {item.tarea}
                    </p>
                    {/* Observación */}
                    {editando === item.id ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          autoFocus
                          value={observaciones[item.id] ?? item.observacion ?? ''}
                          onChange={e => setObservaciones(o => ({ ...o, [item.id]: e.target.value }))}
                          placeholder="Observación..."
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-black"
                        />
                        <button onClick={() => guardarObservacion(item)}
                          className="text-xs bg-black text-white rounded-lg px-2 py-1.5">OK</button>
                        <button onClick={() => setEditando(null)} className="text-xs text-gray-400">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => {
                        setObservaciones(o => ({ ...o, [item.id]: item.observacion ?? '' }))
                        setEditando(item.id)
                      }} className="mt-1 text-xs text-left w-full">
                        {item.observacion
                          ? <span className="text-blue-500">{item.observacion}</span>
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
