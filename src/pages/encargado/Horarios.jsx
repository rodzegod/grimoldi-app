import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'

const TIPOS_HORARIO = ['horario','FRANCO','FRANCO MES','MERCADERIA','LICENCIA','INVENTARIO']
const DIAS_LABEL = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'] // dia_semana 1-7
const TIPO_COLOR = {
  horario: 'bg-emerald-50 text-emerald-700',
  FRANCO: 'bg-blue-50 text-blue-600',
  'FRANCO MES': 'bg-blue-100 text-blue-700',
  MERCADERIA: 'bg-amber-50 text-amber-600',
  LICENCIA: 'bg-purple-50 text-purple-600',
  INVENTARIO: 'bg-gray-100 text-gray-600',
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
  const mins = (sh * 60 + sm) - (eh * 60 + em)
  return Math.round(mins / 60 * 10) / 10
}

const CELL_DEFAULT = () => ({ tipo: '', hora_entrada: '', hora_salida: '', horas_extra: 0, horas_devueltas: 0, observacion: '' })

export default function Horarios() {
  const { localId } = useLocal()
  const [semanaInicio, setSemanaInicio] = useState(() => getLunes(new Date()))
  const [empleados, setEmpleados] = useState([])
  const [horarios, setHorarios] = useState({}) // userId → horario_id
  const [dias, setDias] = useState({}) // `${userId}-${diaSemana}` → cell data
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [vista, setVista] = useState('semana') // semana | mes

  useEffect(() => { if (localId) { fetchEmpleados() } }, [localId])
  useEffect(() => { if (localId && empleados.length) { fetchHorarios() } }, [semanaInicio, empleados])

  async function fetchEmpleados() {
    const { data } = await supabase.from('usuarios').select('id, nombre').eq('local_id', localId)
      .in('rol', ['vendedor', 'encargado']).order('nombre')
    setEmpleados(data ?? [])
  }

  async function fetchHorarios() {
    setLoading(true)
    const { data: horData } = await supabase
      .from('horarios')
      .select(`*, horarios_dias(*)`)
      .eq('local_id', localId)
      .eq('semana_inicio', semanaInicio)

    const newHorarios = {}
    const newDias = {}

    // Inicializar celdas vacías
    empleados.forEach(e => {
      for (let d = 1; d <= 7; d++) newDias[`${e.id}-${d}`] = CELL_DEFAULT()
    })

    ;(horData ?? []).forEach(h => {
      newHorarios[h.usuario_id] = h.id
      ;(h.horarios_dias ?? []).forEach(dd => {
        newDias[`${h.usuario_id}-${dd.dia_semana}`] = {
          tipo: dd.tipo ?? '',
          hora_entrada: dd.hora_entrada ?? '',
          hora_salida: dd.hora_salida ?? '',
          horas_extra: dd.horas_extra ?? 0,
          horas_devueltas: dd.horas_devueltas ?? 0,
          observacion: dd.observacion ?? '',
          _id: dd.id,
        }
      })
    })

    setHorarios(newHorarios)
    setDias(newDias)
    setLoading(false)
  }

  function updateCell(userId, dia, field, value) {
    setDias(prev => ({
      ...prev,
      [`${userId}-${dia}`]: { ...prev[`${userId}-${dia}`], [field]: value },
    }))
  }

  async function guardarSemana() {
    setGuardando(true)
    for (const emp of empleados) {
      let horId = horarios[emp.id]
      if (!horId) {
        const { data: h } = await supabase.from('horarios').upsert(
          { local_id: localId, semana_inicio: semanaInicio, usuario_id: emp.id },
          { onConflict: 'local_id,semana_inicio,usuario_id' }
        ).select().single()
        horId = h?.id
      }
      if (!horId) continue

      for (let d = 1; d <= 7; d++) {
        const cell = dias[`${emp.id}-${d}`]
        if (!cell?.tipo) continue
        const payload = {
          horario_id: horId, dia_semana: d,
          tipo: cell.tipo,
          hora_entrada: cell.tipo === 'horario' ? cell.hora_entrada || null : null,
          hora_salida: cell.tipo === 'horario' ? cell.hora_salida || null : null,
          horas_extra: parseFloat(cell.horas_extra) || 0,
          horas_devueltas: parseFloat(cell.horas_devueltas) || 0,
          observacion: cell.observacion || null,
        }
        if (cell._id) {
          await supabase.from('horarios_dias').update(payload).eq('id', cell._id)
        } else {
          const { data: nd } = await supabase.from('horarios_dias').upsert(payload, { onConflict: 'horario_id,dia_semana' }).select().single()
          if (nd) updateCell(emp.id, d, '_id', nd.id)
        }
      }
    }
    setGuardando(false)
  }

  async function copiarSemanaAnterior() {
    const semAnt = addDays(semanaInicio, -7)
    const { data: horAnt } = await supabase
      .from('horarios').select(`*, horarios_dias(*)`)
      .eq('local_id', localId).eq('semana_inicio', semAnt)

    if (!horAnt?.length) { alert('No hay datos de la semana anterior'); return }

    const newDias = { ...dias }
    horAnt.forEach(h => {
      ;(h.horarios_dias ?? []).forEach(dd => {
        const key = `${h.usuario_id}-${dd.dia_semana}`
        newDias[key] = {
          tipo: dd.tipo ?? '', hora_entrada: dd.hora_entrada ?? '',
          hora_salida: dd.hora_salida ?? '', horas_extra: dd.horas_extra ?? 0,
          horas_devueltas: dd.horas_devueltas ?? 0, observacion: dd.observacion ?? '',
        }
      })
    })
    setDias(newDias)
  }

  const diasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(semanaInicio, i)), [semanaInicio])

  function totalHoras(userId) {
    let total = 0
    for (let d = 1; d <= 7; d++) {
      const c = dias[`${userId}-${d}`]
      if (c?.tipo === 'horario') total += horasDiff(c.hora_entrada, c.hora_salida)
    }
    return total
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Horarios</h1>
        <div className="flex gap-2">
          <button onClick={copiarSemanaAnterior} className="text-xs border border-gray-200 rounded-xl px-3 py-2">Copiar ant.</button>
          <button onClick={guardarSemana} disabled={guardando}
            className="bg-black text-white text-xs rounded-xl px-3 py-2 disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Selector semana */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setSemanaInicio(addDays(semanaInicio, -7))}
          className="w-8 h-8 border border-gray-200 rounded-lg text-sm flex items-center justify-center">‹</button>
        <p className="flex-1 text-center text-sm font-medium">
          {new Date(semanaInicio + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} —{' '}
          {new Date(addDays(semanaInicio, 6) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
        </p>
        <button onClick={() => setSemanaInicio(addDays(semanaInicio, 7))}
          className="w-8 h-8 border border-gray-200 rounded-lg text-sm flex items-center justify-center">›</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {empleados.map(emp => (
            <div key={emp.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                <p className="font-semibold text-sm">{emp.nombre}</p>
                <p className="text-xs text-gray-400">{totalHoras(emp.id)}h</p>
              </div>
              <div className="overflow-x-auto">
                <div className="flex min-w-max p-3 gap-2">
                  {Array.from({ length: 7 }, (_, i) => {
                    const diaSemana = i + 1
                    const cell = dias[`${emp.id}-${diaSemana}`] ?? CELL_DEFAULT()
                    const horas = cell.tipo === 'horario' ? horasDiff(cell.hora_entrada, cell.hora_salida) : 0

                    return (
                      <div key={diaSemana} className="w-28 shrink-0">
                        <div className="text-center mb-1">
                          <p className="text-xs font-medium text-gray-500">{DIAS_LABEL[i]}</p>
                          <p className="text-[10px] text-gray-300">{diasSemana[i]?.slice(5)}</p>
                        </div>
                        <select value={cell.tipo}
                          onChange={e => updateCell(emp.id, diaSemana, 'tipo', e.target.value)}
                          className={`w-full text-xs rounded-lg px-1.5 py-1.5 border-0 focus:outline-none ${TIPO_COLOR[cell.tipo] || 'bg-gray-50 text-gray-400'}`}>
                          <option value="">—</option>
                          {TIPOS_HORARIO.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {cell.tipo === 'horario' && (
                          <div className="mt-1.5 space-y-1">
                            <input type="time" value={cell.hora_entrada}
                              onChange={e => updateCell(emp.id, diaSemana, 'hora_entrada', e.target.value)}
                              className="w-full text-xs border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-black" />
                            <input type="time" value={cell.hora_salida}
                              onChange={e => updateCell(emp.id, diaSemana, 'hora_salida', e.target.value)}
                              className="w-full text-xs border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-black" />
                            {horas > 0 && <p className="text-[10px] text-center text-gray-400">{horas}h</p>}
                          </div>
                        )}
                        <input placeholder="obs..." value={cell.observacion}
                          onChange={e => updateCell(emp.id, diaSemana, 'observacion', e.target.value)}
                          className="mt-1 w-full text-[10px] border border-gray-100 rounded px-1 py-0.5 focus:outline-none text-gray-500" />
                      </div>
                    )
                  })}
                  {/* Totales */}
                  <div className="w-20 shrink-0 flex flex-col justify-center text-center">
                    <p className="text-xs text-gray-400 mb-1">Total</p>
                    <p className="text-lg font-black">{totalHoras(emp.id)}h</p>
                    <div className="mt-1 space-y-1">
                      <div>
                        <label className="text-[10px] text-gray-400">Extra</label>
                        <input type="number" step="0.5" min="0"
                          value={(() => { let t = 0; for(let d=1;d<=7;d++) t+=parseFloat(dias[`${emp.id}-${d}`]?.horas_extra||0); return t })()}
                          onChange={() => {}}
                          className="w-full text-xs border border-gray-100 rounded px-1 py-0.5 text-center focus:outline-none" readOnly />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {empleados.length === 0 && <p className="text-center py-6 text-gray-400">Sin empleados cargados</p>}
        </div>
      )}
    </div>
  )
}
