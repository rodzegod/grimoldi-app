import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useLocal } from '../../hooks/useLocal'

const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#ef4444','#6366f1','#f97316','#06b6d4']

function defaultPos(idx) {
  const col = idx % 3
  const row = Math.floor(idx / 3)
  return { x: 2 + col * 33, y: 2 + row * 34, w: 30, h: 30 }
}

export default function MapaLocal() {
  const { usuario } = useAuth()
  const { localId, rol } = useLocal()
  const canEdit = ['encargado', 'admin'].includes(rol)

  const [zonas, setZonas] = useState([])
  const [stockHoy, setStockHoy] = useState({})   // `${pid}-${zid}` → delta del día
  const [incPorZona, setIncPorZona] = useState({})
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [zonaAbierta, setZonaAbierta] = useState(null)

  // Modal movimiento stock
  const [modal, setModal] = useState(null)  // { tipo, productoId, zonaId, nombre }
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  const containerRef = useRef(null)
  const zonesRef = useRef([])
  useEffect(() => { zonesRef.current = zonas }, [zonas])

  useEffect(() => { if (localId) fetchData() }, [localId])

  async function fetchData() {
    setLoading(true)
    const hoy = new Date().toISOString().split('T')[0]
    const [r1, r2, r3] = await Promise.all([
      supabase.from('zonas')
        .select(`*, zona_productos(producto_id, productos(id, codigo, modelo, medida, familia, descripcion))`)
        .eq('local_id', localId).order('orden'),
      supabase.from('incidencias').select('zona_id')
        .eq('local_id', localId).in('estado', ['abierta', 'en_proceso']),
      supabase.from('movimientos_stock')
        .select('producto_id, zona_id, tipo, cantidad')
        .eq('local_id', localId).gte('created_at', `${hoy}T00:00:00`),
    ])

    const inc = {}
    ;(r2.data ?? []).forEach(i => { if (i.zona_id) inc[i.zona_id] = (inc[i.zona_id] ?? 0) + 1 })

    const stock = {}
    ;(r3.data ?? []).forEach(m => {
      const k = `${m.producto_id}-${m.zona_id}`
      stock[k] = (stock[k] ?? 0) + (m.tipo === 'entrada' ? (m.cantidad ?? 1) : -(m.cantidad ?? 1))
    })

    setZonas(r1.data ?? [])
    setIncPorZona(inc)
    setStockHoy(stock)
    setLoading(false)
  }

  // ── Drag ──────────────────────────────────────────────────────
  const onZonaPointerDown = useCallback((e, zona) => {
    if (!editMode || e.target.closest('[data-rh]')) return
    e.preventDefault()
    const rect = containerRef.current.getBoundingClientRect()
    const cW = rect.width, cH = rect.height
    const origX = zona.pos_x ?? defaultPos(zonesRef.current.indexOf(zona)).x
    const origY = zona.pos_y ?? defaultPos(zonesRef.current.indexOf(zona)).y
    const origW = zona.pos_w ?? 30
    const origH = zona.pos_h ?? 30
    const sx = e.clientX, sy = e.clientY
    const id = zona.id

    function onMove(ev) {
      const dx = ((ev.clientX - sx) / cW) * 100
      const dy = ((ev.clientY - sy) / cH) * 100
      setZonas(prev => prev.map(z => z.id !== id ? z : {
        ...z,
        pos_x: Math.max(0, Math.min(100 - origW, origX + dx)),
        pos_y: Math.max(0, Math.min(100 - origH, origY + dy)),
      }))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const z = zonesRef.current.find(z => z.id === id)
      if (z) supabase.from('zonas').update({ pos_x: z.pos_x, pos_y: z.pos_y }).eq('id', id)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [editMode])

  // ── Resize ────────────────────────────────────────────────────
  const onResizePointerDown = useCallback((e, zona) => {
    if (!editMode) return
    e.preventDefault()
    e.stopPropagation()
    const rect = containerRef.current.getBoundingClientRect()
    const cW = rect.width, cH = rect.height
    const origW = zona.pos_w ?? 30
    const origH = zona.pos_h ?? 30
    const sx = e.clientX, sy = e.clientY
    const id = zona.id

    function onMove(ev) {
      const dw = ((ev.clientX - sx) / cW) * 100
      const dh = ((ev.clientY - sy) / cH) * 100
      setZonas(prev => prev.map(z => z.id !== id ? z : {
        ...z,
        pos_w: Math.max(14, Math.min(95, origW + dw)),
        pos_h: Math.max(12, Math.min(95, origH + dh)),
      }))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const z = zonesRef.current.find(z => z.id === id)
      if (z) supabase.from('zonas').update({ pos_w: z.pos_w, pos_h: z.pos_h }).eq('id', id)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [editMode])

  async function confirmarMovimiento() {
    if (!motivo.trim()) return
    setGuardando(true)
    const { error } = await supabase.from('movimientos_stock').insert({
      producto_id: modal.productoId, zona_id: modal.zonaId,
      tipo: modal.tipo, cantidad: 1, motivo: motivo.trim(),
      registrado_por: usuario.id, local_id: localId,
    })
    setGuardando(false)
    if (!error) {
      const k = `${modal.productoId}-${modal.zonaId}`
      setStockHoy(prev => ({ ...prev, [k]: (prev[k] ?? 0) + (modal.tipo === 'entrada' ? 1 : -1) }))
      setModal(null)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" /></div>
  }

  const zonaDetalle = zonaAbierta ? zonas.find(z => z.id === zonaAbierta) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Mapa del local</h1>
        {canEdit && (
          <button
            onClick={() => setEditMode(v => !v)}
            className={`text-xs rounded-xl px-3 py-2 font-medium border transition ${editMode ? 'bg-vans-black text-white border-vans-black' : 'border-gray-200 text-gray-500'}`}
          >
            {editMode ? '✓ Editando' : 'Editar mapa'}
          </button>
        )}
      </div>

      {editMode && <p className="text-xs text-gray-400 mb-2">Arrastrá las zonas · esquina inferior derecha para redimensionar</p>}

      {/* Modal movimiento */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-lg ${modal.tipo === 'entrada' ? 'text-emerald-500' : 'text-red-500'}`}>{modal.tipo === 'entrada' ? '▲' : '▼'}</span>
              <h3 className="font-bold capitalize">{modal.tipo} de stock</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4 truncate">{modal.nombre}</p>
            <textarea autoFocus value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
              placeholder="Ej: reposición desde depósito, traslado, venta..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-black" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModal(null)} className="flex-1 border border-gray-900 text-gray-900 rounded-xl py-3 text-sm font-medium">Cancelar</button>
              <button onClick={confirmarMovimiento} disabled={!motivo.trim() || guardando}
                className={`flex-1 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-40 ${modal.tipo === 'entrada' ? 'bg-emerald-500' : 'bg-vans-red'}`}>
                {guardando ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom sheet zona */}
      {zonaDetalle && !editMode && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-end justify-center" onClick={() => setZonaAbierta(null)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[75vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold">{zonaDetalle.nombre}</h2>
              <button onClick={() => setZonaAbierta(null)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
              {(zonaDetalle.zona_productos ?? []).length === 0
                ? <p className="text-sm text-gray-400 px-5 py-4">Sin productos asignados en esta zona</p>
                : (zonaDetalle.zona_productos ?? []).map(zp => {
                  const p = zp.productos
                  const k = `${zp.producto_id}-${zonaDetalle.id}`
                  const count = stockHoy[k] ?? 0
                  const nombre = `${p?.codigo} ${p?.modelo} T${p?.medida}`
                  return (
                    <div key={zp.producto_id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-400 shrink-0">{p?.codigo}</span>
                          <p className="text-sm font-medium truncate">{p?.modelo} T{p?.medida}</p>
                        </div>
                        {p?.descripcion && <p className="text-xs text-gray-500">{p.descripcion}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setModal({ tipo: 'entrada', productoId: zp.producto_id, zonaId: zonaDetalle.id, nombre })}
                          className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl text-lg font-bold flex items-center justify-center">+</button>
                        <span className={`w-9 text-center text-lg font-black tabular-nums ${count > 0 ? 'text-emerald-600' : count < 0 ? 'text-red-500' : 'text-gray-300'}`}>{count}</span>
                        <button onClick={() => setModal({ tipo: 'salida', productoId: zp.producto_id, zonaId: zonaDetalle.id, nombre })}
                          className="w-9 h-9 bg-red-50 text-red-500 rounded-xl text-lg font-bold flex items-center justify-center">−</button>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {/* Mapa espacial */}
      {zonas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">⊞</p>
          <p>Sin zonas configuradas</p>
          <p className="text-xs mt-1">El encargado debe crear zonas en Gestión de Zonas</p>
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            className="relative bg-gray-100 rounded-2xl border border-gray-200 overflow-hidden"
            style={{ aspectRatio: '4/3', userSelect: 'none', touchAction: 'none' }}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-gray-300 text-xs font-medium uppercase tracking-widest">Plano del local</p>
            </div>

            {zonas.map((zona, idx) => {
              const c = COLORS[idx % COLORS.length]
              const def = defaultPos(idx)
              const x = zona.pos_x ?? def.x
              const y = zona.pos_y ?? def.y
              const w = zona.pos_w ?? def.w
              const h = zona.pos_h ?? def.h
              const alertas = incPorZona[zona.id] ?? 0
              const prods = zona.zona_productos ?? []

              return (
                <div
                  key={zona.id}
                  style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`,
                    backgroundColor: c + '18', borderColor: c,
                    cursor: editMode ? 'grab' : 'pointer' }}
                  className="border-2 rounded-xl overflow-hidden flex flex-col"
                  onPointerDown={e => editMode ? onZonaPointerDown(e, zona) : undefined}
                  onClick={() => !editMode && setZonaAbierta(zona.id)}
                >
                  {/* Header zona */}
                  <div className="flex items-center justify-between px-2 py-1 shrink-0" style={{ backgroundColor: c + '28' }}>
                    <p className="text-[9px] font-bold truncate" style={{ color: c }}>{zona.nombre}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {alertas > 0 && (
                        <span className="bg-red-500 text-white rounded-full flex items-center justify-center font-bold"
                          style={{ fontSize: 7, width: 14, height: 14 }}>
                          {alertas > 9 ? '9+' : alertas}
                        </span>
                      )}
                      <span style={{ fontSize: 8, color: c }}>{prods.length}p</span>
                    </div>
                  </div>

                  {/* Items compactos */}
                  <div className="flex-1 overflow-hidden px-1.5 py-1 space-y-px">
                    {prods.slice(0, 4).map(zp => {
                      const p = zp.productos
                      const count = stockHoy[`${zp.producto_id}-${zona.id}`] ?? 0
                      return (
                        <div key={zp.producto_id} className="flex items-center justify-between gap-1">
                          <span className="text-gray-700 truncate" style={{ fontSize: 8 }}>{p?.modelo} {p?.medida}</span>
                          {count !== 0 && (
                            <span className={`font-bold shrink-0 ${count > 0 ? 'text-emerald-600' : 'text-red-500'}`} style={{ fontSize: 8 }}>
                              {count > 0 ? '+' : ''}{count}
                            </span>
                          )}
                        </div>
                      )
                    })}
                    {prods.length > 4 && <p className="text-gray-400" style={{ fontSize: 7 }}>+{prods.length - 4} más</p>}
                  </div>

                  {/* Resize handle */}
                  {editMode && (
                    <div data-rh className="absolute bottom-0 right-0 w-5 h-5 flex items-center justify-center cursor-se-resize rounded-tl"
                      style={{ backgroundColor: c + '50' }}
                      onPointerDown={e => onResizePointerDown(e, zona)}>
                      <span style={{ fontSize: 9, color: c }}>⊡</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="mt-3 flex flex-wrap gap-2">
            {zonas.map((zona, idx) => {
              const c = COLORS[idx % COLORS.length]
              const alertas = incPorZona[zona.id] ?? 0
              return (
                <button key={zona.id} onClick={() => !editMode && setZonaAbierta(zona.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs"
                  style={{ borderColor: c, color: c }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c }} />
                  {zona.nombre}
                  {alertas > 0 && (
                    <span className="bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">{alertas}</span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
