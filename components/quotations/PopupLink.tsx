'use client'

export default function PopupLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  function open(e: React.MouseEvent) {
    e.preventDefault()
    const w = window.open(
      href,
      '_blank',
      'toolbar=no,location=no,menubar=no,scrollbars=yes,resizable=yes,width=1080,height=800'
    )
    // Si el popup fue bloqueado por el navegador, abrir en pestaña normal
    if (!w) window.open(href, '_blank')
  }

  return (
    <a href={href} onClick={open} style={{ textDecoration: 'none' }}>
      {children}
    </a>
  )
}
