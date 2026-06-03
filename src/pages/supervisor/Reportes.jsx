import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'
import { exportarExcel } from '../../utils/exportExcel'

export default function Reportes() {
  const { localId } = useLocal()
  const [tab, setTab] = useState('incidencias')
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7)
    return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0])
  const [datos, setDatos] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (localId) fetchDatos()
  }, [localId, tab, desde, hasta])

  async function fetchDatos() {
    setLoading(true)
    if (tab === 'incidencias') {
      const { data } = await supabase
        .from('incidencias')
        .select(`tipo, prioridad, estado, descripcion, nota_resolucion, created_at, resuelto_at,
          productos(codigo, modelo, medida), zonas(nombre),
          usuarios!incidencias_reportado_por_fkey(nombre)`)
        .eq('local_id', localId)
        .gte('created_at', `${desde}T00:00:00`)
        .lte('created_at', `${hasta}T23:59:59`)
        .order('created_at', { ascending: false })
      setDatos(data ?? [])
    } else {
      const { data } = await supabase
        .from('tareas')
        .select(`titulo, tipo, turno, prioridad, estado, fecha, completado_at,
          usuarios!tareas_asignado_a_fkey(nombre)`)
        .eq('local_id', localId)
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: false })
      setDatos(data ?? [])
    }
    setLoading(false)
  }

  function exportar() {
    if (datos.length === 0) return
    const flat = tab === 'incidencias'
      ? datos.map(d => ({
          Tipo: d.tipo,
          Prioridad: d.prioridad,
          Estado: d.estado,
          Producto: d.productos ? `${d.productos.codigo} ${d.productos.modelo} T${d.productos.medida}` : '',
          Zona: d.zonas?.nombre ?? '',
          ReportadoPor: d.usuarios?.nombre ?? '',
          Descripcion: d.descripcion ?? '',
          NotaResolucion: d.nota_resolucion ?? '',
          Creada: new Date(d.created_at).toLocaleString('es-AR'),
          Resuelta: d.resuelto_at ? new Date(d.resuelto_at).toLocaleString('es-AR') : '',
        }))
      : datos.map(d => ({
          Titulo: d.titulo,
          Tipo: d.tipo,
          Turno: d.turno,
          Prioridad: d.prioridad,
          Estado: d.estado,
          Asignado: d.usuarios?.nombre ?? '',
          Fecha: d.fecha,
          Completada: d.completado_at ? new Date(d.completado_at).toLocaleString('es-AR') : '',
        }))
    exportarExcel(flat, `reporte_${tab}_${desde}_${hasta}`, tab)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Reportes</h1>
        <button
          onClick={exportar}
          disabled={datos.length === 0}
          className="bg-black text-white text-sm rounded-xl px-4 py-2 disabled:opacity-40"
        >
          ↓ Excel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-4 text-sm">
        {['incidencias', 'tareas'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 capitalize ${tab === t ? 'bg-black text-white' : 'text-gray-500'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filtros de fecha */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <label className="text-xs text-gray-400">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black mt-0.5"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-400">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black mt-0.5"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : datos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Sin datos en el período</div>
      ) : (
        <div>
          <p className="text-xs text-gray-400 mb-2">{datos.length} registros</p>
          <div className="space-y-2">
            {tab === 'incidencias' ? datos.map((d, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">{d.tipo?.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-400">
                      {d.productos ? `${d.productos.codigo} · ${d.productos.modelo}` : '—'}
                      {d.zonas ? ` · ${d.zonas.nombre}` : ''}
                    </p>
                    <p className="text-xs text-gray-300">{d.usuarios?.nombre} · {new Date(d.created_at).toLocaleDateString('es-AR')}</p>
                  </div>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${
                    d.estado === 'resuelta' ? 'bg-emerald-100 text-emerald-700' :
                    d.estado === 'en_proceso' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>{d.estado}</span>
                </div>
              </div>
            )) : datos.map((d, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{d.titulo}</p>
                  <p className="text-xs text-gray-400">{d.tipo} · {d.turno} · {d.usuarios?.nombre ?? '—'} · {d.fecha}</p>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 ${
                  d.estado === 'completada' ? 'bg-emerald-100 text-emerald-700' :
                  d.estado === 'en_progreso' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-500'
                }`}>{d.estado}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
