-- ============================================================
-- MIGRACIÓN: Campos formulario WA v2
-- Ejecutar en: cPanel > phpMyAdmin > transccl_crm
-- Fecha: 2026-11-13
-- ============================================================

-- Google Maps / coordenadas
ALTER TABLE wa_cloud_conversations ADD COLUMN IF NOT EXISTS service_origin_place_id VARCHAR(255) NULL AFTER service_origin;
ALTER TABLE wa_cloud_conversations ADD COLUMN IF NOT EXISTS service_origin_lat DOUBLE NULL AFTER service_origin_place_id;
ALTER TABLE wa_cloud_conversations ADD COLUMN IF NOT EXISTS service_origin_lng DOUBLE NULL AFTER service_origin_lat;
ALTER TABLE wa_cloud_conversations ADD COLUMN IF NOT EXISTS service_destination_place_id VARCHAR(255) NULL AFTER service_destination;
ALTER TABLE wa_cloud_conversations ADD COLUMN IF NOT EXISTS service_destination_lat DOUBLE NULL AFTER service_destination_place_id;
ALTER TABLE wa_cloud_conversations ADD COLUMN IF NOT EXISTS service_destination_lng DOUBLE NULL AFTER service_destination_lat;

-- Distancia calculada
ALTER TABLE wa_cloud_conversations ADD COLUMN IF NOT EXISTS service_km DECIMAL(8,2) NULL AFTER service_vehicle;

-- Hora de salida y regreso
ALTER TABLE wa_cloud_conversations ADD COLUMN IF NOT EXISTS service_hour TIME NULL AFTER service_date;
ALTER TABLE wa_cloud_conversations ADD COLUMN IF NOT EXISTS service_hour_return TIME NULL AFTER service_hour;

-- Email destino cotización
ALTER TABLE wa_cloud_conversations ADD COLUMN IF NOT EXISTS quote_send_email VARCHAR(255) NULL AFTER contact_email;

-- Observaciones del servicio
ALTER TABLE wa_cloud_conversations ADD COLUMN IF NOT EXISTS observaciones TEXT NULL;

-- Verificación post-migración
SELECT COLUMN_NAME, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'transccl_crm'
  AND TABLE_NAME = 'wa_cloud_conversations'
ORDER BY ORDINAL_POSITION;
