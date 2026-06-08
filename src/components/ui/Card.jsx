export function Card({ className = '', children, ...props }) {
  return (
    <div className={`bg-white border border-vans-gray-line rounded-xl ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardLg({ className = '', children, ...props }) {
  return (
    <div className={`bg-white border border-vans-gray-line rounded-2xl ${className}`} {...props}>
      {children}
    </div>
  )
}
