const VARIANTS = {
  success:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning:  'bg-amber-100 text-amber-700 border-amber-200',
  danger:   'bg-red-100 text-red-700 border-red-200',
  info:     'bg-blue-100 text-blue-700 border-blue-200',
  neutral:  'bg-gray-100 text-gray-600 border-gray-200',
  dark:     'bg-vans-black text-white border-vans-black',
  red:      'bg-vans-red text-white border-vans-red',
}

export function Badge({ variant = 'neutral', className = '', children }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 border ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  )
}
