import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useLocal } from '../../hooks/useLocal'

export default function MapaLocal() {
  const { usuario } = useAuth()
  const { localId } = useLocal()
  const [zonas, setZonas] = useState([])
  const [incidenciasPorZona, setIncidenciasPorZona] = useState({})
  const [loading, setLoading] = useState(true)
  const [zonaOpen, setZonaOpen] = useState(null)

  // Modal de movimiento
  const [modal, setModal] = useState(null) // { tipo, productoId, zonaId, nombreProd }
  const [motivo, setMotivo] = useState('')
  const [guardandoMov, setGuardandoMov] = useState(false)

  useEffect(() => {
    if (localId) fetchData()
  }, [localId])

  async function fetchData() {
    setLoading(true)
    const [{ data: zonasData }, { data: incData }] = await Promise.all([
      supabase
        .from('zonas')
        .select(`*, zona_productos(producto_id, productos(codigo, modelo, medida, familia, descripcion))`)
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

  function abrirModal(tipo, productoId, zonaId, nombreProd) {
    setModal({ tipo, productoId, zonaId, nombreProd })
    setMotivo('')
  }

  async function confirmarMovimiento() {
    if (!motivo.trim()) return
    setGuardandoMov(true)
    const { error } = await supabase.from('movimientos_stock').insert({
      producto_id: modal.productoId,
      zona_id: modal.zonaId,
      tipo: modal.tipo,
      cantidad: 1,
      motivo: motivo.trim(),
      registrado_por: usuario.id,
      local_id: localId,
    })
    setGuardandoMov(false)
    if (!error) {
      setModal(null)
      setMotivo('')
    }
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

      {/* Modal de movimiento */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-lg ${modal.tipo === 'entrada' ? 'text-emerald-500' : 'text-red-500'}`}>
                {modal.tipo === 'entrada' ? '▲' : '▼'}
              </span>
              <h3 className="font-bold capitalize">{modal.tipo} de stock</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4 truncate">{modal.nombreProd}</p>

            <label className="block text-sm font-medium mb-1.5">
              Motivo <span className="text-red-400">*</span>
            </label>
            <textarea
              autoFocus
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ej: reposición desde depósito, venta especial, traslado..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-black"
            />

            <div className="flex gap-2 mt-4">
              <button onClick={() => setModal(null)}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm">
                Cancelar
              </button>
              <button
                onClick={confirmarMovimiento}
                disabled={!motivo.trim() || guardandoMov}
                className={`flex-1 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-40
                  ${modal.tipo === 'entrada' ? 'bg-emerald-500' : 'bg-red-500'}`}
              >
                {guardandoMov ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                      productos.map(zp => {
                        const p = zp.productos
                        const nombreProd = `${p?.codigo} ${p?.modelo} T${p?.medida}`
                        return (
                          <div key={zp.producto_id} className="px-4 py-3 flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-gray-400 shrink-0">{p?.codigo}</span>
                                <p className="text-sm font-medium truncate">{p?.modelo} T{p?.medida}</p>
                              </div>
                              {p?.descripcion && (
                                <p className="text-xs text-gray-500 mt-0.5">{p.descripcion}</p>
                              )}
                              <p className="text-xs text-gray-300">{p?.familia}</p>
                            </div>
                            {/* Botones entrada / salida */}
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => abrirModal('entrada', zp.producto_id, zona.id, nombreProd)}
                                className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-100 transition flex items-center justify-center"
                                title="Entrada de stock"
                              >+</button>
                              <button
                                onClick={() => abrirModal('salida', zp.producto_id, zona.id, nombreProd)}
                                className="w-8 h-8 bg-red-50 text-red-500 rounded-lg text-sm font-bold hover:bg-red-100 transition flex items-center justify-center"
                                title="Salida de stock"
                              >−</button>
                            </div>
                          </div>
                        )
                      })
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
