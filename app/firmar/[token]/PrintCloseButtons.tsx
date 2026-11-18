'use client'

export default function PrintCloseButtons() {
  return (
    <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button
        onClick={() => window.print()}
        style={{
          background: '#1B8A4B', color: 'white', border: 'none',
          padding: '8px 16px', borderRadius: 7, fontSize: 13,
          fontWeight: 700, cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: 6,
        }}
      >
        🖨 Imprimir / Guardar PDF
      </button>
      <button
        onClick={() => history.length > 1 ? history.back() : window.close()}
        style={{
          background: '#f3f4f6', color: '#374151',
          border: '1px solid #e5e7eb',
          padding: '8px 16px', borderRadius: 7, fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Cerrar
      </button>
    </div>
  )
}
