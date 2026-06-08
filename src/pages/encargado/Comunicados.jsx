import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useLocal } from '../../hooks/useLocal'

export default function Comunicados() {
  const { usuario } = useAuth()
  const { localId } = useLocal()
  const [comunicados, setComunicados] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ titulo: '', contenido: '', fijado: false, expira_at: '' })
  const [guardando, setGuardando] = useState(false)
  const [vistos, setVistos] = useState({}) // comunicado_id → [{ usuario_id }]
  const [verVistos, setVerVistos] = useState(null)

  useEffect(() => { if (localId) fetchTodo() }, [localId])

  async function fetchTodo() {
    setLoading(true)
    const hoy = new Date().toISOString().split('T')[0]
    const [{ data: coms }, { data: vstData }] = await Promise.all([
      supabase.from('comunicados').select('*').eq('local_id', localId).order('fijado', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('comunicados_vistos').select('comunicado_id, usuario_id, visto_at, usuarios(nombre)'),
    ])
    setComunicados(coms ?? [])
    const v = {}
    ;(vstData ?? []).forEach(x => {
      if (!v[x.comunicado_id]) v[x.comunicado_id] = []
      v[x.comunicado_id].push(x)
    })
    setVistos(v)
    setLoading(false)
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const payload = {
      titulo: form.titulo, contenido: form.contenido,
      fijado: form.fijado, local_id: localId,
      autor_id: usuario.id,
      expira_at: form.expira_at || null,
    }
    if (editando) {
      await supabase.from('comunicados').update(payload).eq('id', editando)
    } else {
      await supabase.from('comunicados').insert(payload)
    }
    setGuardando(false)
    setShowForm(false)
    setEditando(null)
    setForm({ titulo: '', contenido: '', fijado: false, expira_at: '' })
    fetchTodo()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este comunicado?')) return
    await supabase.from('comunicados').delete().eq('id', id)
    fetchTodo()
  }

  function abrirEditar(c) {
    setForm({ titulo: c.titulo, contenido: c.contenido, fijado: c.fijado, expira_at: c.expira_at ?? '' })
    setEditando(c.id)
    setShowForm(true)
  }

  const hoy = new Date().toISOString().split('T')[0]
  const activos = comunicados.filter(c => !c.expira_at || c.expira_at >= hoy)
  const expirados = comunicados.filter(c => c.expira_at && c.expira_at < hoy)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Comunicados</h1>
        <button onClick={() => { setForm({ titulo:'',contenido:'',fijado:false,expira_at:'' }); setEditando(null); setShowForm(true) }}
          className="bg-vans-red text-white text-sm font-bold rounded-xl px-4 py-2">+ Nuevo</button>
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-8 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold mb-4">{editando ? 'Editar comunicado' : 'Nuevo comunicado'}</h2>
            <form onSubmit={guardar} className="space-y-3">
              <input required placeholder="Título" value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black" />
              <textarea required placeholder="Contenido del comunicado..." rows={5} value={form.contenido}
                onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-black" />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.fijado} onChange={e => setForm(f => ({ ...f, fijado: e.target.checked }))} />
                  Fijar arriba
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-gray-500">Expira:</label>
                  <input type="date" value={form.expira_at} onChange={e => setForm(f => ({ ...f, expira_at: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-black" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowForm(false); setEditando(null) }}
                  className="flex-1 border border-gray-900 text-gray-900 rounded-xl py-3 text-sm font-medium">Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 bg-vans-red text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                  {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Publicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal vistos */}
      {verVistos && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <h3 className="font-bold mb-3">Leído por</h3>
            {(vistos[verVistos] ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">Nadie lo leyó todavía</p>
            ) : (
              <div className="space-y-2">
                {(vistos[verVistos] ?? []).map(v => (
                  <div key={v.usuario_id} className="flex items-center justify-between text-sm">
                    <span>{v.usuarios?.nombre}</span>
                    <span className="text-xs text-gray-400">{new Date(v.visto_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setVerVistos(null)}
              className="mt-4 w-full border border-gray-900 text-gray-900 rounded-xl py-2.5 text-sm font-medium">Cerrar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {activos.length === 0 && <p className="text-center py-6 text-gray-400">No hay comunicados</p>}
          {activos.map(c => (
            <ComunicadoCard key={c.id} c={c} vistos={vistos[c.id] ?? []}
              onEditar={() => abrirEditar(c)}
              onEliminar={() => eliminar(c.id)}
              onVerVistos={() => setVerVistos(c.id)} />
          ))}
          {expirados.length > 0 && (
            <>
              <p className="text-xs text-gray-400 font-medium mt-4">Expirados ({expirados.length})</p>
              {expirados.map(c => (
                <ComunicadoCard key={c.id} c={c} vistos={vistos[c.id] ?? []} expirado
                  onEditar={() => abrirEditar(c)}
                  onEliminar={() => eliminar(c.id)}
                  onVerVistos={() => setVerVistos(c.id)} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ComunicadoCard({ c, vistos, onEditar, onEliminar, onVerVistos, expirado }) {
  return (
    <div className={`bg-white border rounded-xl p-4 ${c.fijado ? 'border-black' : 'border-gray-200'} ${expirado ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {c.fijado && <span className="text-xs bg-black text-white rounded-full px-2 py-0.5">Fijado</span>}
            <p className="font-semibold text-sm truncate">{c.titulo}</p>
          </div>
          <p className="text-sm text-gray-600 whitespace-pre-line">{c.contenido}</p>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={onVerVistos} className="text-xs text-gray-400 hover:text-black">
              {vistos.length} {vistos.length === 1 ? 'lectura' : 'lecturas'}
            </button>
            {c.expira_at && <span className="text-xs text-gray-300">expira {c.expira_at}</span>}
            <span className="text-xs text-gray-300">{new Date(c.created_at).toLocaleDateString('es-AR')}</span>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={onEditar} className="text-gray-400 hover:text-black text-sm">✎</button>
          <button onClick={onEliminar} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
        </div>
      </div>
    </div>
  )
}
