import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'
import { exportarExcel } from '../../utils/exportExcel'

const TIPO_LABEL = { Admin: 'Administrativo', Operativo: 'Operativo', Liderazgo: 'Liderazgo' }

function fmt$(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n ?? 0)
}
function fmtN(n, dec = 2) {
  return (n ?? 0).toFixed(dec)
}

function diasEnMes(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function semanaDelMes(fechaStr) {
  const d = new Date(fechaStr + 'T12:00:00')
  return Math.ceil(d.getDate() / 7)
}

const MIX_COLOR = (mix) =>
  mix >= 2.5 ? 'text-emerald-600 font-bold' :
  mix >= 2.0 ? 'text-amber-500 font-bold' :
  'text-red-500 font-bold'

export default function ReporteVentas({ readOnly = false }) {
  const { localId } = useLocal()
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth())
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [ventas, setVentas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('kpis') // kpis | diario | semanal | vendedor
  const [objetivo, setObjetivo] = useState('')
  const [form, setForm] = useState({ fecha: hoy.toISOString().split('T')[0], vendedor_id: '', calzado: '', indumentaria: '', accesorios: '', monto_total: '', comprobantes: '' })
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  // Objetivo desde localStorage
  const OBJ_KEY = `objetivo_${anio}_${mes + 1}`
  useEffect(() => {
    const saved = localStorage.getItem(OBJ_KEY)
    if (saved) setObjetivo(saved)
    else setObjetivo('')
  }, [mes, anio])

  function guardarObjetivo(val) {
    setObjetivo(val)
    if (val) localStorage.setItem(OBJ_KEY, val)
    else localStorage.removeItem(OBJ_KEY)
  }

  useEffect(() => {
    if (localId) { fetchVentas(); fetchVendedores() }
  }, [localId, mes, anio])

  async function fetchVentas() {
    setLoading(true)
    const desde = `${anio}-${String(mes + 1).padStart(2, '0')}-01`
    const hasta = `${anio}-${String(mes + 1).padStart(2, '0')}-${diasEnMes(anio, mes)}`
    const { data } = await supabase
      .from('ventas_diarias')
      .select(`*, usuarios!ventas_diarias_vendedor_id_fkey(nombre)`)
      .eq('local_id', localId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha')
    setVentas(data ?? [])
    setLoading(false)
  }

  async function fetchVendedores() {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nombre')
      .eq('local_id', localId)
      .in('rol', ['vendedor', 'encargado'])
      .order('nombre')
    setVendedores(data ?? [])
    if (data?.length && !form.vendedor_id) setForm(f => ({ ...f, vendedor_id: data[0].id }))
  }

  async function guardarVenta(e) {
    e.preventDefault()
    setGuardando(true)
    const row = {
      fecha: form.fecha,
      vendedor_id: form.vendedor_id,
      local_id: localId,
      calzado: parseInt(form.calzado) || 0,
      indumentaria: parseInt(form.indumentaria) || 0,
      accesorios: parseInt(form.accesorios) || 0,
      monto_total: parseInt(form.monto_total) || 0,
      comprobantes: parseInt(form.comprobantes) || 0,
    }
    await supabase.from('ventas_diarias').upsert(row, { onConflict: 'fecha,vendedor_id,local_id' })
    setGuardando(false)
    setGuardadoOk(true)
    setTimeout(() => setGuardadoOk(false), 2000)
    fetchVentas()
  }

  // ── KPIs calculados ────────────────────────────────────────────────
  const objNum = parseFloat(objetivo) || 0
  const acumulado = useMemo(() => ventas.reduce((s, v) => s + (v.monto_total ?? 0), 0), [ventas])
  const totalComp = useMemo(() => ventas.reduce((s, v) => s + (v.comprobantes ?? 0), 0), [ventas])
  const totalItems = useMemo(() => ventas.reduce((s, v) => s + (v.calzado ?? 0) + (v.indumentaria ?? 0) + (v.accesorios ?? 0), 0), [ventas])
  const tktProm = totalComp > 0 ? acumulado / totalComp : 0
  const vupProm = totalComp > 0 ? totalItems / totalComp : 0
  const mixProm = totalComp > 0 ? totalItems / totalComp : 0

  const diasMes = diasEnMes(anio, mes)
  const diasTranscurridos = useMemo(() => {
    const hoyStr = hoy.toISOString().split('T')[0]
    const diasConVentas = new Set(ventas.map(v => v.fecha))
    // días transcurridos hasta hoy (o fin de mes si es mes pasado)
    const fin = new Date(anio, mes + 1, 0)
    const ref = hoy < fin ? hoy : fin
    return ref.getMonth() === mes && ref.getFullYear() === anio ? ref.getDate() : diasMes
  }, [ventas, mes, anio])

  const promDiarioActual = diasTranscurridos > 0 ? acumulado / diasTranscurridos : 0
  const promDiarioNecesario = diasMes > 0 ? objNum / diasMes : 0
  const runRate = promDiarioActual * diasMes
  const pctObj = objNum > 0 ? Math.round((acumulado / objNum) * 100) : 0
  const ticketsNecesarios = tktProm > 0 && objNum > acumulado ? Math.ceil((objNum - acumulado) / tktProm) : 0

  // Días ganados / cerca / perdidos
  const { ganados, cerca, perdidos } = useMemo(() => {
    const diasConDatos = {}
    ventas.forEach(v => {
      diasConDatos[v.fecha] = (diasConDatos[v.fecha] ?? 0) + (v.monto_total ?? 0)
    })
    let g = 0, c = 0, p = 0
    Object.values(diasConDatos).forEach(total => {
      if (!promDiarioNecesario) return
      const ratio = total / promDiarioNecesario
      if (ratio >= 1.1) g++
      else if (ratio >= 0.9) c++
      else p++
    })
    return { ganados: g, cerca: c, perdidos: p }
  }, [ventas, promDiarioNecesario])

  // ── Agrupaciones ──────────────────────────────────────────────────
  const porDia = useMemo(() => {
    const map = {}
    ventas.forEach(v => {
      if (!map[v.fecha]) map[v.fecha] = { fecha: v.fecha, calzado: 0, indumentaria: 0, accesorios: 0, monto_total: 0, comprobantes: 0 }
      map[v.fecha].calzado += v.calzado ?? 0
      map[v.fecha].indumentaria += v.indumentaria ?? 0
      map[v.fecha].accesorios += v.accesorios ?? 0
      map[v.fecha].monto_total += v.monto_total ?? 0
      map[v.fecha].comprobantes += v.comprobantes ?? 0
    })
    return Object.values(map).sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [ventas])

  const porSemana = useMemo(() => {
    const map = {}
    porDia.forEach(d => {
      const s = semanaDelMes(d.fecha)
      const key = `Semana ${s}`
      if (!map[key]) map[key] = { semana: key, filas: [], calzado: 0, indumentaria: 0, accesorios: 0, monto_total: 0, comprobantes: 0 }
      map[key].filas.push(d)
      map[key].calzado += d.calzado; map[key].indumentaria += d.indumentaria
      map[key].accesorios += d.accesorios; map[key].monto_total += d.monto_total
      map[key].comprobantes += d.comprobantes
    })
    return Object.values(map)
  }, [porDia])

  const porVendedor = useMemo(() => {
    const map = {}
    ventas.forEach(v => {
      const nombre = v.usuarios?.nombre ?? v.vendedor_id
      if (!map[nombre]) map[nombre] = { nombre, calzado: 0, indumentaria: 0, accesorios: 0, monto_total: 0, comprobantes: 0 }
      map[nombre].calzado += v.calzado ?? 0; map[nombre].indumentaria += v.indumentaria ?? 0
      map[nombre].accesorios += v.accesorios ?? 0; map[nombre].monto_total += v.monto_total ?? 0
      map[nombre].comprobantes += v.comprobantes ?? 0
    })
    return Object.values(map).sort((a, b) => b.monto_total - a.monto_total)
  }, [ventas])

  // ── Exportar ───────────────────────────────────────────────────────
  function exportar() {
    const datos = porDia.map(d => {
      const items = d.calzado + d.indumentaria + d.accesorios
      const tkt = d.comprobantes > 0 ? d.monto_total / d.comprobantes : 0
      const vup = d.comprobantes > 0 ? items / d.comprobantes : 0
      return {
        Fecha: d.fecha, Calzado: d.calzado, Indumentaria: d.indumentaria,
        Accesorios: d.accesorios, 'Total Items': items,
        'Monto Total': d.monto_total, Comprobantes: d.comprobantes,
        'TKT Prom': tkt.toFixed(0), 'VUP Prom': vup.toFixed(2),
        'Mix Producto': vup.toFixed(2),
      }
    })
    exportarExcel(datos, `ventas_${anio}_${mes + 1}`, 'Ventas')
  }

  // ── Render helpers ─────────────────────────────────────────────────
  function RowTabla({ d }) {
    const items = d.calzado + d.indumentaria + d.accesorios
    const tkt = d.comprobantes > 0 ? d.monto_total / d.comprobantes : 0
    const mix = d.comprobantes > 0 ? items / d.comprobantes : 0
    return (
      <tr className="border-t border-gray-100 text-xs">
        <td className="py-2 px-2 font-medium">{d.fecha?.slice(5)}</td>
        <td className="py-2 px-2 text-right">{d.calzado}</td>
        <td className="py-2 px-2 text-right">{d.indumentaria}</td>
        <td className="py-2 px-2 text-right">{d.accesorios}</td>
        <td className="py-2 px-2 text-right font-medium">{items}</td>
        <td className="py-2 px-2 text-right">{fmt$(d.monto_total)}</td>
        <td className="py-2 px-2 text-right">{d.comprobantes}</td>
        <td className="py-2 px-2 text-right">{fmt$(tkt)}</td>
        <td className="py-2 px-2 text-right">{fmtN(mix)}</td>
        <td className={`py-2 px-2 text-right ${MIX_COLOR(mix)}`}>{fmtN(mix)}</td>
      </tr>
    )
  }

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Reporte de Ventas</h1>
        <button onClick={exportar} disabled={ventas.length === 0}
          className="bg-black text-white text-xs rounded-xl px-3 py-2 disabled:opacity-40">
          ↓ Excel
        </button>
      </div>

      {/* Selector de mes */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => { const d = new Date(anio, mes - 1); setMes(d.getMonth()); setAnio(d.getFullYear()) }}
          className="w-8 h-8 border border-gray-200 rounded-lg text-sm flex items-center justify-center">‹</button>
        <p className="flex-1 text-center text-sm font-semibold">{MESES[mes]} {anio}</p>
        <button onClick={() => { const d = new Date(anio, mes + 1); setMes(d.getMonth()); setAnio(d.getFullYear()) }}
          className="w-8 h-8 border border-gray-200 rounded-lg text-sm flex items-center justify-center">›</button>
      </div>

      {/* Objetivo */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 flex items-center gap-3">
        <label className="text-xs text-gray-500 shrink-0">Objetivo mensual $</label>
        <input
          type="number"
          value={objetivo}
          onChange={e => guardarObjetivo(e.target.value)}
          placeholder="0"
          className="flex-1 text-right font-bold text-sm border-0 focus:outline-none bg-transparent"
        />
      </div>

      {/* Tabs de vista */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-4 text-xs">
        {[['kpis','KPIs'],['diario','Diario'],['semanal','Semanal'],['vendedor','Vendedor']].map(([v,l]) => (
          <button key={v} onClick={() => setVista(v)}
            className={`flex-1 py-2 font-medium ${vista === v ? 'bg-black text-white' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── VISTA KPIs ── */}
          {vista === 'kpis' && (
            <div className="space-y-3">
              {/* Grid principal */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Acumulado</p>
                  <p className="text-2xl font-black">{fmt$(acumulado)}</p>
                  {objNum > 0 && <p className="text-xs text-gray-400 mt-1">{pctObj}% del objetivo</p>}
                </div>
                <div className={`rounded-2xl p-4 border ${runRate >= objNum ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <p className="text-xs text-gray-400 mb-1">Run Rate</p>
                  <p className="text-2xl font-black">{fmt$(runRate)}</p>
                  <p className="text-xs text-gray-400 mt-1">proyección fin de mes</p>
                </div>
              </div>

              {/* Barra de progreso */}
              {objNum > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-400">Avance vs objetivo</span>
                    <span className="font-bold">{pctObj}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pctObj >= 100 ? 'bg-emerald-400' : pctObj >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(pctObj, 100)}%` }} />
                  </div>
                </div>
              )}

              {/* Días */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-emerald-600">{ganados}</p>
                  <p className="text-xs text-gray-500 mt-1">Días ganados</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-amber-500">{cerca}</p>
                  <p className="text-xs text-gray-500 mt-1">Días cerca</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-red-500">{perdidos}</p>
                  <p className="text-xs text-gray-500 mt-1">Días perdidos</p>
                </div>
              </div>

              {/* Promedios */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Prom. diario actual</p>
                  <p className="text-xl font-black">{fmt$(promDiarioActual)}</p>
                </div>
                {objNum > 0 && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-4">
                    <p className="text-xs text-gray-400 mb-1">Prom. diario necesario</p>
                    <p className="text-xl font-black">{fmt$(promDiarioNecesario)}</p>
                  </div>
                )}
              </div>

              {/* KPIs de ticket */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">TKT Prom</p>
                  <p className="font-black text-sm">{fmt$(tktProm)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">VUP Prom</p>
                  <p className="font-black text-sm">{fmtN(vupProm)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Mix</p>
                  <p className={`font-black text-sm ${MIX_COLOR(mixProm)}`}>{fmtN(mixProm)}</p>
                </div>
              </div>

              {objNum > 0 && ticketsNecesarios > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Tickets necesarios para objetivo</p>
                  <p className="text-3xl font-black">{ticketsNecesarios.toLocaleString('es-AR')}</p>
                </div>
              )}

              {/* Formulario de carga — solo encargado */}
              {!readOnly && (
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <h3 className="font-semibold text-sm mb-3">Cargar ventas del día</h3>
                  <form onSubmit={guardarVenta} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Fecha</label>
                        <input type="date" value={form.fecha}
                          onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:border-black" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Vendedor</label>
                        <select value={form.vendedor_id}
                          onChange={e => setForm(f => ({ ...f, vendedor_id: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:border-black bg-white">
                          <option value="">— Seleccionar —</option>
                          {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[['calzado','Calzado'],['indumentaria','Indum.'],['accesorios','Acces.']].map(([k,l]) => (
                        <div key={k}>
                          <label className="text-xs text-gray-500">{l}</label>
                          <input type="number" min="0" value={form[k]}
                            onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 text-center focus:outline-none focus:border-black" />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Monto total $</label>
                        <input type="number" min="0" value={form.monto_total}
                          onChange={e => setForm(f => ({ ...f, monto_total: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:border-black" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Comprobantes</label>
                        <input type="number" min="0" value={form.comprobantes}
                          onChange={e => setForm(f => ({ ...f, comprobantes: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:border-black" />
                      </div>
                    </div>
                    <button type="submit" disabled={guardando || !form.vendedor_id}
                      className="w-full bg-black text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                      {guardando ? 'Guardando...' : guardadoOk ? '✓ Guardado' : 'Guardar'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ── VISTA DIARIO ── */}
          {vista === 'diario' && (
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-xs min-w-[600px]">
                <thead className="bg-gray-50">
                  <tr>
                    {['Fecha','Calz','Indum','Acess','Items','Monto','Comp','TKT','VUP','Mix'].map(h => (
                      <th key={h} className="py-2 px-2 text-left font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {porDia.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-6 text-gray-400">Sin datos este mes</td></tr>
                  ) : (
                    <>
                      {porDia.map(d => <RowTabla key={d.fecha} d={d} />)}
                      {/* Totales */}
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-xs">
                        <td className="py-2 px-2">TOTAL</td>
                        <td className="py-2 px-2 text-right">{porDia.reduce((s,d)=>s+d.calzado,0)}</td>
                        <td className="py-2 px-2 text-right">{porDia.reduce((s,d)=>s+d.indumentaria,0)}</td>
                        <td className="py-2 px-2 text-right">{porDia.reduce((s,d)=>s+d.accesorios,0)}</td>
                        <td className="py-2 px-2 text-right">{totalItems}</td>
                        <td className="py-2 px-2 text-right">{fmt$(acumulado)}</td>
                        <td className="py-2 px-2 text-right">{totalComp}</td>
                        <td className="py-2 px-2 text-right">{fmt$(tktProm)}</td>
                        <td className="py-2 px-2 text-right">{fmtN(vupProm)}</td>
                        <td className={`py-2 px-2 text-right ${MIX_COLOR(mixProm)}`}>{fmtN(mixProm)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── VISTA SEMANAL ── */}
          {vista === 'semanal' && (
            <div className="space-y-4">
              {porSemana.length === 0 && <p className="text-center py-6 text-gray-400">Sin datos este mes</p>}
              {porSemana.map(s => {
                const items = s.calzado + s.indumentaria + s.accesorios
                const tkt = s.comprobantes > 0 ? s.monto_total / s.comprobantes : 0
                const mix = s.comprobantes > 0 ? items / s.comprobantes : 0
                return (
                  <div key={s.semana} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                      <p className="font-bold text-sm">{s.semana}</p>
                      <p className="font-black text-sm">{fmt$(s.monto_total)}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100 text-center">
                      <div className="py-3"><p className="text-xs text-gray-400">Items</p><p className="font-bold">{items}</p></div>
                      <div className="py-3"><p className="text-xs text-gray-400">TKT</p><p className="font-bold">{fmt$(tkt)}</p></div>
                      <div className="py-3"><p className="text-xs text-gray-400">Mix</p><p className={`font-bold ${MIX_COLOR(mix)}`}>{fmtN(mix)}</p></div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <tbody>
                          {s.filas.map(d => <RowTabla key={d.fecha} d={d} />)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── VISTA VENDEDOR ── */}
          {vista === 'vendedor' && (
            <div className="space-y-3">
              {porVendedor.length === 0 && <p className="text-center py-6 text-gray-400">Sin datos este mes</p>}
              {porVendedor.map(v => {
                const items = v.calzado + v.indumentaria + v.accesorios
                const tkt = v.comprobantes > 0 ? v.monto_total / v.comprobantes : 0
                const vup = v.comprobantes > 0 ? items / v.comprobantes : 0
                const mix = vup
                return (
                  <div key={v.nombre} className="bg-white border border-gray-200 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                      <p className="font-bold">{v.nombre}</p>
                      <p className="font-black">{fmt$(v.monto_total)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        ['Calzado', v.calzado], ['Indumentaria', v.indumentaria],
                        ['Accesorios', v.accesorios], ['Total items', items],
                        ['Comprobantes', v.comprobantes], ['TKT Prom', fmt$(tkt)],
                        ['VUP Prom', fmtN(vup)],
                      ].map(([l, val]) => (
                        <div key={l} className="bg-gray-50 rounded-lg px-3 py-2">
                          <p className="text-gray-400">{l}</p>
                          <p className="font-bold mt-0.5">{val}</p>
                        </div>
                      ))}
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-gray-400">Mix Producto</p>
                        <p className={`font-bold mt-0.5 ${MIX_COLOR(mix)}`}>{fmtN(mix)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
