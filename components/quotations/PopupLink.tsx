'use client'

export default function PopupLink({
  href,
  children,
  className,
  style,
}: {
  href: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      className={className}
      style={{ cursor: 'pointer', ...style }}
      onClick={() => window.open(href, '_blank', 'width=1050,height=780,scrollbars=yes,resizable=yes')}
    >
      {children}
    </span>
  )
}
