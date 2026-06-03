import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'

export default function MapaLocal() {
  const { localId } = useLocal()
  const [zonas, setZonas] = useState([])
  const [incidenciasPorZona, setIncidenciasPorZona] = useState({})
  const [loading, setLoading] = useState(true)
  const [zonaOpen, setZonaOpen] = useState(null)

  useEffect(() => {
    if (localId) fetchData()
  }, [localId])

  async function fetchData() {
    setLoading(true)
    const [{ data: zonasData }, { data: incData }] = await Promise.all([
      supabase
        .from('zonas')
        .select(`*, zona_productos(producto_id, productos(codigo, modelo, medida, familia))`)
        .eq('local_id', localId)
        .order('orden'),
      supabase
        .from('incidencias')
        .select('zona_id')
        .eq('local_id', localId)
        .in('estado', ['abierta', 'en_proceso']),
    ])

    const conteo = {}
    ;(incData ?? []).forEach(i => {
      if (i.zona_id) conteo[i.zona_id] = (conteo[i.zona_id] ?? 0) + 1
    })

    setZonas(zonasData ?? [])
    setIncidenciasPorZona(conteo)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Mapa del local</h1>

      {zonas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No hay zonas configuradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {zonas.map(zona => {
            const alertas = incidenciasPorZona[zona.id] ?? 0
            const productos = zona.zona_productos ?? []
            const isOpen = zonaOpen === zona.id

            return (
              <div key={zona.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3.5"
                  onClick={() => setZonaOpen(isOpen ? null : zona.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${alertas > 0 ? 'bg-red-500' : 'bg-emerald-400'}`} />
                    <span className="font-medium text-sm">{zona.nombre}</span>
                    <span className="text-xs text-gray-400">{productos.length} SKUs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {alertas > 0 && (
                      <span className="bg-red-100 text-red-600 text-xs font-medium rounded-full px-2 py-0.5">
                        {alertas} incidencia{alertas > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {productos.length === 0 ? (
                      <p className="text-xs text-gray-400 px-4 py-3">Sin productos asignados</p>
                    ) : (
                      productos.map(zp => (
                        <div key={zp.producto_id} className="px-4 py-2.5 flex items-center gap-3">
                          <span className="font-mono text-xs text-gray-400 w-20 shrink-0">
                            {zp.productos?.codigo}
                          </span>
                          <div>
                            <p className="text-sm">{zp.productos?.modelo}</p>
                            <p className="text-xs text-gray-400">
                              T{zp.productos?.medida} · {zp.productos?.familia}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
