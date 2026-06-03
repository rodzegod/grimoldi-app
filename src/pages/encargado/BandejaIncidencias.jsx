import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'

const ESTADO_CONFIG = {
  abierta: { label: 'Abierta', cls: 'bg-red-100 text-red-700' },
  en_proceso: { label: 'En proceso', cls: 'bg-amber-100 text-amber-700' },
  resuelta: { label: 'Resuelta', cls: 'bg-emerald-100 text-emerald-700' },
}

const TIPO_LABEL = {
  talle_faltante: 'Talle faltante',
  par_incompleto: 'Par incompleto',
  pies_cruzados: 'Pies cruzados',
  defecto_producto: 'Defecto',
  otro: 'Otro',
}

export default function BandejaIncidencias() {
  const { localId } = useLocal()
  const [incidencias, setIncidencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('abierta')
  const [vendedores, setVendedores] = useState([])
  const [gestionando, setGestionando] = useState(null)
  const [nota, setNota] = useState('')
  const [asignadoA, setAsignadoA] = useState('')

  useEffect(() => {
    if (localId) { fetchIncidencias(); fetchVendedores() }
  }, [localId, filtro])

  async function fetchIncidencias() {
    setLoading(true)
    let q = supabase
      .from('incidencias')
      .select(`*, productos(codigo, modelo, medida), zonas(nombre), usuarios!incidencias_reportado_por_fkey(nombre)`)
      .eq('local_id', localId)
      .order('created_at', { ascending: false })

    if (filtro !== 'todas') q = q.eq('estado', filtro)
    const { data } = await q.limit(50)
    setIncidencias(data ?? [])
    setLoading(false)
  }

  async function fetchVendedores() {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .eq('local_id', localId)
      .in('rol', ['vendedor', 'encargado'])
    setVendedores(data ?? [])
  }

  async function actualizarEstado(id, estado) {
    const extra = estado === 'resuelta'
      ? { resuelto_at: new Date().toISOString(), nota_resolucion: nota || null }
      : {}
    await supabase.from('incidencias').update({
      estado,
      asignado_a: asignadoA || null,
      ...extra,
    }).eq('id', id)
    setGestionando(null)
    setNota('')
    setAsignadoA('')
    fetchIncidencias()
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Bandeja de Incidencias</h1>

      {/* Filtros */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {[
          { v: 'abierta', l: 'Abiertas' },
          { v: 'en_proceso', l: 'En proceso' },
          { v: 'resuelta', l: 'Resueltas' },
          { v: 'todas', l: 'Todas' },
        ].map(f => (
          <button
            key={f.v}
            onClick={() => setFiltro(f.v)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap border transition
              ${filtro === f.v ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500'}`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : incidencias.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No hay incidencias en esta vista</div>
      ) : (
        <div className="space-y-3">
          {incidencias.map(inc => {
            const ec = ESTADO_CONFIG[inc.estado] ?? { label: inc.estado, cls: 'bg-gray-100' }
            return (
              <div key={inc.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{TIPO_LABEL[inc.tipo] ?? inc.tipo}</p>
                      {inc.prioridad === 'Urgente' && (
                        <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5">Urgente</span>
                      )}
                    </div>
                    {inc.productos && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {inc.productos.codigo} · {inc.productos.modelo} T{inc.productos.medida}
                      </p>
                    )}
                    {inc.zonas && <p className="text-xs text-gray-400">{inc.zonas.nombre}</p>}
                    {inc.descripcion && <p className="text-xs text-gray-600 mt-1">{inc.descripcion}</p>}
                    {inc.nota_resolucion && (
                      <p className="text-xs text-emerald-600 mt-1">✓ {inc.nota_resolucion}</p>
                    )}
                    <p className="text-xs text-gray-300 mt-1.5">
                      Por {inc.usuarios?.nombre} ·{' '}
                      {new Date(inc.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  <span className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap ${ec.cls}`}>
                    {ec.label}
                  </span>
                </div>

                {inc.estado !== 'resuelta' && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    {gestionando === inc.id ? (
                      <div className="space-y-2">
                        <select
                          value={asignadoA}
                          onChange={e => setAsignadoA(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                          <option value="">— Asignar a —</option>
                          {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                        </select>
                        <textarea
                          placeholder="Nota de resolución (opcional)"
                          value={nota}
                          onChange={e => setNota(e.target.value)}
                          rows={2}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                        />
                        <div className="flex gap-2">
                          {inc.estado === 'abierta' && (
                            <button
                              onClick={() => actualizarEstado(inc.id, 'en_proceso')}
                              className="flex-1 text-xs bg-amber-100 text-amber-700 rounded-lg py-2 font-medium"
                            >
                              En proceso
                            </button>
                          )}
                          <button
                            onClick={() => actualizarEstado(inc.id, 'resuelta')}
                            className="flex-1 text-xs bg-emerald-100 text-emerald-700 rounded-lg py-2 font-medium"
                          >
                            Resolver
                          </button>
                          <button
                            onClick={() => { setGestionando(null); setNota(''); setAsignadoA('') }}
                            className="text-xs text-gray-400 px-3"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setGestionando(inc.id)}
                        className="w-full text-xs text-gray-500 border border-gray-200 rounded-lg py-2 hover:border-black transition"
                      >
                        Gestionar
                      </button>
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
