import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useLocal } from '../../hooks/useLocal'
import BarcodeScanner from '../../components/BarcodeScanner'

const TIPOS = [
  { value: 'talle_faltante', label: 'Talle faltante' },
  { value: 'par_incompleto', label: 'Par incompleto' },
  { value: 'pies_cruzados', label: 'Pies cruzados' },
  { value: 'defecto_producto', label: 'Defecto de producto' },
  { value: 'otro', label: 'Otro' },
]

export default function NuevaIncidencia() {
  const { usuario } = useAuth()
  const { localId } = useLocal()
  const navigate = useNavigate()

  const [tipo, setTipo] = useState('talle_faltante')
  const [prioridad, setPrioridad] = useState('Normal')
  const [descripcion, setDescripcion] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState([])
  const [productoSel, setProductoSel] = useState(null)
  const [zonas, setZonas] = useState([])
  const [zonaId, setZonaId] = useState('')
  const [scanner, setScanner] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (localId) {
      supabase.from('zonas').select('*').eq('local_id', localId).order('orden')
        .then(({ data }) => setZonas(data ?? []))
    }
  }, [localId])

  async function buscarProducto(q) {
    setBusqueda(q)
    setProductoSel(null)
    if (q.length < 2) { setProductos([]); return }
    const { data } = await supabase
      .from('productos')
      .select('id, codigo, modelo, medida, marca')
      .eq('local_id', localId)
      .or(`codigo.ilike.%${q}%,modelo.ilike.%${q}%`)
      .limit(10)
    setProductos(data ?? [])
  }

  function onScan(codigo) {
    setScanner(false)
    buscarProducto(codigo)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase.from('incidencias').insert({
      tipo,
      prioridad,
      descripcion: descripcion || null,
      producto_id: productoSel?.id ?? null,
      zona_id: zonaId || null,
      reportado_por: usuario.id,
      local_id: localId,
    })
    setGuardando(false)
    if (!error) {
      setOk(true)
      setTimeout(() => navigate('/vendedor/incidencias'), 1500)
    }
  }

  if (ok) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-5xl mb-4">✓</div>
        <p className="font-semibold text-lg">Incidencia reportada</p>
        <p className="text-gray-400 text-sm mt-1">Redirigiendo...</p>
      </div>
    )
  }

  return (
    <div>
      {scanner && <BarcodeScanner onScan={onScan} onClose={() => setScanner(false)} />}

      <h1 className="text-xl font-bold mb-4">Reportar incidencia</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Tipo de incidencia</label>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={`text-left text-sm px-3 py-2.5 rounded-xl border transition
                  ${tipo === t.value ? 'bg-black text-white border-black' : 'bg-white border-gray-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Producto */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Producto</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Buscar por código o modelo..."
              value={productoSel ? `${productoSel.codigo} — ${productoSel.modelo} T${productoSel.medida}` : busqueda}
              onChange={e => buscarProducto(e.target.value)}
              onFocus={() => productoSel && setProductoSel(null)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black"
            />
            <button
              type="button"
              onClick={() => setScanner(true)}
              className="px-3 py-2.5 bg-gray-100 rounded-xl text-lg"
            >
              📷
            </button>
          </div>
          {productos.length > 0 && !productoSel && (
            <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden divide-y">
              {productos.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setProductoSel(p); setProductos([]); setBusqueda('') }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50"
                >
                  <span className="font-mono text-xs text-gray-400 mr-2">{p.codigo}</span>
                  {p.modelo} · T{p.medida}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zona */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Zona del local</label>
          <select
            value={zonaId}
            onChange={e => setZonaId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black bg-white"
          >
            <option value="">— Sin zona —</option>
            {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </div>

        {/* Prioridad */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Prioridad</label>
          <div className="flex gap-2">
            {['Normal', 'Urgente'].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPrioridad(p)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition
                  ${prioridad === p
                    ? p === 'Urgente' ? 'bg-red-500 text-white border-red-500' : 'bg-black text-white border-black'
                    : 'bg-white border-gray-200 text-gray-600'}`}
              >
                {p === 'Urgente' ? '🔴 Urgente' : 'Normal'}
              </button>
            ))}
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Descripción (opcional)</label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            rows={2}
            placeholder="Detalles adicionales..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="w-full bg-black text-white font-bold rounded-xl py-3.5 text-sm disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Reportar incidencia'}
        </button>
      </form>
    </div>
  )
}
