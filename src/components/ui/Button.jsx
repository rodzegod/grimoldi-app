export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center font-bold rounded-xl transition disabled:opacity-45 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-3',
    lg: 'text-sm px-6 py-3.5',
    full: 'text-sm px-4 py-3 w-full',
  }
  const variants = {
    primary:   'bg-vans-red text-white hover:opacity-90',
    secondary: 'bg-white text-vans-black border border-vans-black hover:bg-vans-gray-bg',
    danger:    'bg-vans-red text-white hover:opacity-90',
    ghost:     'text-vans-gray-text hover:text-vans-black border border-vans-gray-line hover:border-vans-black',
    dark:      'bg-vans-black text-white hover:opacity-90',
  }
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
