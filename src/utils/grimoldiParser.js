import * as XLSX from 'xlsx'

/**
 * Parsea el Excel de Grimoldi.
 * Columnas: A=Código, B=Familia, C=Marca, E=Modelo, J=Línea, P=Género, Q=Medida, R=Stock Disp.
 */
export function parseGrimoldiExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })

        const productos = []
        let currentSKU = null
        let currentData = {}

        for (let i = 8; i < rows.length; i++) {
          const row = rows[i]
          const colA = String(row[0]  ?? '').trim()  // Código
          const colB = String(row[1]  ?? '').trim()  // Familia
          const colC = String(row[2]  ?? '').trim()  // Marca
          const colE = String(row[4]  ?? '').trim()  // Modelo
          const colJ = String(row[9]  ?? '').trim()  // Línea
          const colP = String(row[15] ?? '').trim()  // Género
          const colQ = String(row[16] ?? '').trim()  // Medida (talle)
          const colR = parseInt(row[17] ?? 0) || 0   // Stock Disponible

          if (colQ.toLowerCase() === 'total') continue

          if (colA !== '') {
            currentSKU = colA
            currentData = {
              codigo: colA, familia: colB || null, marca: colC || null,
              modelo: colE || null, linea: colJ || null, genero: colP || null,
            }
          }

          if (currentSKU && colQ !== '') {
            productos.push({ ...currentData, medida: colQ, stock: colR })
          }
        }

        resolve(productos)
      } catch (err) {
        reject(new Error('Error al parsear el Excel: ' + err.message))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}
