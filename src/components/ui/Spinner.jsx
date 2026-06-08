export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-8 h-8 border-2' }
  return (
    <div className={`${sizes[size]} border-vans-black border-t-transparent rounded-full animate-spin ${className}`} />
  )
}

export function SpinnerPage() {
  return (
    <div className="flex justify-center py-12">
      <Spinner size="md" />
    </div>
  )
}
