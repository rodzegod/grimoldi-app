export function Input({ label, className = '', ...props }) {
  const base = 'w-full border border-vans-gray-line rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vans-black bg-white'
  if (!label) return <input className={`${base} ${className}`} {...props} />
  return (
    <div>
      <label className="block text-xs text-vans-gray-text mb-1">{label}</label>
      <input className={`${base} ${className}`} {...props} />
    </div>
  )
}

export function Textarea({ label, className = '', ...props }) {
  const base = 'w-full border border-vans-gray-line rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vans-black bg-white resize-none'
  if (!label) return <textarea className={`${base} ${className}`} {...props} />
  return (
    <div>
      <label className="block text-xs text-vans-gray-text mb-1">{label}</label>
      <textarea className={`${base} ${className}`} {...props} />
    </div>
  )
}
