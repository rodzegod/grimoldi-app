import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'

export default function Dashboard() {
  const { localId } = useLocal()
  const [metricas, setMetricas] = useState(null)
  const [incPorTipo, setIncPorTipo] = useState([])
  const [tiempoPromedio, setTiempoPromedio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (localId) fetchMetricas()
  }, [localId])

  async function fetchMetricas() {
    setLoading(true)
    setError('')
    const hoy = new Date().toISOString().split('T')[0]

    try {
      const [
        r1, r2, r3, r4, r5, r6, r7
      ] = await Promise.all([
        supabase.from('tareas').select('*', { count: 'exact', head: true }).eq('local_id', localId).eq('fecha', hoy),
        supabase.from('tareas').select('*', { count: 'exact', head: true }).eq('local_id', localId).eq('fecha', hoy).eq('estado', 'completada'),
        supabase.from('incidencias').select('*', { count: 'exact', head: true }).eq('local_id', localId).in('estado', ['abierta', 'en_proceso']),
        supabase.from('incidencias').select('*', { count: 'exact', head: true }).eq('local_id', localId).gte('created_at', `${hoy}T00:00:00`),
        supabase.from('incidencias').select('*', { count: 'exact', head: true }).eq('local_id', localId).eq('prioridad', 'Urgente').in('estado', ['abierta', 'en_proceso']),
        supabase.from('productos').select('*', { count: 'exact', head: true }).eq('local_id', localId),
        // Incidencias resueltas de los últimos 7 días para calcular tiempo promedio
        supabase.from('incidencias').select('created_at, resuelto_at').eq('local_id', localId).eq('estado', 'resuelta').not('resuelto_at', 'is', null).gte('resuelto_at', new Date(Date.now() - 7 * 86400000).toISOString()).limit(100),
      ])

      setMetricas({
        tareasHoy: r1.count ?? 0,
        tareasComp: r2.count ?? 0,
        incAbiertas: r3.count ?? 0,
        incHoy: r4.count ?? 0,
        incUrgentes: r5.count ?? 0,
        productos: r6.count ?? 0,
      })

      // Tiempo promedio de resolución (en horas)
      const resueltas = r7.data ?? []
      if (resueltas.length > 0) {
        const totalMs = resueltas.reduce((acc, i) => {
          return acc + (new Date(i.resuelto_at) - new Date(i.created_at))
        }, 0)
        setTiempoPromedio(Math.round(totalMs / resueltas.length / 3600000 * 10) / 10)
      } else {
        setTiempoPromedio(null)
      }

      // Incidencias por tipo (últimos 30 días)
      const { data: porTipoData } = await supabase
        .from('incidencias')
        .select('tipo')
        .eq('local_id', localId)
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())

      const conteo = {}
      ;(porTipoData ?? []).forEach(i => {
        conteo[i.tipo] = (conteo[i.tipo] ?? 0) + 1
      })
      setIncPorTipo(Object.entries(conteo).sort((a, b) => b[1] - a[1]))

    } catch (err) {
      setError('Error al cargar métricas')
      console.error(err)
    }
    setLoading(false)
  }

  const tareasPorc = metricas?.tareasHoy > 0
    ? Math.round((metricas.tareasComp / metricas.tareasHoy) * 100)
    : 0

  const TIPO_LABEL = {
    talle_faltante: 'Talle faltante',
    par_incompleto: 'Par incompleto',
    pies_cruzados: 'Pies cruzados',
    defecto_producto: 'Defecto',
    otro: 'Otro',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-xs text-gray-400">
          {new Date().toLocaleDateString('es-AR', { dateStyle: 'long' })}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-600">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : metricas && (
        <div className="space-y-4">
          {/* Tareas hoy */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Tareas del día</p>
            <div className="flex items-end gap-3">
              <p className="text-4xl font-black">
                {metricas.tareasComp}
                <span className="text-xl text-gray-300">/{metricas.tareasHoy}</span>
              </p>
              <p className={`font-bold text-lg mb-0.5 ${tareasPorc >= 80 ? 'text-emerald-500' : tareasPorc >= 50 ? 'text-amber-500' : 'text-gray-400'}`}>
                {tareasPorc}%
              </p>
            </div>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${tareasPorc >= 80 ? 'bg-emerald-400' : tareasPorc >= 50 ? 'bg-amber-400' : 'bg-gray-300'}`}
                style={{ width: `${tareasPorc}%` }}
              />
            </div>
          </div>

          {/* Grid métricas */}
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
              <p className="text-xs text-gray-400 mb-1">T° prom. resolución</p>
              <p className="text-2xl font-black">
                {tiempoPromedio !== null ? `${tiempoPromedio}h` : '—'}
              </p>
              {tiempoPromedio !== null && (
                <p className="text-xs text-gray-300">últimos 7 días</p>
              )}
            </div>
          </div>

          {/* SKUs catálogo */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-400 mb-1">SKUs en catálogo</p>
            <p className="text-3xl font-black">{metricas.productos.toLocaleString('es-AR')}</p>
          </div>

          {/* Incidencias por tipo */}
          {incPorTipo.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                Por tipo · últimos 30 días
              </p>
              <div className="space-y-2">
                {incPorTipo.map(([tipo, count]) => {
                  const max = incPorTipo[0][1]
                  return (
                    <div key={tipo}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{TIPO_LABEL[tipo] ?? tipo}</span>
                        <span className="font-bold">{count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-black rounded-full"
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
