-- ============================================================
-- Agente Comercial IA — Migración inicial
-- Base de datos: transccl_crm  (MySQL 8.0+)
-- Ejecutar UNA vez. Todas las tablas son idempotentes.
-- ============================================================

-- ── ai_conversations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id               VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  company_id       VARCHAR(36)  NULL,
  lead_id          VARCHAR(36)  NULL   COMMENT 'ref lead_requests.id',
  client_id        VARCHAR(36)  NULL   COMMENT 'ref clients.id',
  status           ENUM('active','paused','archived') NOT NULL DEFAULT 'active',
  mode             ENUM('ai','human') NOT NULL DEFAULT 'ai'
                   COMMENT 'ai = IA propone; human = agente tomó control',
  priority         ENUM('high','medium','low') NOT NULL DEFAULT 'medium',
  channel          VARCHAR(50)  NOT NULL DEFAULT 'email',
  subject          VARCHAR(255) NULL,
  assigned_user_id VARCHAR(36)  NULL   COMMENT 'ref profiles.id',
  last_activity_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_status         (status),
  KEY idx_lead_id        (lead_id),
  KEY idx_client_id      (client_id),
  KEY idx_last_activity  (last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ai_messages ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_messages (
  id               VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  conversation_id  VARCHAR(36)  NOT NULL,
  sender           ENUM('client','ai','human','system') NOT NULL,
  message_type     ENUM('inbound','draft','sent','note') NOT NULL DEFAULT 'sent',
  content          TEXT         NOT NULL,
  status           ENUM('pending','sent','rejected') NOT NULL DEFAULT 'sent',
  idempotency_key  VARCHAR(255) NULL
                   COMMENT 'evita borradores duplicados de IA',
  approved_by      VARCHAR(36)  NULL,
  approved_at      DATETIME     NULL,
  rejected_by      VARCHAR(36)  NULL,
  rejected_at      DATETIME     NULL,
  rejection_note   TEXT         NULL,
  metadata         JSON         NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_idempotency   (idempotency_key),
  KEY idx_conversation        (conversation_id),
  KEY idx_status              (status),
  KEY idx_sender_type         (sender, message_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ai_tasks ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_tasks (
  id               VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  conversation_id  VARCHAR(36)  NOT NULL,
  assigned_user_id VARCHAR(36)  NULL,
  type             VARCHAR(50)  NOT NULL
                   COMMENT 'follow_up | quote_ready | call_back | etc.',
  due_date         DATETIME     NULL,
  done             TINYINT(1)   NOT NULL DEFAULT 0,
  done_at          DATETIME     NULL,
  done_by          VARCHAR(36)  NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_conversation  (conversation_id),
  KEY idx_done_due      (done, due_date),
  KEY idx_type          (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ai_agent_settings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_agent_settings (
  id             VARCHAR(36)    NOT NULL DEFAULT (UUID()),
  company_id     VARCHAR(36)    NOT NULL,
  enabled        TINYINT(1)     NOT NULL DEFAULT 0,
  model          VARCHAR(100)   NOT NULL DEFAULT 'claude-sonnet-5-20251001',
  system_prompt  TEXT           NULL,
  knowledge_base TEXT           NULL
                 COMMENT 'Solo los textos aquí pueden usarse para responder precios/rutas',
  temperature    DECIMAL(3,2)   NOT NULL DEFAULT 0.30,
  max_tokens     INT            NOT NULL DEFAULT 1024,
  created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ai_audit_log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id               VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  conversation_id  VARCHAR(36)  NULL,
  message_id       VARCHAR(36)  NULL,
  user_id          VARCHAR(36)  NULL,
  action           VARCHAR(100) NOT NULL
                   COMMENT 'draft_created|draft_approved|draft_rejected|mode_changed|conversation_created',
  details          JSON         NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_conversation  (conversation_id),
  KEY idx_action        (action),
  KEY idx_user          (user_id),
  KEY idx_created       (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── quotation_activities.source (idempotente via PROCEDURE) ──
DROP PROCEDURE IF EXISTS _ai_add_source_col;
DELIMITER //
CREATE PROCEDURE _ai_add_source_col()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'quotation_activities'
      AND COLUMN_NAME  = 'source'
  ) THEN
    ALTER TABLE quotation_activities
      ADD COLUMN source ENUM('manual','ai','system') NOT NULL DEFAULT 'manual';
  END IF;
END//
DELIMITER ;
CALL _ai_add_source_col();
DROP PROCEDURE IF EXISTS _ai_add_source_col;
