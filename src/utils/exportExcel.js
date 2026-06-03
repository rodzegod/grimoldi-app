import * as XLSX from 'xlsx'

/**
 * Genera y descarga un .xlsx con los datos pasados.
 * @param {object[]} data - Array de objetos planos
 * @param {string} filename - Nombre del archivo sin extensión
 * @param {string} sheetName - Nombre de la hoja
 */
export function exportarExcel(data, filename = 'reporte', sheetName = 'Datos') {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  // Auto ancho de columnas
  const cols = Object.keys(data[0] ?? {}).map(key => ({
    wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)) + 2
  }))
  ws['!cols'] = cols

  XLSX.writeFile(wb, `${filename}.xlsx`)
}
