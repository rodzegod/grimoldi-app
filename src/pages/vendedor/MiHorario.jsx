import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useLocal } from '../../hooks/useLocal'

const DIAS_LABEL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const TIPO_COLOR = {
  horario: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  FRANCO: 'bg-blue-50 border-blue-200 text-blue-600',
  'FRANCO MES': 'bg-blue-100 border-blue-200 text-blue-700',
  MERCADERIA: 'bg-amber-50 border-amber-200 text-amber-600',
  LICENCIA: 'bg-purple-50 border-purple-200 text-purple-600',
  INVENTARIO: 'bg-gray-100 border-gray-200 text-gray-600',
}

function getLunes(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function horasDiff(entrada, salida) {
  if (!entrada || !salida) return 0
  const [eh, em] = entrada.split(':').map(Number)
  const [sh, sm] = salida.split(':').map(Number)
  return Math.round(((sh * 60 + sm) - (eh * 60 + em)) / 60 * 10) / 10
}

export default function MiHorario() {
  const { usuario } = useAuth()
  const { localId } = useLocal()
  const [semanaInicio, setSemanaInicio] = useState(() => getLunes(new Date()))
  const [dias, setDias] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (localId && usuario) fetchHorario() }, [semanaInicio, localId, usuario])

  async function fetchHorario() {
    setLoading(true)
    const { data } = await supabase
      .from('horarios')
      .select(`*, horarios_dias(*)`)
      .eq('local_id', localId)
      .eq('semana_inicio', semanaInicio)
      .eq('usuario_id', usuario.id)
      .single()

    setDias(data?.horarios_dias ?? [])
    setLoading(false)
  }

  const totalHoras = dias.reduce((s, d) => s + (d.tipo === 'horario' ? horasDiff(d.hora_entrada, d.hora_salida) : 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Mi Horario</h1>
      </div>

      {/* Selector semana */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setSemanaInicio(addDays(semanaInicio, -7))}
          className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center">‹</button>
        <p className="flex-1 text-center text-sm font-medium">
          {new Date(semanaInicio + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} —{' '}
          {new Date(addDays(semanaInicio, 6) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
        </p>
        <button onClick={() => setSemanaInicio(addDays(semanaInicio, 7))}
          className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center">›</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" /></div>
      ) : dias.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📅</p>
          <p>No hay horario cargado para esta semana</p>
          <p className="text-xs mt-1">El encargado aún no publicó el horario</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {Array.from({ length: 7 }, (_, i) => {
              const dia = dias.find(d => d.dia_semana === i + 1)
              const fecha = addDays(semanaInicio, i)
              const esHoy = fecha === new Date().toISOString().split('T')[0]

              return (
                <div key={i} className={`rounded-xl border p-4 ${esHoy ? 'ring-2 ring-black' : ''} ${dia?.tipo ? TIPO_COLOR[dia.tipo] ?? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-semibold text-sm ${esHoy ? 'font-black' : ''}`}>
                        {DIAS_LABEL[i]} {esHoy && '· Hoy'}
                      </p>
                      <p className="text-xs opacity-70">{fecha}</p>
                    </div>
                    <div className="text-right">
                      {!dia ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : dia.tipo === 'horario' ? (
                        <>
                          <p className="font-bold text-sm">{dia.hora_entrada} — {dia.hora_salida}</p>
                          <p className="text-xs opacity-70">{horasDiff(dia.hora_entrada, dia.hora_salida)}h</p>
                        </>
                      ) : (
                        <span className="font-bold text-sm">{dia.tipo}</span>
                      )}
                    </div>
                  </div>
                  {dia?.observacion && (
                    <p className="text-xs mt-1.5 opacity-70 italic">{dia.observacion}</p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">Total horas semana</p>
            <p className="text-3xl font-black">{totalHoras}h</p>
          </div>
        </>
      )}
    </div>
  )
}
