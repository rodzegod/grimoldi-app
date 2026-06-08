import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'
import { parseGrimoldiExcel } from '../../utils/grimoldiParser'

export default function ImportarCatalogo() {
  const { localId } = useLocal()
  const [productos, setProductos] = useState([])
  const [paso, setPaso] = useState('idle')
  const [progreso, setProgreso] = useState(0)
  const [error, setError] = useState('')
  const [stockExiste, setStockExiste] = useState(false)
  const fileRef = useRef()
  const hoy = new Date().toISOString().split('T')[0]

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setPaso('parsing')
    setError('')
    try {
      const parsed = await parseGrimoldiExcel(file)
      if (parsed.length === 0) throw new Error('No se encontraron productos en el archivo')
      setProductos(parsed)

      // Verificar si ya hay stock_historial para hoy
      const { count } = await supabase
        .from('stock_historial')
        .select('*', { count: 'exact', head: true })
        .eq('local_id', localId)
        .eq('fecha', hoy)
      setStockExiste((count ?? 0) > 0)
      setPaso('preview')
    } catch (err) {
      setError(err.message)
      setPaso('error')
    }
  }

  async function importar() {
    setPaso('uploading')
    setProgreso(0)
    const BATCH = 200
    let errores = 0

    for (let i = 0; i < productos.length; i += BATCH) {
      const chunk = productos.slice(i, i + BATCH)

      // 1. Upsert en productos (catálogo) — incluye stock_actual y stock_fecha
      const productosChunk = chunk.map(p => ({
        codigo: p.codigo, familia: p.familia, marca: p.marca,
        modelo: p.modelo, linea: p.linea, genero: p.genero,
        medida: p.medida, local_id: localId,
        stock_actual: p.stock ?? 0,
        stock_fecha: hoy,
      }))
      const { error: e1 } = await supabase
        .from('productos')
        .upsert(productosChunk, { onConflict: 'codigo,medida,local_id' })
      if (e1) errores++

      // 2. Upsert en stock_historial (snapshot del día)
      const histChunk = chunk.map(p => ({
        local_id: localId, fecha: hoy,
        codigo: p.codigo, medida: p.medida,
        familia: p.familia, marca: p.marca, modelo: p.modelo,
        stock: p.stock ?? 0,
      }))
      const { error: e2 } = await supabase
        .from('stock_historial')
        .upsert(histChunk, { onConflict: 'local_id,fecha,codigo,medida' })
      if (e2) errores++

      setProgreso(Math.min(100, Math.round(((i + BATCH) / productos.length) * 100)))
    }

    if (errores > 0) setError(`Importación parcial — ${errores} lotes con error`)
    setPaso('done')
  }

  function reset() {
    setProductos([])
    setPaso('idle')
    setError('')
    setProgreso(0)
    setStockExiste(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const conStock = productos.filter(p => (p.stock ?? 0) > 0).length

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Importar Catálogo</h1>
      <p className="text-sm text-gray-400 mb-5">Excel de Grimoldi · incluye stock del día</p>

      {paso === 'idle' && (
        <label className="block cursor-pointer">
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-black transition">
            <p className="text-4xl mb-3">⬆</p>
            <p className="font-semibold">Seleccionar archivo .xlsx</p>
            <p className="text-sm text-gray-400 mt-1">Reporte de stock de Grimoldi (col. R = stock)</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        </label>
      )}

      {paso === 'parsing' && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Parseando archivo...</p>
        </div>
      )}

      {paso === 'preview' && (
        <div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-emerald-700">{productos.length.toLocaleString()} SKUs encontrados</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {new Set(productos.map(p => p.codigo)).size} productos · {conStock} con stock > 0
              </p>
            </div>
            <span className="text-2xl">✓</span>
          </div>

          {stockExiste && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-700">
              Ya existe un reporte de stock para hoy ({hoy}). Se sobreescribirá.
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Código','Familia','Modelo','Talle','Stock'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium text-gray-500">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productos.slice(0, 15).map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono">{p.codigo}</td>
                      <td className="px-3 py-2">{p.familia}</td>
                      <td className="px-3 py-2">{p.modelo}</td>
                      <td className="px-3 py-2">{p.medida}</td>
                      <td className={`px-3 py-2 font-bold ${(p.stock ?? 0) > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {p.stock ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {productos.length > 15 && (
              <p className="text-xs text-gray-400 text-center py-2">+{(productos.length - 15).toLocaleString()} más...</p>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 border border-gray-900 text-gray-900 rounded-xl py-3 text-sm font-medium">Cancelar</button>
            <button onClick={importar} className="flex-1 bg-vans-red text-white rounded-xl py-3 text-sm font-bold">
              Importar {productos.length.toLocaleString()} SKUs
            </button>
          </div>
        </div>
      )}

      {paso === 'uploading' && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-semibold mb-3">Importando catálogo y stock...</p>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden max-w-xs mx-auto">
            <div className="h-full bg-black rounded-full transition-all" style={{ width: `${progreso}%` }} />
          </div>
          <p className="text-sm text-gray-400 mt-2">{progreso}%</p>
        </div>
      )}

      {paso === 'done' && (
        <div className="text-center py-10">
          <div className="text-5xl mb-3">{error ? '⚠' : '✓'}</div>
          <p className="font-bold text-lg mb-1">{error ? 'Con advertencias' : 'Importación completada'}</p>
          {error && <p className="text-sm text-amber-600 mb-3">{error}</p>}
          <p className="text-sm text-gray-400 mb-6">{productos.length.toLocaleString()} SKUs · {conStock} con stock</p>
          <button onClick={reset} className="bg-vans-red text-white rounded-xl px-6 py-3 text-sm font-bold">
            Importar otro archivo
          </button>
        </div>
      )}

      {paso === 'error' && (
        <div className="text-center py-10">
          <div className="text-5xl mb-3">✕</div>
          <p className="font-bold text-lg mb-1">Error al parsear</p>
          <p className="text-sm text-red-500 mb-6">{error}</p>
          <button onClick={reset} className="bg-black text-white rounded-xl px-6 py-3 text-sm font-bold">Intentar de nuevo</button>
        </div>
      )}
    </div>
  )
}
