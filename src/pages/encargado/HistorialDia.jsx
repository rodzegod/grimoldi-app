import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'

export default function HistorialDia() {
  const { localId } = useLocal()
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [tareas, setTareas] = useState([])
  const [incidencias, setIncidencias] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (localId) fetchHistorial()
  }, [localId, fecha])

  async function fetchHistorial() {
    setLoading(true)
    const [{ data: t }, { data: i }] = await Promise.all([
      supabase
        .from('tareas')
        .select(`*, usuarios!tareas_asignado_a_fkey(nombre)`)
        .eq('local_id', localId)
        .eq('fecha', fecha)
        .order('created_at'),
      supabase
        .from('incidencias')
        .select(`*, productos(codigo, modelo), zonas(nombre), usuarios!incidencias_reportado_por_fkey(nombre)`)
        .eq('local_id', localId)
        .gte('created_at', `${fecha}T00:00:00`)
        .lte('created_at', `${fecha}T23:59:59`)
        .order('created_at'),
    ])
    setTareas(t ?? [])
    setIncidencias(i ?? [])
    setLoading(false)
  }

  const tareasComp = tareas.filter(t => t.estado === 'completada').length
  const incResueltas = incidencias.filter(i => i.estado === 'resuelta').length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Historial del día</h1>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black"
        />
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold">{tareasComp}/{tareas.length}</p>
          <p className="text-xs text-gray-400 mt-1">Tareas completadas</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold">{incidencias.length}</p>
          <p className="text-xs text-gray-400 mt-1">Incidencias ({incResueltas} resueltas)</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <h2 className="font-semibold text-sm mb-2">Tareas</h2>
          <div className="space-y-2 mb-5">
            {tareas.length === 0 ? (
              <p className="text-sm text-gray-400">Sin tareas registradas</p>
            ) : tareas.map(t => (
              <div key={t.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{t.titulo}</p>
                  <p className="text-xs text-gray-400">{t.tipo === 'Admin' ? 'Administrativo' : t.tipo} · {t.turno} · {t.usuarios?.nombre ?? '—'}</p>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 ${
                  t.estado === 'completada' ? 'bg-emerald-100 text-emerald-700' :
                  t.estado === 'en_progreso' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {t.estado}
                </span>
              </div>
            ))}
          </div>

          <h2 className="font-semibold text-sm mb-2">Incidencias</h2>
          <div className="space-y-2">
            {incidencias.length === 0 ? (
              <p className="text-sm text-gray-400">Sin incidencias registradas</p>
            ) : incidencias.map(i => (
              <div key={i.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{i.tipo.replace('_', ' ')}</p>
                  <p className="text-xs text-gray-400">
                    {i.productos ? `${i.productos.codigo} · ${i.productos.modelo}` : 'Sin producto'}
                    {i.zonas ? ` · ${i.zonas.nombre}` : ''}
                  </p>
                  <p className="text-xs text-gray-300">Por {i.usuarios?.nombre}</p>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 ${
                  i.estado === 'resuelta' ? 'bg-emerald-100 text-emerald-700' :
                  i.estado === 'en_proceso' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {i.estado}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
