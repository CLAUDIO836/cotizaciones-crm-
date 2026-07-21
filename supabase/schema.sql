-- ============================================
-- SCHEMA: Sistema de Cotizaciones y Contratos
-- ============================================

-- Perfiles de usuario (extensión de auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: crear perfil automáticamente al registrar usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 'vendedor');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Clientes
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rut TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cotizaciones
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'won', 'lost')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(5,2) NOT NULL DEFAULT 19,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ítems de cotización
CREATE TABLE quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  codigo TEXT,
  description TEXT NOT NULL,
  pasajeros INT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order INT NOT NULL DEFAULT 0
);

-- Contratos
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE NOT NULL,
  quotation_id UUID REFERENCES quotations(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Función para generar número de cotización
CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT AS $$
DECLARE
  year_str TEXT := TO_CHAR(NOW(), 'YYYY');
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(number, '-', 3) AS INT)), 0) + 1
  INTO next_num
  FROM quotations
  WHERE number LIKE 'COT-' || year_str || '-%';
  RETURN 'COT-' || year_str || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Función para generar número de contrato
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TEXT AS $$
DECLARE
  year_str TEXT := TO_CHAR(NOW(), 'YYYY');
  next_num INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(number, '-', 3) AS INT)), 0) + 1
  INTO next_num
  FROM contracts
  WHERE number LIKE 'CON-' || year_str || '-%';
  RETURN 'CON-' || year_str || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger: actualizar updated_at en cotizaciones
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotations_updated_at
  BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Profiles: todos ven todos los perfiles (necesario para mostrar nombres de vendedores)
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Clientes: todos los autenticados pueden ver y gestionar
CREATE POLICY "clients_all" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Cotizaciones: admin ve todo, vendedor ve las suyas
CREATE POLICY "quotations_select_admin" ON quotations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "quotations_select_own" ON quotations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "quotations_insert" ON quotations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "quotations_update_admin" ON quotations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "quotations_update_own" ON quotations FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "quotations_delete_admin" ON quotations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Ítems: heredan acceso de cotización
CREATE POLICY "items_select" ON quotation_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM quotations q WHERE q.id = quotation_id
    AND (q.user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  ));

CREATE POLICY "items_write" ON quotation_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Contratos: mismo patrón que cotizaciones
CREATE POLICY "contracts_select_admin" ON contracts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "contracts_select_own" ON contracts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "contracts_insert" ON contracts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "contracts_update_admin" ON contracts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "contracts_update_own" ON contracts FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- VISTAS PARA DASHBOARD
-- ============================================

CREATE OR REPLACE VIEW quotations_summary AS
SELECT
  q.id,
  q.number,
  q.status,
  q.issue_date,
  q.expiry_date,
  q.total,
  q.created_at,
  c.name AS client_name,
  c.rut AS client_rut,
  p.name AS vendedor_name,
  p.id AS vendedor_id,
  EXTRACT(YEAR FROM q.issue_date)::INT AS year,
  EXTRACT(MONTH FROM q.issue_date)::INT AS month
FROM quotations q
LEFT JOIN clients c ON c.id = q.client_id
LEFT JOIN profiles p ON p.id = q.user_id;
