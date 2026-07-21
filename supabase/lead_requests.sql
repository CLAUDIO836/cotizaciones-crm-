-- Tabla de solicitudes públicas (leads entrantes desde formularios web)
CREATE TABLE lead_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Empresa de destino (transccl | tks | trackingccl)
  target_company TEXT NOT NULL CHECK (target_company IN ('transccl', 'tks', 'trackingccl')),

  -- Tipo de servicio
  tipo_servicio TEXT NOT NULL CHECK (tipo_servicio IN ('traslado_diario', 'traslado_educativo', 'viaje_especial', 'otro')),

  -- Datos empresa cliente
  empresa_nombre TEXT NOT NULL,
  empresa_rut TEXT,
  contacto_nombre TEXT NOT NULL,
  contacto_cargo TEXT,
  contacto_email TEXT NOT NULL,
  contacto_telefono TEXT NOT NULL,

  -- Datos del servicio
  desde TEXT,
  hasta TEXT,
  fecha_inicio DATE,
  frecuencia TEXT,                 -- diaria | semanal | dias_especificos | unica
  dias_semana TEXT[],              -- ['lunes','martes',...] para frecuencia semanal
  pasajeros_aprox INT,
  vehiculo_preferido TEXT,         -- bus | taxibus | minibus | minivan | sin_preferencia
  requiere_factura BOOLEAN DEFAULT false,

  -- Facturación (si requiere_factura)
  factura_razon_social TEXT,
  factura_rut TEXT,
  factura_direccion TEXT,
  factura_giro TEXT,
  factura_email TEXT,

  -- Traslados educativos
  establecimiento_nombre TEXT,
  cantidad_alumnos INT,

  -- Viajes especiales
  motivo_viaje TEXT,

  -- Observaciones libres
  observaciones TEXT,

  -- Estado en CRM
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_revision', 'convertido', 'descartado')),
  assigned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  crm_notes TEXT,

  -- Metadatos
  ip_address TEXT,
  user_agent TEXT
);

ALTER TABLE lead_requests ENABLE ROW LEVEL SECURITY;

-- Solo usuarios autenticados ven solicitudes
CREATE POLICY "lead_requests_select" ON lead_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_requests_update" ON lead_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "lead_requests_delete" ON lead_requests FOR DELETE TO authenticated USING (true);

-- Insert público (sin auth) para que el formulario funcione desde internet
CREATE POLICY "lead_requests_insert_public" ON lead_requests FOR INSERT WITH CHECK (true);
