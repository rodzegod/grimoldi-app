import { useEffect, useRef, useState } from 'react'

export default function BarcodeScanner({ onScan, onClose }) {
  const containerRef = useRef(null)
  const scannerRef = useRef(null)
  const mountedRef = useRef(true)
  const [error, setError] = useState('')

  useEffect(() => {
    mountedRef.current = true
    const containerId = 'barcode-reader-' + Date.now()

    async function startScanner() {
      const { Html5Qrcode } = await import('html5-qrcode')

      // Si el componente se desmontó durante el import, salir
      if (!mountedRef.current) return

      const scanner = new Html5Qrcode(containerId)
      scannerRef.current = scanner

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            if (mountedRef.current) onScan(decodedText)
          },
          () => {}
        )
      } catch (err) {
        if (mountedRef.current) {
          setError('No se pudo acceder a la cámara. Verificá los permisos del navegador.')
        }
      }
    }

    if (containerRef.current) {
      containerRef.current.id = containerId
      startScanner()
    }

    return () => {
      mountedRef.current = false
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">Escanear código de barras</p>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none px-2 py-1">×</button>
        </div>
        {error ? (
          <div className="p-6 text-center">
            <p className="text-red-500 text-sm mb-3">{error}</p>
            <button onClick={onClose} className="text-xs text-gray-500 underline">Cerrar</button>
          </div>
        ) : (
          <div ref={containerRef} className="w-full min-h-[200px]" />
        )}
        <p className="text-center text-xs text-gray-400 py-3 px-4">
          Apuntá la cámara al código de barras del producto
        </p>
      </div>
    </div>
  )
}
