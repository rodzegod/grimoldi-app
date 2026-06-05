import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useLocal } from '../../hooks/useLocal'

const DIAS = ['D','L','M','X','J','V','S'] // 0=dom,1=lun...6=sab
const DIAS_FULL = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const TIPOS_DB = ['Admin','Operativo','Liderazgo']
const TIPO_LABEL = { Admin: 'Administrativo', Operativo: 'Operativo', Liderazgo: 'Liderazgo' }
const PRIORIDADES = ['Urgente','Importante','Relevante']
const TURNOS = ['mañana','tarde','ambos']

const FORM_DEFAULT = { titulo: '', tipo: 'Operativo', turno: 'mañana', prioridad: 'Importante', frecuencia: 'diaria', dias_semana: [], dia_mes: 1, activa: true }

export default function TareasRecurrentes() {
  const { usuario } = useAuth()
  const { localId } = useLocal()
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(FORM_DEFAULT)
  const [editId, setEditId] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { if (localId) fetchPlantillas() }, [localId])

  async function fetchPlantillas() {
    setLoading(true)
    const { data } = await supabase.from('tareas_plantilla').select('*').eq('local_id', localId).order('created_at')
    setPlantillas(data ?? [])
    setLoading(false)
  }

  function toggleDia(d) {
    setForm(f => ({
      ...f,
      dias_semana: f.dias_semana.includes(d) ? f.dias_semana.filter(x => x !== d) : [...f.dias_semana, d],
    }))
  }

  function abrirEditar(p) {
    setForm({ titulo: p.titulo, tipo: p.tipo, turno: p.turno, prioridad: p.prioridad, frecuencia: p.frecuencia, dias_semana: p.dias_semana ?? [], dia_mes: p.dia_mes ?? 1, activa: p.activa })
    setEditId(p.id)
    setShowForm(true)
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const payload = { ...form, local_id: localId, creado_por: usuario.id }
    if (editId) {
      await supabase.from('tareas_plantilla').update(payload).eq('id', editId)
    } else {
      await supabase.from('tareas_plantilla').insert(payload)
    }

    // Si aplica a hoy, generar la tarea inmediatamente
    const hoy = new Date().toISOString().split('T')[0]
    const hoyDate = new Date()
    const diaSemana = hoyDate.getDay()
    const diaMes = hoyDate.getDate()
    const aplicaHoy =
      form.frecuencia === 'diaria' ||
      (form.frecuencia === 'semanal' && form.dias_semana.includes(diaSemana)) ||
      (form.frecuencia === 'mensual' && form.dia_mes === diaMes)

    if (aplicaHoy && !editId) {
      // Verificar si ya existe tarea con ese título hoy
      const { data: existente } = await supabase
        .from('tareas').select('id').eq('local_id', localId).eq('fecha', hoy).eq('titulo', form.titulo).single()
      if (!existente) {
        await supabase.from('tareas').insert({
          titulo: form.titulo, tipo: form.tipo, turno: form.turno, prioridad: form.prioridad,
          local_id: localId, fecha: hoy, creado_por: usuario.id,
        })
      }
    }

    setGuardando(false)
    setShowForm(false)
    setForm(FORM_DEFAULT)
    setEditId(null)
    fetchPlantillas()
  }

  async function toggleActiva(p) {
    await supabase.from('tareas_plantilla').update({ activa: !p.activa }).eq('id', p.id)
    setPlantillas(prev => prev.map(x => x.id === p.id ? { ...x, activa: !p.activa } : x))
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    await supabase.from('tareas_plantilla').delete().eq('id', id)
    fetchPlantillas()
  }

  function frecLabel(p) {
    if (p.frecuencia === 'diaria') return 'Todos los días'
    if (p.frecuencia === 'mensual') return `Día ${p.dia_mes} del mes`
    if (p.frecuencia === 'semanal' && p.dias_semana?.length) {
      return p.dias_semana.map(d => DIAS_FULL[d]).join(', ')
    }
    return 'Semanal'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Tareas Recurrentes</h1>
        <button onClick={() => { setForm(FORM_DEFAULT); setEditId(null); setShowForm(true) }}
          className="bg-black text-white text-sm rounded-xl px-4 py-2">+ Nueva</button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-8 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold mb-4">{editId ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
            <form onSubmit={guardar} className="space-y-3">
              <input required placeholder="Título de la tarea" value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-black" />

              {/* Tipo */}
              <div className="grid grid-cols-3 gap-2">
                {TIPOS_DB.map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, tipo: t }))}
                    className={`py-2 rounded-xl text-xs font-medium border ${form.tipo === t ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
                    {TIPO_LABEL[t]}
                  </button>
                ))}
              </div>

              {/* Turno */}
              <div className="grid grid-cols-3 gap-2">
                {TURNOS.map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, turno: t }))}
                    className={`py-2 rounded-xl text-xs font-medium border capitalize ${form.turno === t ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Prioridad */}
              <div className="grid grid-cols-3 gap-2">
                {PRIORIDADES.map(p => (
                  <button key={p} type="button" onClick={() => setForm(f => ({ ...f, prioridad: p }))}
                    className={`py-2 rounded-xl text-xs font-medium border ${form.prioridad === p ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
                    {p}
                  </button>
                ))}
              </div>

              {/* Frecuencia */}
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Frecuencia</label>
                <div className="grid grid-cols-3 gap-2">
                  {['diaria','semanal','mensual'].map(f => (
                    <button key={f} type="button" onClick={() => setForm(frm => ({ ...frm, frecuencia: f }))}
                      className={`py-2 rounded-xl text-xs font-medium border capitalize ${form.frecuencia === f ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Días semana (solo semanal) */}
              {form.frecuencia === 'semanal' && (
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">Días de la semana</label>
                  <div className="flex gap-1.5">
                    {DIAS.map((d, i) => (
                      <button key={i} type="button" onClick={() => toggleDia(i)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${form.dias_semana.includes(i) ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Día del mes (solo mensual) */}
              {form.frecuencia === 'mensual' && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-500">Día del mes</label>
                  <input type="number" min={1} max={31} value={form.dia_mes}
                    onChange={e => setForm(f => ({ ...f, dia_mes: parseInt(e.target.value) || 1 }))}
                    className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-black" />
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowForm(false); setEditId(null) }}
                  className="flex-1 border border-gray-200 rounded-xl py-3 text-sm">Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 bg-black text-white rounded-xl py-3 text-sm font-bold disabled:opacity-50">
                  {guardando ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" /></div>
      ) : plantillas.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No hay plantillas. Creá la primera.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plantillas.map(p => (
            <div key={p.id} className={`bg-white border rounded-xl px-4 py-3 ${p.activa ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.titulo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {TIPO_LABEL[p.tipo]} · {p.turno} · {p.prioridad}
                  </p>
                  <p className="text-xs text-blue-500 mt-0.5">{frecLabel(p)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActiva(p)}
                    className={`text-xs rounded-full px-2 py-0.5 border ${p.activa ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                    {p.activa ? 'Activa' : 'Pausada'}
                  </button>
                  <button onClick={() => abrirEditar(p)} className="text-xs text-gray-400 hover:text-black">✎</button>
                  <button onClick={() => eliminar(p.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
