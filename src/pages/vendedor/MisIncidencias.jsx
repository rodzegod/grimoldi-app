import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const ESTADO_CONFIG = {
  abierta: { label: 'Abierta', cls: 'bg-red-100 text-red-700' },
  en_proceso: { label: 'En proceso', cls: 'bg-amber-100 text-amber-700' },
  resuelta: { label: 'Resuelta', cls: 'bg-emerald-100 text-emerald-700' },
}

const TIPO_LABEL = {
  talle_faltante: 'Talle faltante',
  par_incompleto: 'Par incompleto',
  pies_cruzados: 'Pies cruzados',
  defecto_producto: 'Defecto',
  otro: 'Otro',
}

export default function MisIncidencias() {
  const { usuario } = useAuth()
  const [incidencias, setIncidencias] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (usuario) fetchIncidencias()
  }, [usuario])

  async function fetchIncidencias() {
    setLoading(true)
    const { data } = await supabase
      .from('incidencias')
      .select(`*, productos(codigo, modelo, medida), zonas(nombre)`)
      .eq('reportado_por', usuario.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setIncidencias(data ?? [])
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Mis Reportes</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : incidencias.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">!</p>
          <p>No reportaste incidencias todavía</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidencias.map(inc => {
            const estado = ESTADO_CONFIG[inc.estado] ?? { label: inc.estado, cls: 'bg-gray-100' }
            return (
              <div key={inc.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{TIPO_LABEL[inc.tipo] ?? inc.tipo}</p>
                    {inc.productos && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {inc.productos.codigo} · {inc.productos.modelo} T{inc.productos.medida}
                      </p>
                    )}
                    {inc.zonas && (
                      <p className="text-xs text-gray-400">{inc.zonas.nombre}</p>
                    )}
                    {inc.descripcion && (
                      <p className="text-xs text-gray-600 mt-1">{inc.descripcion}</p>
                    )}
                    {inc.nota_resolucion && (
                      <p className="text-xs text-emerald-600 mt-1">✓ {inc.nota_resolucion}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-xs rounded-full px-2 py-0.5 ${estado.cls}`}>
                      {estado.label}
                    </span>
                    {inc.prioridad === 'Urgente' && (
                      <span className="text-xs text-red-500 font-medium">Urgente</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-300 mt-2">
                  {new Date(inc.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
