import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'

export default function GestionZonas() {
  const { localId } = useLocal()
  const [zonas, setZonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuevaZona, setNuevaZona] = useState('')
  const [zonaActiva, setZonaActiva] = useState(null)
  const [asignados, setAsignados] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  // descripcion inline edit
  const [editandoDesc, setEditandoDesc] = useState(null) // producto_id
  const [descTemp, setDescTemp] = useState('')

  useEffect(() => {
    if (localId) fetchZonas()
  }, [localId])

  async function fetchZonas() {
    setLoading(true)
    const { data } = await supabase
      .from('zonas')
      .select('*')
      .eq('local_id', localId)
      .order('orden')
    setZonas(data ?? [])
    setLoading(false)
  }

  async function crearZona(e) {
    e.preventDefault()
    if (!nuevaZona.trim()) return
    await supabase.from('zonas').insert({ nombre: nuevaZona.trim(), local_id: localId, orden: zonas.length })
    setNuevaZona('')
    fetchZonas()
  }

  async function eliminarZona(id) {
    if (!confirm('¿Eliminar esta zona?')) return
    await supabase.from('zonas').delete().eq('id', id)
    if (zonaActiva === id) setZonaActiva(null)
    fetchZonas()
  }

  async function abrirZona(zona) {
    setZonaActiva(zona.id)
    setBusqueda('')
    setResultados([])
    setEditandoDesc(null)
    const { data } = await supabase
      .from('zona_productos')
      .select(`producto_id, productos(id, codigo, modelo, medida, familia, descripcion)`)
      .eq('zona_id', zona.id)
    setAsignados(data ?? [])
  }

  async function buscarProducto(q) {
    setBusqueda(q)
    if (q.length < 2) { setResultados([]); return }
    const { data } = await supabase
      .from('productos')
      .select('id, codigo, modelo, medida, familia')
      .eq('local_id', localId)
      .or(`codigo.ilike.%${q}%,modelo.ilike.%${q}%`)
      .limit(10)
    setResultados(data ?? [])
  }

  async function asignarProducto(producto) {
    if (asignados.some(a => a.producto_id === producto.id)) return
    await supabase.from('zona_productos').insert({ zona_id: zonaActiva, producto_id: producto.id })
    setResultados([])
    setBusqueda('')
    abrirZona({ id: zonaActiva })
  }

  async function desasignar(productoId) {
    await supabase.from('zona_productos').delete().eq('zona_id', zonaActiva).eq('producto_id', productoId)
    abrirZona({ id: zonaActiva })
  }

  function iniciarEditDesc(productoId, descActual) {
    setEditandoDesc(productoId)
    setDescTemp(descActual ?? '')
  }

  async function guardarDesc(productoId) {
    await supabase.from('productos').update({ descripcion: descTemp || null }).eq('id', productoId)
    setEditandoDesc(null)
    // Actualizar localmente sin re-fetch completo
    setAsignados(prev => prev.map(a =>
      a.producto_id === productoId
        ? { ...a, productos: { ...a.productos, descripcion: descTemp || null } }
        : a
    ))
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Gestión de Zonas</h1>

      <form onSubmit={crearZona} className="flex gap-2 mb-4">
        <input
          placeholder="Nombre de nueva zona..."
          value={nuevaZona}
          onChange={e => setNuevaZona(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black"
        />
        <button type="submit" className="bg-black text-white rounded-xl px-4 text-sm font-bold">
          + Zona
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {zonas.map(zona => (
            <div key={zona.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  className="flex-1 text-left font-medium text-sm"
                  onClick={() => zonaActiva === zona.id ? setZonaActiva(null) : abrirZona(zona)}
                >
                  {zona.nombre}
                </button>
                <button onClick={() => eliminarZona(zona.id)}
                  className="text-gray-300 hover:text-red-400 text-xl leading-none ml-3">×</button>
              </div>

              {zonaActiva === zona.id && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  {/* Buscar producto */}
                  <div className="relative">
                    <input
                      placeholder="Buscar y asignar producto..."
                      value={busqueda}
                      onChange={e => buscarProducto(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black"
                    />
                    {resultados.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl overflow-hidden z-10 divide-y shadow-lg">
                        {resultados.map(p => (
                          <button key={p.id} onClick={() => asignarProducto(p)}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50">
                            <span className="font-mono text-xs text-gray-400 mr-2">{p.codigo}</span>
                            {p.modelo} · T{p.medida}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Productos asignados */}
                  {asignados.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin productos asignados</p>
                  ) : (
                    <div className="space-y-2">
                      {asignados.map(a => {
                        const p = a.productos
                        const editando = editandoDesc === a.producto_id
                        return (
                          <div key={a.producto_id} className="bg-gray-50 rounded-xl px-3 py-2.5">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs text-gray-400">{p?.codigo}</span>
                                  <span className="text-sm font-medium truncate">{p?.modelo} · T{p?.medida}</span>
                                </div>
                                {/* Descripción editable */}
                                {editando ? (
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <input
                                      autoFocus
                                      value={descTemp}
                                      onChange={e => setDescTemp(e.target.value)}
                                      placeholder="Ej: Remera manga corta azul talle M"
                                      className="flex-1 text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-black"
                                    />
                                    <button onClick={() => guardarDesc(a.producto_id)}
                                      className="text-xs bg-black text-white rounded-lg px-2 py-1">OK</button>
                                    <button onClick={() => setEditandoDesc(null)}
                                      className="text-xs text-gray-400">✕</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => iniciarEditDesc(a.producto_id, p?.descripcion)}
                                    className="mt-1 text-xs text-left w-full"
                                  >
                                    {p?.descripcion
                                      ? <span className="text-gray-600">{p.descripcion}</span>
                                      : <span className="text-gray-300 italic">+ agregar descripción</span>
                                    }
                                  </button>
                                )}
                              </div>
                              <button onClick={() => desasignar(a.producto_id)}
                                className="text-gray-300 hover:text-red-400 text-xl leading-none ml-3 shrink-0">×</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
