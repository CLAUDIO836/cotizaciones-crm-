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
    // Intenta abrir como popup flotante; si Chrome lo bloquea, abre en pestaña nueva
    const w = window.open(href, 'crm_popup', 'popup,width=1080,height=800,scrollbars=yes,resizable=yes')
    if (!w) window.open(href, '_blank')
  }

  return (
    <a href={href} onClick={open} style={{ textDecoration: 'none' }}>
      {children}
    </a>
  )
}
