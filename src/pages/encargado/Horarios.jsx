import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useLocal } from '../../hooks/useLocal'

const TIPOS_HORARIO = ['horario','FRANCO','FRANCO MES','MERCADERIA','LICENCIA','INVENTARIO']
const DIAS_LABEL = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
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

const CELL_DEFAULT = () => ({
  tipo: '', hora_entrada: '', hora_salida: '',
  horas_extra: 0, horas_devueltas: 0, observacion: '', _id: null,
})

export default function Horarios() {
  const { localId } = useLocal()
  const [semanaInicio, setSemanaInicio] = useState(() => getLunes(new Date()))
  const [empleados, setEmpleados] = useState([])
  const [horarioIds, setHorarioIds] = useState({})   // userId → horario_id
  const [dias, setDias] = useState({})               // `${userId}-${d}` → cell
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState(false)

  useEffect(() => { if (localId) fetchEmpleados() }, [localId])
  useEffect(() => { if (localId && empleados.length) fetchHorarios() }, [semanaInicio, empleados])

  async function fetchEmpleados() {
    const { data, error } = await supabase
      .from('usuarios').select('id, nombre')
      .eq('local_id', localId).in('rol', ['vendedor', 'encargado']).order('nombre')
    if (error) { setSaveError('Error cargando empleados: ' + error.message); return }
    setEmpleados(data ?? [])
  }

  async function fetchHorarios() {
    setLoading(true)
    const { data: horData, error } = await supabase
      .from('horarios')
      .select(`id, usuario_id, horarios_dias(*)`)
      .eq('local_id', localId)
      .eq('semana_inicio', semanaInicio)

    if (error) { setSaveError('Error cargando horarios: ' + error.message); setLoading(false); return }

    const newIds = {}
    const newDias = {}
    empleados.forEach(e => {
      for (let d = 1; d <= 7; d++) newDias[`${e.id}-${d}`] = CELL_DEFAULT()
    })

    ;(horData ?? []).forEach(h => {
      newIds[h.usuario_id] = h.id
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

    setHorarioIds(newIds)
    setDias(newDias)
    setLoading(false)
  }

  function updateCell(userId, dia, field, value) {
    setDias(prev => ({
      ...prev,
      [`${userId}-${dia}`]: { ...(prev[`${userId}-${dia}`] ?? CELL_DEFAULT()), [field]: value },
    }))
  }

  async function guardarSemana() {
    setGuardando(true)
    setSaveError('')
    setSaveOk(false)

    const newIds = { ...horarioIds }

    for (const emp of empleados) {
      // 1. Obtener o crear el registro de horario para este empleado/semana
      let horId = newIds[emp.id]
      if (!horId) {
        const { data: h, error: hErr } = await supabase
          .from('horarios')
          .upsert(
            { local_id: localId, semana_inicio: semanaInicio, usuario_id: emp.id },
            { onConflict: 'local_id,semana_inicio,usuario_id' }
          )
          .select('id')
          .single()

        if (hErr || !h?.id) {
          setSaveError(`Error al crear horario de ${emp.nombre}: ${hErr?.message ?? 'sin ID'}`)
          setGuardando(false)
          return
        }
        horId = h.id
        newIds[emp.id] = horId
      }

      // 2. Upsert cada día que tenga tipo seleccionado
      for (let d = 1; d <= 7; d++) {
        const cell = dias[`${emp.id}-${d}`]
        if (!cell?.tipo) continue

        const payload = {
          horario_id: horId,
          dia_semana: d,
          tipo: cell.tipo,
          hora_entrada: cell.tipo === 'horario' ? (cell.hora_entrada || null) : null,
          hora_salida:  cell.tipo === 'horario' ? (cell.hora_salida  || null) : null,
          horas_extra:     parseFloat(cell.horas_extra)     || 0,
          horas_devueltas: parseFloat(cell.horas_devueltas) || 0,
          observacion: cell.observacion || null,
        }

        const { data: saved, error: dErr } = await supabase
          .from('horarios_dias')
          .upsert(payload, { onConflict: 'horario_id,dia_semana' })
          .select('id')
          .single()

        if (dErr) {
          setSaveError(`Error guardando ${emp.nombre} día ${d}: ${dErr.message}`)
          setGuardando(false)
          return
        }

        // Actualizar _id local para futuras ediciones sin re-fetch
        if (saved?.id && !cell._id) {
          updateCell(emp.id, d, '_id', saved.id)
        }
      }
    }

    setHorarioIds(newIds)
    setGuardando(false)
    setSaveOk(true)
    setTimeout(() => setSaveOk(false), 2500)
  }

  async function copiarSemanaAnterior() {
    const semAnt = addDays(semanaInicio, -7)
    const { data: horAnt, error } = await supabase
      .from('horarios')
      .select(`usuario_id, horarios_dias(*)`)
      .eq('local_id', localId)
      .eq('semana_inicio', semAnt)

    if (error) { setSaveError('Error copiando semana: ' + error.message); return }
    if (!horAnt?.length) { setSaveError('No hay datos de la semana anterior'); return }

    const newDias = { ...dias }
    horAnt.forEach(h => {
      ;(h.horarios_dias ?? []).forEach(dd => {
        newDias[`${h.usuario_id}-${dd.dia_semana}`] = {
          tipo: dd.tipo ?? '', hora_entrada: dd.hora_entrada ?? '',
          hora_salida: dd.hora_salida ?? '', horas_extra: dd.horas_extra ?? 0,
          horas_devueltas: dd.horas_devueltas ?? 0, observacion: dd.observacion ?? '',
          _id: null, // nuevo registro
        }
      })
    })
    setDias(newDias)
    setSaveError('')
  }

  const diasSemana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(semanaInicio, i)),
    [semanaInicio]
  )

  function totalHoras(userId) {
    let t = 0
    for (let d = 1; d <= 7; d++) {
      const c = dias[`${userId}-${d}`]
      if (c?.tipo === 'horario') t += horasDiff(c.hora_entrada, c.hora_salida)
    }
    return t
  }

  return (
    <div>
      {/* Header + acciones */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Horarios</h1>
        <div className="flex gap-2">
          <button onClick={copiarSemanaAnterior}
            className="text-xs border border-gray-200 rounded-xl px-3 py-2 hover:border-black transition">
            Copiar anterior
          </button>
          <button onClick={guardarSemana} disabled={guardando}
            className={`text-xs rounded-xl px-4 py-2 font-bold disabled:opacity-50 transition
              ${saveOk ? 'bg-emerald-500 text-white' : 'bg-black text-white'}`}>
            {guardando ? 'Guardando...' : saveOk ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Error visible */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 text-sm text-red-600 flex items-start justify-between gap-2">
          <p>{saveError}</p>
          <button onClick={() => setSaveError('')} className="text-red-400 shrink-0">✕</button>
        </div>
      )}

      {/* Selector de semana */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setSemanaInicio(addDays(semanaInicio, -7))}
          className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center">‹</button>
        <p className="flex-1 text-center text-sm font-medium">
          {new Date(semanaInicio + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
          {' — '}
          {new Date(addDays(semanaInicio, 6) + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
        </p>
        <button onClick={() => setSemanaInicio(addDays(semanaInicio, 7))}
          className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center">›</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      ) : empleados.length === 0 ? (
        <p className="text-center py-6 text-gray-400">Sin empleados cargados en este local</p>
      ) : (
        <div className="space-y-4">
          {empleados.map(emp => (
            <div key={emp.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                <p className="font-semibold text-sm">{emp.nombre}</p>
                <p className="text-xs text-gray-400 font-bold">{totalHoras(emp.id)}h</p>
              </div>
              <div className="overflow-x-auto">
                <div className="flex min-w-max p-3 gap-2">
                  {Array.from({ length: 7 }, (_, i) => {
                    const diaSemana = i + 1
                    const cell = dias[`${emp.id}-${diaSemana}`] ?? CELL_DEFAULT()
                    const horas = cell.tipo === 'horario'
                      ? horasDiff(cell.hora_entrada, cell.hora_salida)
                      : 0

                    return (
                      <div key={diaSemana} className="w-28 shrink-0">
                        <div className="text-center mb-1">
                          <p className="text-xs font-medium text-gray-500">{DIAS_LABEL[i]}</p>
                          <p className="text-[10px] text-gray-300">{diasSemana[i]?.slice(5)}</p>
                        </div>

                        <select
                          value={cell.tipo}
                          onChange={e => updateCell(emp.id, diaSemana, 'tipo', e.target.value)}
                          className={`w-full text-xs rounded-lg px-1.5 py-1.5 border-0 focus:outline-none
                            ${TIPO_COLOR[cell.tipo] || 'bg-gray-50 text-gray-400'}`}
                        >
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
                            {horas > 0 && (
                              <p className="text-[10px] text-center text-emerald-600 font-bold">{horas}h</p>
                            )}
                          </div>
                        )}

                        <input
                          placeholder="obs..."
                          value={cell.observacion}
                          onChange={e => updateCell(emp.id, diaSemana, 'observacion', e.target.value)}
                          className="mt-1 w-full text-[10px] border border-gray-100 rounded px-1 py-0.5 focus:outline-none text-gray-500"
                        />
                      </div>
                    )
                  })}

                  {/* Columna totales */}
                  <div className="w-16 shrink-0 flex flex-col items-center justify-center text-center pl-2 border-l border-gray-100">
                    <p className="text-[10px] text-gray-400 mb-1">Total</p>
                    <p className="text-xl font-black">{totalHoras(emp.id)}<span className="text-xs font-normal">h</span></p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
