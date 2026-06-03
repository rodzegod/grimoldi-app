import { useEffect, useRef, useState } from 'react'

/**
 * Lector de código de barras usando html5-qrcode.
 * Llama onScan(decodedText) cuando detecta un código.
 * Requiere HTTPS en producción (Netlify/Vercel lo proveen).
 */
export default function BarcodeScanner({ onScan, onClose }) {
  const containerRef = useRef(null)
  const scannerRef = useRef(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let html5QrCode
    const containerId = 'barcode-reader-' + Date.now()

    async function startScanner() {
      // Import dinámico para no romper SSR
      const { Html5Qrcode } = await import('html5-qrcode')
      html5QrCode = new Html5Qrcode(containerId)
      scannerRef.current = html5QrCode

      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            onScan(decodedText)
          },
          () => {} // error silencioso por frame
        )
      } catch (err) {
        setError('No se pudo acceder a la cámara. Verificá los permisos.')
        console.error(err)
      }
    }

    // Crear el div manualmente con el ID que html5-qrcode espera
    if (containerRef.current) {
      containerRef.current.id = containerId
      startScanner()
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">Escanear código de barras</p>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
        </div>
        {error ? (
          <div className="p-6 text-center text-red-500 text-sm">{error}</div>
        ) : (
          <div ref={containerRef} className="w-full" />
        )}
        <p className="text-center text-xs text-gray-400 py-3">
          Apuntá la cámara al código del producto
        </p>
      </div>
    </div>
  )
}
