export function Select({ label, className = '', children, ...props }) {
  const base = 'w-full border border-vans-gray-line rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-vans-black bg-white appearance-none'
  if (!label) return <select className={`${base} ${className}`} {...props}>{children}</select>
  return (
    <div>
      <label className="block text-xs text-vans-gray-text mb-1">{label}</label>
      <select className={`${base} ${className}`} {...props}>{children}</select>
    </div>
  )
}
