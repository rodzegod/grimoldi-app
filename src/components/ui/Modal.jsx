export function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function ModalSheet({ children }) {
  return (
    <div className="fixed inset-0 bg-black/55 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-8 max-h-[90vh] overflow-y-auto shadow-xl">
        {children}
      </div>
    </div>
  )
}
