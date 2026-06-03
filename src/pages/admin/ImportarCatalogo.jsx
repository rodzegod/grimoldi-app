import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'
import { parseGrimoldiExcel } from '../../utils/grimoldiParser'

export default function ImportarCatalogo() {
  const { localId } = useLocal()
  const [productos, setProductos] = useState([])
  const [paso, setPaso] = useState('idle') // idle | parsing | preview | uploading | done | error
  const [progreso, setProgreso] = useState(0)
  const [error, setError] = useState('')
  const fileRef = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setPaso('parsing')
    setError('')
    try {
      const parsed = await parseGrimoldiExcel(file)
      if (parsed.length === 0) throw new Error('No se encontraron productos en el archivo')
      setProductos(parsed)
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
      const chunk = productos.slice(i, i + BATCH).map(p => ({ ...p, local_id: localId }))
      const { error } = await supabase
        .from('productos')
        .upsert(chunk, { onConflict: 'codigo,medida,local_id' })
      if (error) errores++
      setProgreso(Math.min(100, Math.round(((i + BATCH) / productos.length) * 100)))
    }

    if (errores > 0) {
      setError(`Importación parcial — ${errores} lotes con error`)
    }
    setPaso('done')
  }

  function reset() {
    setProductos([])
    setPaso('idle')
    setError('')
    setProgreso(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">Importar Catálogo</h1>
      <p className="text-sm text-gray-400 mb-5">Excel de Grimoldi — formato de reporte de stock</p>

      {paso === 'idle' && (
        <label className="block cursor-pointer">
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-black transition">
            <p className="text-4xl mb-3">⬆</p>
            <p className="font-semibold">Seleccionar archivo .xlsx</p>
            <p className="text-sm text-gray-400 mt-1">Reporte de stock de Grimoldi</p>
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
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-emerald-700">{productos.length.toLocaleString()} SKUs encontrados</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {new Set(productos.map(p => p.codigo)).size} productos únicos ·{' '}
                {new Set(productos.map(p => p.familia)).size} familias
              </p>
            </div>
            <span className="text-2xl">✓</span>
          </div>

          {/* Preview tabla */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Código', 'Familia', 'Marca', 'Modelo', 'Talle', 'Género'].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productos.slice(0, 20).map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono">{p.codigo}</td>
                      <td className="px-3 py-2">{p.familia}</td>
                      <td className="px-3 py-2">{p.marca}</td>
                      <td className="px-3 py-2">{p.modelo}</td>
                      <td className="px-3 py-2">{p.medida}</td>
                      <td className="px-3 py-2">{p.genero}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {productos.length > 20 && (
              <p className="text-xs text-gray-400 text-center py-2">
                +{(productos.length - 20).toLocaleString()} más...
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 border border-gray-200 rounded-xl py-3 text-sm">
              Cancelar
            </button>
            <button onClick={importar} className="flex-1 bg-black text-white rounded-xl py-3 text-sm font-bold">
              Importar {productos.length.toLocaleString()} SKUs
            </button>
          </div>
        </div>
      )}

      {paso === 'uploading' && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-semibold mb-3">Importando...</p>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden max-w-xs mx-auto">
            <div className="h-full bg-black rounded-full transition-all" style={{ width: `${progreso}%` }} />
          </div>
          <p className="text-sm text-gray-400 mt-2">{progreso}%</p>
        </div>
      )}

      {paso === 'done' && (
        <div className="text-center py-10">
          <div className="text-5xl mb-3">{error ? '⚠' : '✓'}</div>
          <p className="font-bold text-lg mb-1">
            {error ? 'Importación con advertencias' : '¡Importación completada!'}
          </p>
          {error && <p className="text-sm text-amber-600 mb-3">{error}</p>}
          <p className="text-sm text-gray-400 mb-6">
            {productos.length.toLocaleString()} SKUs procesados
          </p>
          <button onClick={reset} className="bg-black text-white rounded-xl px-6 py-3 text-sm font-bold">
            Importar otro archivo
          </button>
        </div>
      )}

      {paso === 'error' && (
        <div className="text-center py-10">
          <div className="text-5xl mb-3">✕</div>
          <p className="font-bold text-lg mb-1">Error al parsear</p>
          <p className="text-sm text-red-500 mb-6">{error}</p>
          <button onClick={reset} className="bg-black text-white rounded-xl px-6 py-3 text-sm font-bold">
            Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  )
}
