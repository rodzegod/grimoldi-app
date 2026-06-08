import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useLocal } from '../../hooks/useLocal'
import BarcodeScanner from '../../components/BarcodeScanner'

const TIPOS = [
  { value: 'hurto_robo',     label: 'Hurto / Robo',       icon: '🔒' },
  { value: 'rotura_dano',    label: 'Rotura / Daño',       icon: '💥' },
  { value: 'faltante_stock', label: 'Faltante de stock',   icon: '📦' },
  { value: 'error_admin',    label: 'Error administrativo', icon: '📋' },
  { value: 'devolucion',     label: 'Devolución',          icon: '↩️' },
  { value: 'deterioro_falla',label: 'Deterioro / Falla',   icon: '⚠️' },
  { value: 'otro',           label: 'Otro',                icon: '•' },
]

export default function NuevaIncidencia() {
  const { usuario } = useAuth()
  const { localId } = useLocal()
  const navigate = useNavigate()

  const [tipo, setTipo] = useState('hurto_robo')
  const [prioridad, setPrioridad] = useState('Normal')
  const [descripcion, setDescripcion] = useState('')
  const [unidades, setUnidades] = useState(1)
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState([])
  const [productoSel, setProductoSel] = useState(null)
  const [zonas, setZonas] = useState([])
  const [zonaId, setZonaId] = useState('')
  const [scanner, setScanner] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState('')

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
    setError('')
    if (tipo === 'otro' && !descripcion.trim()) {
      setError('Para "Otro" necesitás describir qué pasó.')
      return
    }
    if (unidades < 1) { setError('Las unidades deben ser al menos 1.'); return }
    setGuardando(true)
    const { error: err } = await supabase.from('incidencias').insert({
      tipo,
      prioridad,
      descripcion: descripcion.trim() || null,
      unidades,
      producto_id: productoSel?.id ?? null,
      zona_id: zonaId || null,
      reportado_por: usuario.id,
      local_id: localId,
    })
    setGuardando(false)
    if (err) {
      setError(err.message)
    } else {
      setOk(true)
      setTimeout(() => navigate(-1), 1500)
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
                className={`text-left text-sm px-3 py-2.5 rounded-xl border transition flex items-center gap-2
                  ${tipo === t.value ? 'bg-black text-white border-black' : 'bg-white border-gray-200'}`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Unidades */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Unidades afectadas</label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setUnidades(v => Math.max(1, v - 1))}
              className="w-10 h-10 rounded-xl border border-gray-200 text-xl font-bold flex items-center justify-center">−</button>
            <span className="w-10 text-center text-xl font-black tabular-nums">{unidades}</span>
            <button type="button" onClick={() => setUnidades(v => v + 1)}
              className="w-10 h-10 rounded-xl border border-gray-200 text-xl font-bold flex items-center justify-center">+</button>
            <span className="text-sm text-gray-400">pares / unidades</span>
          </div>
        </div>

        {/* Producto */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Producto <span className="text-gray-400 font-normal">(opcional)</span></label>
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
          <label className="block text-sm font-medium mb-1.5">Zona del local <span className="text-gray-400 font-normal">(opcional)</span></label>
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
                    ? p === 'Urgente' ? 'bg-vans-red text-white border-vans-red' : 'bg-black text-white border-black'
                    : 'bg-white border-gray-200 text-gray-600'}`}
              >
                {p === 'Urgente' ? '🔴 Urgente' : 'Normal'}
              </button>
            ))}
          </div>
        </div>

        {/* Nota */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            {tipo === 'otro' ? 'Descripción (obligatoria)' : 'Descripción (opcional)'}
          </label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            rows={tipo === 'otro' ? 3 : 2}
            placeholder={tipo === 'otro' ? 'Describí qué pasó...' : 'Detalles adicionales...'}
            className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black resize-none
              ${tipo === 'otro' && !descripcion.trim() ? 'border-red-300' : 'border-gray-200'}`}
          />
        </div>

        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

        <button
          type="submit"
          disabled={guardando}
          className="w-full bg-vans-red text-white font-bold rounded-xl py-3.5 text-sm disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Reportar incidencia'}
        </button>
      </form>
    </div>
  )
}
