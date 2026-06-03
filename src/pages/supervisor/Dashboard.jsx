import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'

export default function Dashboard() {
  const { localId } = useLocal()
  const [metricas, setMetricas] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (localId) fetchMetricas()
  }, [localId])

  async function fetchMetricas() {
    setLoading(true)
    const hoy = new Date().toISOString().split('T')[0]

    const [
      { count: tareasHoy },
      { count: tareasComp },
      { count: incAbiertas },
      { count: incHoy },
      { count: incUrgentes },
      { count: productos },
    ] = await Promise.all([
      supabase.from('tareas').select('*', { count: 'exact', head: true }).eq('local_id', localId).eq('fecha', hoy),
      supabase.from('tareas').select('*', { count: 'exact', head: true }).eq('local_id', localId).eq('fecha', hoy).eq('estado', 'completada'),
      supabase.from('incidencias').select('*', { count: 'exact', head: true }).eq('local_id', localId).in('estado', ['abierta', 'en_proceso']),
      supabase.from('incidencias').select('*', { count: 'exact', head: true }).eq('local_id', localId).gte('created_at', `${hoy}T00:00:00`),
      supabase.from('incidencias').select('*', { count: 'exact', head: true }).eq('local_id', localId).eq('prioridad', 'Urgente').in('estado', ['abierta', 'en_proceso']),
      supabase.from('productos').select('*', { count: 'exact', head: true }).eq('local_id', localId),
    ])

    setMetricas({ tareasHoy, tareasComp, incAbiertas, incHoy, incUrgentes, productos })
    setLoading(false)
  }

  const tareasPorc = metricas?.tareasHoy > 0
    ? Math.round((metricas.tareasComp / metricas.tareasHoy) * 100)
    : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-xs text-gray-400">
          {new Date().toLocaleDateString('es-AR', { dateStyle: 'long' })}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tareas hoy */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Tareas hoy</p>
            <div className="flex items-end gap-3">
              <p className="text-4xl font-black">
                {metricas.tareasComp}<span className="text-xl text-gray-300">/{metricas.tareasHoy}</span>
              </p>
              <p className="text-emerald-500 font-bold text-lg mb-0.5">{tareasPorc}%</p>
            </div>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${tareasPorc}%` }}
              />
            </div>
          </div>

          {/* Incidencias */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-2xl p-4 ${metricas.incUrgentes > 0 ? 'bg-red-50 border border-red-200' : 'bg-white border border-gray-200'}`}>
              <p className="text-xs text-gray-400 mb-1">Urgentes activas</p>
              <p className={`text-3xl font-black ${metricas.incUrgentes > 0 ? 'text-red-600' : ''}`}>
                {metricas.incUrgentes}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-400 mb-1">Abiertas total</p>
              <p className="text-3xl font-black">{metricas.incAbiertas}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-400 mb-1">Reportadas hoy</p>
              <p className="text-3xl font-black">{metricas.incHoy}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-xs text-gray-400 mb-1">SKUs en catálogo</p>
              <p className="text-3xl font-black">{metricas.productos}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
