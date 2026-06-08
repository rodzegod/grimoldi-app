import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'
import { exportarExcel } from '../../utils/exportExcel'

export default function ControlStock() {
  const { localId } = useLocal()
  const hoy = new Date().toISOString().split('T')[0]
  const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const [fechaA, setFechaA] = useState(hoy)
  const [fechaB, setFechaB] = useState(ayer)
  const [stockA, setStockA] = useState([])  // snapshot fecha A
  const [stockB, setStockB] = useState([])  // snapshot fecha B
  const [loading, setLoading] = useState(false)
  const [soloConMovimiento, setSoloConMovimiento] = useState(false)
  const [vista, setVista] = useState('comparativa') // comparativa | agotados | resumen

  useEffect(() => {
    if (localId) fetchStock()
  }, [localId, fechaA, fechaB])

  async function fetchStock() {
    setLoading(true)
    const [{ data: dA }, { data: dB }] = await Promise.all([
      supabase.from('stock_historial').select('codigo,medida,modelo,familia,stock').eq('local_id', localId).eq('fecha', fechaA),
      supabase.from('stock_historial').select('codigo,medida,modelo,familia,stock').eq('local_id', localId).eq('fecha', fechaB),
    ])
    setStockA(dA ?? [])
    setStockB(dB ?? [])
    setLoading(false)
  }

  // Comparativa: join por codigo+medida
  const comparativa = useMemo(() => {
    const mapB = {}
    stockB.forEach(s => { mapB[`${s.codigo}-${s.medida}`] = s.stock ?? 0 })

    return stockA.map(s => {
      const key = `${s.codigo}-${s.medida}`
      const sB = mapB[key] ?? null
      const diff = sB !== null ? (s.stock ?? 0) - sB : null
      return { ...s, stockA: s.stock ?? 0, stockB: sB, diff }
    }).filter(s => !soloConMovimiento || (s.diff !== null && s.diff !== 0))
      .sort((a, b) => (a.diff ?? 0) - (b.diff ?? 0))
  }, [stockA, stockB, soloConMovimiento])

  // Agotados: de stock > 0 (en B) a stock = 0 (en A)
  const agotados = useMemo(() => {
    const mapB = {}
    stockB.forEach(s => { mapB[`${s.codigo}-${s.medida}`] = { stock: s.stock ?? 0, modelo: s.modelo, familia: s.familia } })

    const res = []
    stockA.forEach(s => {
      const key = `${s.codigo}-${s.medida}`
      const b = mapB[key]
      if (b && b.stock > 0 && (s.stock ?? 0) === 0) {
        res.push({ codigo: s.codigo, medida: s.medida, modelo: s.modelo ?? b.modelo, familia: s.familia ?? b.familia })
      }
    })
    // Agrupar por modelo
    const porModelo = {}
    res.forEach(r => {
      const m = r.modelo ?? r.codigo
      if (!porModelo[m]) porModelo[m] = { modelo: m, familia: r.familia, talles: [] }
      porModelo[m].talles.push(r.medida)
    })
    return Object.values(porModelo)
  }, [stockA, stockB])

  const totalIngresado = useMemo(() => comparativa.filter(s => (s.diff ?? 0) > 0).reduce((sum, s) => sum + (s.diff ?? 0), 0), [comparativa])
  const totalSalido = useMemo(() => Math.abs(comparativa.filter(s => (s.diff ?? 0) < 0).reduce((sum, s) => sum + (s.diff ?? 0), 0)), [comparativa])

  function exportar() {
    if (!comparativa.length) return
    exportarExcel(comparativa.map(r => ({
      Codigo: r.codigo, Modelo: r.modelo, Talle: r.medida,
      [`Stock ${fechaA}`]: r.stockA, [`Stock ${fechaB}`]: r.stockB ?? '—',
      Diferencia: r.diff ?? '—',
    })), `stock_comparativa_${fechaA}_${fechaB}`, 'Stock')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Control de Stock</h1>
        <button onClick={exportar} disabled={!comparativa.length}
          className="border border-gray-900 text-gray-900 text-xs rounded-xl px-3 py-2 font-medium disabled:opacity-40">↓ Excel</button>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <label className="text-xs text-gray-400 block mb-1">Fecha A (principal)</label>
          <input type="date" value={fechaA} onChange={e => setFechaA(e.target.value)} max={hoy}
            className="w-full text-sm font-medium focus:outline-none" />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <label className="text-xs text-gray-400 block mb-1">Fecha B (comparar)</label>
          <input type="date" value={fechaB} onChange={e => setFechaB(e.target.value)} max={hoy}
            className="w-full text-sm font-medium focus:outline-none" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-4 text-xs">
        {[['comparativa','Comparativa'],['agotados',`Agotados (${agotados.length})`],['resumen','Resumen']].map(([v,l]) => (
          <button key={v} onClick={() => setVista(v)}
            className={`flex-1 py-2 font-medium ${vista === v ? 'bg-black text-white' : 'text-gray-500'}`}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* A — Comparativa */}
          {vista === 'comparativa' && (
            <>
              {stockA.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-700">
                  No hay reporte de stock para {fechaA}. Importá el Excel de Grimoldi primero.
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <label className="text-xs text-gray-500 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={soloConMovimiento}
                    onChange={e => setSoloConMovimiento(e.target.checked)} className="rounded" />
                  Solo con movimiento
                </label>
                <span className="text-xs text-gray-400 ml-auto">{comparativa.length} SKUs</span>
              </div>
              <div className="overflow-x-auto -mx-4">
                <table className="w-full text-xs min-w-[400px]">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>{['Código','Modelo','Talle',fechaA,fechaB,'Dif.'].map(h => (
                      <th key={h} className="py-2 px-3 text-left font-medium text-gray-500">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {comparativa.map((r, i) => (
                      <tr key={i} className={r.diff !== null && r.diff !== 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="py-2 px-3 font-mono text-gray-400">{r.codigo}</td>
                        <td className="py-2 px-3 font-medium truncate max-w-[120px]">{r.modelo}</td>
                        <td className="py-2 px-3">{r.medida}</td>
                        <td className="py-2 px-3 text-right font-bold">{r.stockA}</td>
                        <td className="py-2 px-3 text-right text-gray-400">{r.stockB ?? '—'}</td>
                        <td className={`py-2 px-3 text-right font-black ${
                          (r.diff ?? 0) > 0 ? 'text-emerald-600' :
                          (r.diff ?? 0) < 0 ? 'text-red-500' : 'text-gray-300'
                        }`}>
                          {r.diff !== null ? (r.diff > 0 ? '+' : '') + r.diff : '—'}
                        </td>
                      </tr>
                    ))}
                    {comparativa.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-6 text-gray-400">Sin datos para comparar</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* B — Agotados */}
          {vista === 'agotados' && (
            <div>
              {agotados.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-3xl mb-2">✓</p>
                  <p>No hay talles agotados entre las fechas seleccionadas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agotados.map((a, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{a.modelo}</p>
                          <p className="text-xs text-gray-400">{a.familia}</p>
                        </div>
                        <span className="bg-red-100 text-red-600 text-xs rounded-full px-2 py-0.5">
                          {a.talles.length} talle{a.talles.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {a.talles.sort().map(t => (
                          <span key={t} className="bg-red-50 text-red-600 text-xs border border-red-200 rounded-full px-2 py-0.5">
                            T{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* C — Resumen */}
          {vista === 'resumen' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Ingresadas</p>
                  <p className="text-3xl font-black text-emerald-600">+{totalIngresado}</p>
                  <p className="text-xs text-gray-400 mt-1">unidades</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Salidas</p>
                  <p className="text-3xl font-black text-red-500">-{totalSalido}</p>
                  <p className="text-xs text-gray-400 mt-1">unidades</p>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-xs text-gray-400 mb-1">SKUs comparados</p>
                <p className="text-3xl font-black">{comparativa.length}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="text-xs text-gray-400 mb-1">Talles agotados</p>
                <p className="text-3xl font-black text-red-500">{agotados.reduce((s, a) => s + a.talles.length, 0)}</p>
              </div>
              <button onClick={exportar} disabled={!comparativa.length}
                className="w-full border border-gray-900 text-gray-900 rounded-xl py-3 text-sm font-medium disabled:opacity-40">
                Exportar comparativa Excel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
