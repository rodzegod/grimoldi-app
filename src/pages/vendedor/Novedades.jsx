import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useLocal } from '../../hooks/useLocal'

export default function Novedades() {
  const { usuario } = useAuth()
  const { localId } = useLocal()
  const [comunicados, setComunicados] = useState([])
  const [vistosSet, setVistosSet] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [abierto, setAbierto] = useState(null) // id del comunicado expandido

  useEffect(() => { if (localId && usuario) fetchComunicados() }, [localId, usuario])

  async function fetchComunicados() {
    setLoading(true)
    const hoy = new Date().toISOString().split('T')[0]
    const [{ data: coms }, { data: vstData }] = await Promise.all([
      supabase.from('comunicados').select('*').eq('local_id', localId)
        .or(`expira_at.is.null,expira_at.gte.${hoy}`)
        .order('fijado', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('comunicados_vistos').select('comunicado_id').eq('usuario_id', usuario.id),
    ])
    setComunicados(coms ?? [])
    setVistosSet(new Set((vstData ?? []).map(v => v.comunicado_id)))
    setLoading(false)
  }

  async function marcarVisto(id) {
    if (vistosSet.has(id)) return
    await supabase.from('comunicados_vistos').upsert({ comunicado_id: id, usuario_id: usuario.id }, { onConflict: 'comunicado_id,usuario_id' })
    setVistosSet(prev => new Set([...prev, id]))
  }

  function toggleAbierto(id) {
    setAbierto(prev => prev === id ? null : id)
    marcarVisto(id)
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Novedades</h1>

      {comunicados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📋</p>
          <p>Sin novedades por el momento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comunicados.map(c => {
            const leido = vistosSet.has(c.id)
            const isOpen = abierto === c.id
            return (
              <div key={c.id}
                className={`bg-white rounded-xl border transition ${c.fijado ? 'border-black' : leido ? 'border-gray-100' : 'border-gray-300'}`}>
                <button className="w-full text-left px-4 py-4" onClick={() => toggleAbierto(c.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        {c.fijado && <span className="text-xs bg-black text-white rounded-full px-2 py-0.5">Fijado</span>}
                        {!leido && <span className="w-2 h-2 bg-black rounded-full shrink-0" />}
                        <p className={`font-semibold text-sm ${leido ? 'text-gray-600' : 'text-black'}`}>{c.titulo}</p>
                      </div>
                      <p className="text-xs text-gray-400">
                        {new Date(c.created_at).toLocaleDateString('es-AR', { dateStyle: 'long' })}
                      </p>
                    </div>
                    <span className="text-gray-400 text-sm shrink-0">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{c.contenido}</p>
                    {c.expira_at && (
                      <p className="text-xs text-gray-300 mt-2">Disponible hasta {c.expira_at}</p>
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

// Hook exportado para el badge en Layout
export async function fetchNovedadesBadge(localId, usuarioId) {
  if (!localId || !usuarioId) return 0
  const hoy = new Date().toISOString().split('T')[0]
  const [{ data: coms }, { data: vistos }] = await Promise.all([
    supabase.from('comunicados').select('id').eq('local_id', localId).or(`expira_at.is.null,expira_at.gte.${hoy}`),
    supabase.from('comunicados_vistos').select('comunicado_id').eq('usuario_id', usuarioId),
  ])
  const vistosSet = new Set((vistos ?? []).map(v => v.comunicado_id))
  return (coms ?? []).filter(c => !vistosSet.has(c.id)).length
}
