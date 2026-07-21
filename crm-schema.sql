-- CRM Transccl - Schema MySQL
-- Base de datos: transccl_crm
-- Ejecutar en phpMyAdmin o MySQL CLI

SET NAMES utf8mb4;
SET time_zone = '-03:00';

-- ============================================================
-- companies
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id   VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50)  NOT NULL UNIQUE,
  color VARCHAR(20) DEFAULT '#1B8A4B',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO companies (id, name, slug, color) VALUES
  (UUID(), 'Transccl SpA',        'transccl',    '#1B8A4B'),
  (UUID(), 'Transportes TKS',     'tks',         '#D33A2C'),
  (UUID(), 'TrackingCCL',         'trackingccl', '#2563eb');

-- ============================================================
-- profiles (usuarios CRM)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email         VARCHAR(255) NOT NULL UNIQUE,
  name          VARCHAR(255) NOT NULL,
  role          ENUM('admin','vendedor','coordinador') NOT NULL DEFAULT 'vendedor',
  password_hash VARCHAR(255) NOT NULL,
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- crm_sessions (tokens de autenticación)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_sessions (
  token      VARCHAR(64) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
);

-- ============================================================
-- clients
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id         VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name       VARCHAR(255) NOT NULL,
  rut        VARCHAR(20)  DEFAULT NULL,
  email      VARCHAR(255) DEFAULT NULL,
  phone      VARCHAR(50)  DEFAULT NULL,
  address    TEXT         DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_rut  (rut)
);

-- ============================================================
-- contacts (contactos de clientes)
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  client_id       VARCHAR(36) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) DEFAULT NULL,
  phone_mobile    VARCHAR(50)  DEFAULT NULL,
  phone_landline  VARCHAR(50)  DEFAULT NULL,
  cargo           VARCHAR(100) DEFAULT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  INDEX idx_client (client_id)
);

-- ============================================================
-- pipelines (embudos de venta)
-- ============================================================
CREATE TABLE IF NOT EXISTS pipelines (
  id         VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name       VARCHAR(255) NOT NULL,
  color      VARCHAR(20)  DEFAULT '#FF6C37',
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  sort_order INT          NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- quotations (cotizaciones / negocios)
-- ============================================================
CREATE TABLE IF NOT EXISTS quotations (
  id                VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  number            VARCHAR(50)  DEFAULT NULL,
  status            ENUM('open','won','lost') NOT NULL DEFAULT 'open',
  etapa             VARCHAR(50)  DEFAULT 'lead',
  company           VARCHAR(100) DEFAULT 'Transccl',
  company_id        VARCHAR(36)  DEFAULT NULL,
  issue_date        DATE         DEFAULT NULL,
  expiry_date       DATE         DEFAULT NULL,
  subtotal          DECIMAL(14,2) DEFAULT 0,
  tax_pct           DECIMAL(5,2)  DEFAULT 19,
  total             DECIMAL(14,2) DEFAULT 0,
  notes             TEXT         DEFAULT NULL,
  terms             TEXT         DEFAULT NULL,
  desde             TEXT         DEFAULT NULL,
  hasta             TEXT         DEFAULT NULL,
  desde_lat         DECIMAL(10,7) DEFAULT NULL,
  desde_lng         DECIMAL(10,7) DEFAULT NULL,
  hasta_lat         DECIMAL(10,7) DEFAULT NULL,
  hasta_lng         DECIMAL(10,7) DEFAULT NULL,
  distancia_km      DECIMAL(8,2)  DEFAULT NULL,
  fecha_salida      DATE         DEFAULT NULL,
  hora_salida       TIME         DEFAULT NULL,
  fecha_retorno     DATE         DEFAULT NULL,
  hora_retorno      TIME         DEFAULT NULL,
  pipedrive_deal_id VARCHAR(50)  DEFAULT NULL,
  vehicle_type      VARCHAR(100) DEFAULT NULL,
  observaciones     TEXT         DEFAULT NULL,
  contact_id        VARCHAR(36)  DEFAULT NULL,
  descuento_pct     DECIMAL(5,2) DEFAULT 0,
  user_id           VARCHAR(36)  DEFAULT NULL,
  client_id         VARCHAR(36)  DEFAULT NULL,
  pipeline_id       VARCHAR(36)  DEFAULT NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES profiles(id)  ON DELETE SET NULL,
  FOREIGN KEY (client_id)  REFERENCES clients(id)   ON DELETE SET NULL,
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id)  REFERENCES companies(id) ON DELETE SET NULL,
  INDEX idx_status     (status),
  INDEX idx_user       (user_id),
  INDEX idx_client     (client_id),
  INDEX idx_issue_date (issue_date)
);

-- ============================================================
-- quotation_items (ítems de cotización)
-- ============================================================
CREATE TABLE IF NOT EXISTS quotation_items (
  id            VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  quotation_id  VARCHAR(36) NOT NULL,
  codigo        VARCHAR(50) DEFAULT NULL,
  description   TEXT        NOT NULL,
  pasajeros     INT         DEFAULT NULL,
  quantity      DECIMAL(10,2) DEFAULT 1,
  unit_price    DECIMAL(14,2) DEFAULT 0,
  subtotal      DECIMAL(14,2) DEFAULT 0,
  sort_order    INT         DEFAULT 0,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  INDEX idx_quotation (quotation_id)
);

-- ============================================================
-- quotation_activities (gestiones / actividades)
-- ============================================================
CREATE TABLE IF NOT EXISTS quotation_activities (
  id            VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  quotation_id  VARCHAR(36) NOT NULL,
  user_id       VARCHAR(36) DEFAULT NULL,
  type          VARCHAR(50) DEFAULT 'llamada',
  subject       VARCHAR(500) NOT NULL,
  note          TEXT        DEFAULT NULL,
  due_date      DATE        DEFAULT NULL,
  done          TINYINT(1)  NOT NULL DEFAULT 0,
  done_at       DATETIME    DEFAULT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)      REFERENCES profiles(id)   ON DELETE SET NULL,
  INDEX idx_quotation (quotation_id),
  INDEX idx_user      (user_id),
  INDEX idx_due_date  (due_date)
);

-- ============================================================
-- quotation_notes (notas internas)
-- ============================================================
CREATE TABLE IF NOT EXISTS quotation_notes (
  id            VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  quotation_id  VARCHAR(36) NOT NULL,
  user_id       VARCHAR(36) DEFAULT NULL,
  content       TEXT        NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)      REFERENCES profiles(id)   ON DELETE SET NULL,
  INDEX idx_quotation (quotation_id)
);

-- ============================================================
-- quotation_approvals (aprobación digital de cotización)
-- ============================================================
CREATE TABLE IF NOT EXISTS quotation_approvals (
  id                   VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  token                VARCHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
  quotation_id         VARCHAR(36) DEFAULT NULL,
  client_name          VARCHAR(255) DEFAULT NULL,
  client_rut           VARCHAR(20)  DEFAULT NULL,
  seller_name          VARCHAR(255) DEFAULT NULL,
  desde                TEXT         DEFAULT NULL,
  hasta                TEXT         DEFAULT NULL,
  fecha_salida         DATE         DEFAULT NULL,
  hora_salida          TIME         DEFAULT NULL,
  fecha_retorno        DATE         DEFAULT NULL,
  hora_retorno         TIME         DEFAULT NULL,
  total                DECIMAL(14,2) DEFAULT NULL,
  company_name         VARCHAR(255) DEFAULT NULL,
  items                JSON         DEFAULT NULL,
  sent_at              DATETIME     DEFAULT NULL,
  response             ENUM('accepted','rejected') DEFAULT NULL,
  responded_at         DATETIME     DEFAULT NULL,
  responded_name       VARCHAR(255) DEFAULT NULL,
  responded_rut        VARCHAR(20)  DEFAULT NULL,
  responded_ip         VARCHAR(50)  DEFAULT NULL,
  responded_user_agent TEXT         DEFAULT NULL,
  rejection_reason     TEXT         DEFAULT NULL,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
  INDEX idx_quotation (quotation_id),
  INDEX idx_token     (token)
);

-- ============================================================
-- approval_letters (carta de aprobación de servicio)
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_letters (
  id                VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  token             VARCHAR(36) NOT NULL UNIQUE DEFAULT (UUID()),
  quotation_id      VARCHAR(36) DEFAULT NULL,
  client_name       VARCHAR(255) DEFAULT NULL,
  client_rut        VARCHAR(20)  DEFAULT NULL,
  client_email      VARCHAR(255) DEFAULT NULL,
  client_phone      VARCHAR(50)  DEFAULT NULL,
  seller_name       VARCHAR(255) DEFAULT NULL,
  desde             TEXT         DEFAULT NULL,
  hasta             TEXT         DEFAULT NULL,
  fecha_salida      DATE         DEFAULT NULL,
  hora_salida       TIME         DEFAULT NULL,
  fecha_retorno     DATE         DEFAULT NULL,
  hora_retorno      TIME         DEFAULT NULL,
  total             DECIMAL(14,2) DEFAULT NULL,
  company_name      VARCHAR(255) DEFAULT NULL,
  sent_at           DATETIME     DEFAULT NULL,
  signed_at         DATETIME     DEFAULT NULL,
  signed_name       VARCHAR(255) DEFAULT NULL,
  signed_rut        VARCHAR(20)  DEFAULT NULL,
  signed_ip         VARCHAR(50)  DEFAULT NULL,
  signed_user_agent TEXT         DEFAULT NULL,
  billing_name      VARCHAR(255) DEFAULT NULL,
  billing_rut       VARCHAR(20)  DEFAULT NULL,
  billing_address   TEXT         DEFAULT NULL,
  billing_company   VARCHAR(255) DEFAULT NULL,
  billing_glosa     TEXT         DEFAULT NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
  INDEX idx_quotation (quotation_id),
  INDEX idx_token     (token)
);

-- ============================================================
-- lead_requests (formularios públicos de cotización)
-- ============================================================
CREATE TABLE IF NOT EXISTS lead_requests (
  id                VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  status            VARCHAR(50) NOT NULL DEFAULT 'pendiente',
  target_company    VARCHAR(50) DEFAULT NULL,
  tipo_servicio     VARCHAR(50) DEFAULT NULL,
  empresa_nombre    VARCHAR(255) DEFAULT NULL,
  empresa_rut       VARCHAR(20)  DEFAULT NULL,
  contacto_nombre   VARCHAR(255) DEFAULT NULL,
  contacto_cargo    VARCHAR(100) DEFAULT NULL,
  contacto_email    VARCHAR(255) DEFAULT NULL,
  contacto_telefono VARCHAR(50)  DEFAULT NULL,
  desde             TEXT         DEFAULT NULL,
  hasta             TEXT         DEFAULT NULL,
  pasajeros_aprox   VARCHAR(50)  DEFAULT NULL,
  fecha_inicio      DATE         DEFAULT NULL,
  observaciones     TEXT         DEFAULT NULL,
  ip_address        VARCHAR(50)  DEFAULT NULL,
  user_agent        TEXT         DEFAULT NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status  (status),
  INDEX idx_company (target_company)
);

-- ============================================================
-- contracts (contratos de servicio)
-- ============================================================
CREATE TABLE IF NOT EXISTS contracts (
  id           VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  number       VARCHAR(50)  DEFAULT NULL,
  status       ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
  start_date   DATE         DEFAULT NULL,
  end_date     DATE         DEFAULT NULL,
  value        DECIMAL(14,2) DEFAULT 0,
  notes        TEXT         DEFAULT NULL,
  user_id      VARCHAR(36)  DEFAULT NULL,
  client_id    VARCHAR(36)  DEFAULT NULL,
  quotation_id VARCHAR(36)  DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)      REFERENCES profiles(id)   ON DELETE SET NULL,
  FOREIGN KEY (client_id)    REFERENCES clients(id)    ON DELETE SET NULL,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
  INDEX idx_user   (user_id),
  INDEX idx_status (status)
);

-- ============================================================
-- VIEW: quotations_summary
-- ============================================================
CREATE OR REPLACE VIEW quotations_summary AS
SELECT
  q.id,
  q.number,
  q.status,
  q.etapa,
  q.company,
  q.company_id,
  q.total,
  q.issue_date,
  YEAR(q.issue_date)  AS `year`,
  MONTH(q.issue_date) AS `month`,
  q.user_id           AS vendedor_id,
  p.name              AS vendedor_name,
  c.name              AS client_name,
  q.client_id,
  q.pipeline_id,
  q.pipedrive_deal_id,
  q.created_at
FROM quotations q
LEFT JOIN profiles  p ON p.id = q.user_id
LEFT JOIN clients   c ON c.id = q.client_id;
