import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useLocal } from '../../hooks/useLocal'

const TIPO_LABEL = {
  hurto_robo: 'Hurto / Robo',
  rotura_dano: 'Rotura / Daño',
  faltante_stock: 'Faltante stock',
  error_admin: 'Error admin',
  devolucion: 'Devolución',
  deterioro_falla: 'Deterioro / Falla',
  otro: 'Otro',
}

const ESTADO_CFG = {
  abierta:    { label: 'Abierta',    cls: 'bg-red-100 text-red-700' },
  en_proceso: { label: 'En proceso', cls: 'bg-amber-100 text-amber-700' },
  resuelta:   { label: 'Resuelta',   cls: 'bg-emerald-100 text-emerald-700' },
}

const PERIODOS = [
  { value: 'hoy',   label: 'Hoy' },
  { value: 'semana',label: 'Semana' },
  { value: 'mes',   label: 'Mes' },
  { value: 'todo',  label: 'Todo' },
]

function desdeFor(periodo) {
  const hoy = new Date()
  if (periodo === 'hoy')   { const d = new Date(hoy); d.setHours(0,0,0,0); return d.toISOString() }
  if (periodo === 'semana'){ const d = new Date(hoy); d.setDate(d.getDate()-7); return d.toISOString() }
  if (periodo === 'mes')   { const d = new Date(hoy); d.setMonth(d.getMonth()-1); return d.toISOString() }
  return '2000-01-01T00:00:00Z'
}

function formatPesos(n) {
  return '$ ' + Math.round(n).toLocaleString('es-AR')
}

function exportCSV(rows) {
  const cols = ['tipo','prioridad','estado','unidades','costo_unitario','producto','zona','reportado_por','created_at']
  const header = cols.join(',')
  const lines = rows.map(r => [
    r.tipo, r.prioridad, r.estado,
    r.unidades ?? 1, r.costo_unitario ?? 0,
    r.productos ? `${r.productos.codigo} ${r.productos.modelo} T${r.productos.medida}` : '',
    r.zonas?.nombre ?? '',
    r.usuarios?.nombre ?? '',
    new Date(r.created_at).toLocaleString('es-AR'),
  ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
  const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `merma_${new Date().toISOString().split('T')[0]}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// Inline bar chart — no external lib
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t" style={{ height: `${Math.round((d.value / max) * 52)}px`, backgroundColor: '#e1251b', opacity: d.value ? 0.8 : 0.15, minHeight: 2 }} />
          <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function BandejaIncidencias({ readOnly = false }) {
  const { usuario } = useAuth()
  const { localId } = useLocal()

  const [incidencias, setIncidencias] = useState([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('mes')
  const [tab, setTab] = useState('panel')
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState(null)

  // gestión
  const [vendedores, setVendedores] = useState([])
  const [gestionando, setGestionando] = useState(null)
  const [nota, setNota] = useState('')
  const [asignadoA, setAsignadoA] = useState('')

  // modal nueva incidencia (encargado/admin only)
  const [modalNueva, setModalNueva] = useState(false)
  const [nTipo, setNTipo] = useState('hurto_robo')
  const [nPrioridad, setNPrioridad] = useState('Normal')
  const [nDesc, setNDesc] = useState('')
  const [nUnidades, setNUnidades] = useState(1)
  const [nCosto, setNCosto] = useState(0)
  const [nProductoBusq, setNProductoBusq] = useState('')
  const [nProductos, setNProductos] = useState([])
  const [nProductoSel, setNProductoSel] = useState(null)
  const [zonas, setZonas] = useState([])
  const [nZonaId, setNZonaId] = useState('')
  const [guardandoNueva, setGuardandoNueva] = useState(false)

  // tendencia 6 meses
  const [tendencia, setTendencia] = useState([])

  useEffect(() => {
    if (localId) {
      fetchIncidencias()
      fetchVendedores()
      fetchTendencia()
      supabase.from('zonas').select('*').eq('local_id', localId).order('orden')
        .then(({ data }) => setZonas(data ?? []))
    }
  }, [localId, periodo])

  async function fetchIncidencias() {
    setLoading(true)
    const desde = desdeFor(periodo)
    const { data } = await supabase
      .from('incidencias')
      .select(`*, productos(codigo, modelo, medida), zonas(nombre), usuarios!incidencias_reportado_por_fkey(nombre)`)
      .eq('local_id', localId)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
    setIncidencias(data ?? [])
    setLoading(false)
  }

  async function fetchVendedores() {
    const { data } = await supabase
      .from('usuarios').select('id, nombre')
      .eq('local_id', localId).in('rol', ['vendedor', 'encargado'])
    setVendedores(data ?? [])
  }

  async function fetchTendencia() {
    // Últimos 6 meses: conteo de incidencias por mes
    const desde = new Date()
    desde.setMonth(desde.getMonth() - 5)
    desde.setDate(1)
    desde.setHours(0,0,0,0)
    const { data } = await supabase
      .from('incidencias')
      .select('created_at, costo_unitario, unidades')
      .eq('local_id', localId)
      .gte('created_at', desde.toISOString())
    const map = {}
    ;(data ?? []).forEach(inc => {
      const d = new Date(inc.created_at)
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const label = d.toLocaleString('es-AR', { month: 'short' })
      if (!map[k]) map[k] = { label, value: 0 }
      map[k].value += (inc.costo_unitario ?? 0) * (inc.unidades ?? 1)
    })
    const sorted = Object.keys(map).sort().map(k => map[k])
    // Fill 6 slots
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const label = d.toLocaleString('es-AR', { month: 'short' })
      meses.push(map[k] ?? { label, value: 0 })
    }
    setTendencia(meses)
  }

  // KPIs
  const kpis = useMemo(() => {
    const perdida = incidencias.reduce((s,i) => s + (i.costo_unitario ?? 0) * (i.unidades ?? 1), 0)
    const unidades = incidencias.reduce((s,i) => s + (i.unidades ?? 1), 0)
    const sinResolver = incidencias.filter(i => i.estado !== 'resuelta').length
    return { perdida, unidades, total: incidencias.length, sinResolver }
  }, [incidencias])

  // Por tipo
  const porTipo = useMemo(() => {
    const map = {}
    incidencias.forEach(i => {
      if (!map[i.tipo]) map[i.tipo] = { count: 0, perdida: 0 }
      map[i.tipo].count++
      map[i.tipo].perdida += (i.costo_unitario ?? 0) * (i.unidades ?? 1)
    })
    return Object.entries(map).sort((a,b) => b[1].perdida - a[1].perdida)
  }, [incidencias])

  // Por zona
  const porZona = useMemo(() => {
    const map = {}
    incidencias.forEach(i => {
      const k = i.zonas?.nombre ?? 'Sin zona'
      if (!map[k]) map[k] = 0
      map[k] += (i.costo_unitario ?? 0) * (i.unidades ?? 1)
    })
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,5)
  }, [incidencias])

  // Lista filtrada
  const listaFiltrada = useMemo(() => incidencias.filter(i =>
    (filtroEstado === 'todas' || i.estado === filtroEstado) &&
    (!filtroTipo || i.tipo === filtroTipo)
  ), [incidencias, filtroEstado, filtroTipo])

  async function actualizarEstado(id, estado) {
    const extra = estado === 'resuelta'
      ? { resuelto_at: new Date().toISOString(), nota_resolucion: nota || null }
      : {}
    await supabase.from('incidencias').update({ estado, asignado_a: asignadoA || null, ...extra }).eq('id', id)
    setGestionando(null); setNota(''); setAsignadoA('')
    fetchIncidencias()
  }

  async function buscarProductoNueva(q) {
    setNProductoBusq(q); setNProductoSel(null)
    if (q.length < 2) { setNProductos([]); return }
    const { data } = await supabase.from('productos').select('id, codigo, modelo, medida')
      .eq('local_id', localId).or(`codigo.ilike.%${q}%,modelo.ilike.%${q}%`).limit(8)
    setNProductos(data ?? [])
  }

  async function guardarNueva() {
    setGuardandoNueva(true)
    await supabase.from('incidencias').insert({
      tipo: nTipo, prioridad: nPrioridad,
      descripcion: nDesc.trim() || null,
      unidades: nUnidades, costo_unitario: nCosto,
      producto_id: nProductoSel?.id ?? null,
      zona_id: nZonaId || null,
      reportado_por: usuario.id, local_id: localId,
    })
    setGuardandoNueva(false)
    setModalNueva(false)
    setNTipo('hurto_robo'); setNPrioridad('Normal'); setNDesc(''); setNUnidades(1); setNCosto(0)
    setNProductoBusq(''); setNProductoSel(null); setNZonaId('')
    fetchIncidencias()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">{readOnly ? 'Panel de Merma' : 'Merma / Incidencias'}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => exportCSV(incidencias)}
            className="border border-gray-900 text-gray-900 text-xs rounded-xl px-3 py-2 font-medium">
            ↓ CSV
          </button>
          {!readOnly && (
            <button onClick={() => setModalNueva(true)}
              className="bg-vans-red text-white text-xs rounded-xl px-3 py-2 font-bold">
              + Nueva
            </button>
          )}
        </div>
      </div>

      {/* Período */}
      <div className="flex gap-1 mb-3">
        {PERIODOS.map(p => (
          <button key={p.value} onClick={() => setPeriodo(p.value)}
            className={`text-xs rounded-full px-3 py-1.5 border transition font-medium
              ${periodo === p.value ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-1.5 mb-4">
        {[
          { label: 'Pérdida', value: formatPesos(kpis.perdida), red: true },
          { label: 'Unidades', value: kpis.unidades },
          { label: 'Total inc.', value: kpis.total },
          { label: 'Sin resolver', value: kpis.sinResolver, warn: kpis.sinResolver > 0 },
        ].map(k => (
          <div key={k.label} className={`rounded-xl p-2.5 text-center ${k.red ? 'bg-vans-red text-white' : 'bg-vans-black text-white'}`}>
            <p className={`text-base font-black tabular-nums leading-tight ${k.warn ? 'text-amber-400' : ''}`}>{k.value}</p>
            <p className="text-[9px] opacity-70 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-4 text-sm">
        {[['panel','Panel KPIs'],['lista','Lista']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`flex-1 py-2 font-medium ${tab === v ? 'bg-black text-white' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'panel' ? (
        <div className="space-y-4">
          {/* Tendencia */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-xs text-gray-400 font-medium mb-3">Pérdida últimos 6 meses ($)</p>
            <BarChart data={tendencia} />
          </div>

          {/* Merma por tipo */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-xs text-gray-400 font-medium mb-3">Merma por tipo</p>
            {porTipo.length === 0
              ? <p className="text-sm text-gray-400">Sin incidencias en el período</p>
              : <div className="space-y-2">
                  {porTipo.map(([tipo, data]) => (
                    <button key={tipo} onClick={() => { setFiltroTipo(filtroTipo === tipo ? null : tipo); setTab('lista') }}
                      className="w-full flex items-center gap-3 text-left group">
                      <span className="text-xs w-32 shrink-0 text-gray-700">{TIPO_LABEL[tipo] ?? tipo}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-vans-red rounded-full" style={{ width: `${Math.round((data.perdida / Math.max(...porTipo.map(t=>t[1].perdida),1))*100)}%`, minWidth: data.perdida ? 4 : 0 }} />
                      </div>
                      <span className="text-xs text-gray-500 w-12 text-right shrink-0">{data.count} inc</span>
                      {data.perdida > 0 && <span className="text-xs font-medium text-vans-red shrink-0">{formatPesos(data.perdida)}</span>}
                    </button>
                  ))}
                </div>
            }
          </div>

          {/* Merma por zona */}
          {porZona.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <p className="text-xs text-gray-400 font-medium mb-3">Merma por zona (top 5)</p>
              <div className="space-y-2">
                {porZona.map(([zona, perdida]) => (
                  <div key={zona} className="flex items-center gap-3">
                    <span className="text-xs w-24 shrink-0 text-gray-700 truncate">{zona}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="h-full bg-gray-700 rounded-full" style={{ width: `${Math.round((perdida / porZona[0][1])*100)}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 shrink-0">{formatPesos(perdida)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Lista */
        <div>
          {/* Filtros estado */}
          <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
            {[{v:'todas',l:'Todas'},{v:'abierta',l:'Abiertas'},{v:'en_proceso',l:'En proceso'},{v:'resuelta',l:'Resueltas'}].map(f => (
              <button key={f.v} onClick={() => setFiltroEstado(f.v)}
                className={`text-xs rounded-full px-3 py-1.5 border whitespace-nowrap transition font-medium
                  ${filtroEstado === f.v ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-500'}`}>
                {f.l}
              </button>
            ))}
            {filtroTipo && (
              <button onClick={() => setFiltroTipo(null)}
                className="text-xs rounded-full px-3 py-1.5 bg-vans-red text-white whitespace-nowrap">
                {TIPO_LABEL[filtroTipo] ?? filtroTipo} ✕
              </button>
            )}
          </div>

          {listaFiltrada.length === 0
            ? <p className="text-center py-12 text-gray-400">Sin incidencias en esta vista</p>
            : <div className="space-y-3">
                {listaFiltrada.map(inc => {
                  const ec = ESTADO_CFG[inc.estado] ?? { label: inc.estado, cls: 'bg-gray-100' }
                  const perdida = (inc.costo_unitario ?? 0) * (inc.unidades ?? 1)
                  return (
                    <div key={inc.id} className="bg-white border border-gray-100 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{TIPO_LABEL[inc.tipo] ?? inc.tipo}</p>
                            {inc.prioridad === 'Urgente' && (
                              <span className="text-xs bg-vans-red text-white rounded-full px-2 py-0.5">Urgente</span>
                            )}
                          </div>
                          {inc.productos && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {inc.productos.codigo} · {inc.productos.modelo} T{inc.productos.medida}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-0.5">
                            {inc.zonas && <p className="text-xs text-gray-400">{inc.zonas.nombre}</p>}
                            {(inc.unidades ?? 1) > 0 && <p className="text-xs text-gray-400">{inc.unidades ?? 1} ud</p>}
                            {perdida > 0 && <p className="text-xs font-medium text-vans-red">{formatPesos(perdida)}</p>}
                          </div>
                          {inc.descripcion && <p className="text-xs text-gray-600 mt-1 truncate">{inc.descripcion}</p>}
                          <p className="text-xs text-gray-300 mt-1.5">
                            {inc.usuarios?.nombre} · {new Date(inc.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                        <span className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap ${ec.cls}`}>{ec.label}</span>
                      </div>

                      {!readOnly && inc.estado !== 'resuelta' && (
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          {gestionando === inc.id ? (
                            <div className="space-y-2">
                              <select value={asignadoA} onChange={e => setAsignadoA(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                                <option value="">— Asignar a —</option>
                                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                              </select>
                              <textarea placeholder="Nota de resolución (opcional)" value={nota}
                                onChange={e => setNota(e.target.value)} rows={2}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
                              <div className="flex gap-2">
                                {inc.estado === 'abierta' && (
                                  <button onClick={() => actualizarEstado(inc.id, 'en_proceso')}
                                    className="flex-1 text-xs bg-amber-100 text-amber-700 rounded-lg py-2 font-medium">En proceso</button>
                                )}
                                <button onClick={() => actualizarEstado(inc.id, 'resuelta')}
                                  className="flex-1 text-xs bg-emerald-100 text-emerald-700 rounded-lg py-2 font-medium">Resolver</button>
                                <button onClick={() => { setGestionando(null); setNota(''); setAsignadoA('') }}
                                  className="text-xs text-gray-400 px-3">✕</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setGestionando(inc.id)}
                              className="w-full text-xs text-gray-500 border border-gray-200 rounded-lg py-2 hover:border-black transition">
                              Gestionar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
          }
        </div>
      )}

      {/* Modal nueva incidencia */}
      {modalNueva && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h2 className="font-bold">Nueva incidencia</h2>
              <button onClick={() => setModalNueva(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TIPO_LABEL).map(([v,l]) => (
                    <button key={v} type="button" onClick={() => setNTipo(v)}
                      className={`text-left text-xs px-3 py-2 rounded-xl border transition
                        ${nTipo === v ? 'bg-black text-white border-black' : 'bg-white border-gray-200'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Unidades + Costo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Unidades</label>
                  <input type="number" min={1} value={nUnidades} onChange={e => setNUnidades(+e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Costo unitario $</label>
                  <input type="number" min={0} value={nCosto} onChange={e => setNCosto(+e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black" />
                </div>
              </div>
              {/* Producto */}
              <div>
                <label className="block text-xs font-medium mb-1">Producto (opcional)</label>
                <input type="text" placeholder="Buscar..." value={nProductoSel ? `${nProductoSel.codigo} ${nProductoSel.modelo}` : nProductoBusq}
                  onChange={e => buscarProductoNueva(e.target.value)}
                  onFocus={() => nProductoSel && setNProductoSel(null)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black" />
                {nProductos.length > 0 && !nProductoSel && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y mt-1">
                    {nProductos.map(p => (
                      <button key={p.id} type="button" onClick={() => { setNProductoSel(p); setNProductos([]); setNProductoBusq('') }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50">
                        {p.codigo} · {p.modelo} T{p.medida}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Zona */}
              <div>
                <label className="block text-xs font-medium mb-1">Zona (opcional)</label>
                <select value={nZonaId} onChange={e => setNZonaId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-black">
                  <option value="">— Sin zona —</option>
                  {zonas.map(z => <option key={z.id} value={z.id}>{z.nombre}</option>)}
                </select>
              </div>
              {/* Prioridad */}
              <div>
                <label className="block text-xs font-medium mb-1">Prioridad</label>
                <div className="flex gap-2">
                  {['Normal','Urgente'].map(p => (
                    <button key={p} type="button" onClick={() => setNPrioridad(p)}
                      className={`flex-1 py-2 rounded-xl border text-xs font-medium transition
                        ${nPrioridad === p ? p === 'Urgente' ? 'bg-vans-red text-white border-vans-red' : 'bg-black text-white border-black' : 'bg-white border-gray-200'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {/* Descripcion */}
              <div>
                <label className="block text-xs font-medium mb-1">Nota (opcional)</label>
                <textarea value={nDesc} onChange={e => setNDesc(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-black" />
              </div>
            </div>
            <div className="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0 flex gap-3">
              <button onClick={() => setModalNueva(false)}
                className="flex-1 border border-gray-900 text-gray-900 rounded-xl py-3 text-sm font-medium">Cancelar</button>
              <button onClick={guardarNueva} disabled={guardandoNueva}
                className="flex-1 bg-vans-red text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                {guardandoNueva ? '...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
