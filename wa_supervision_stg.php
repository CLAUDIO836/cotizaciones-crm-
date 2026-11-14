<?php
/**
 * wa_supervision_stg.php — Alertas de supervisión comercial (staging)
 *
 * Uso: invocado como cron cada 15 minutos, o via crm-api.php?action=e2e_run_supervision
 * NO modifica producción. Solo lee staging DB y envía WhatsApp de alerta al supervisor de prueba.
 *
 * Alertas implementadas:
 *   A1 — Derivación sin respuesta ejecutiva (oportunidad_wa > 30 min sin msg out)
 *   A2 — Conversación sin asignación (bot_active=0, assigned_to=NULL)
 *   A3 — Cliente esperando respuesta > 60 min (bot_active=0, sin msg out post-escalada)
 */

// Puede incluirse desde crm-api.php o ejecutarse directamente
if (!defined('SUPERVISION_INCLUDED')) {
    define('SUPERVISION_INCLUDED', true);
    // Si se ejecuta directamente: cargar credenciales
    $secrets = '/home/transccl/crm-secrets-staging.php';
    if (file_exists($secrets)) require_once $secrets;
}

// ── Configuración de alertas ─────────────────────────────────────────────────
define('SUPV_MINS_SIN_ATENCION',  30);  // A1: oportunidad sin respuesta > 30 min
define('SUPV_MINS_ESPERA_CLIENTE', 60); // A3: cliente esperando > 60 min
// Destinatario de alertas en staging: solo Claudio (test phone)
define('SUPV_ALERT_PHONES', ['56974270657']);
// WABA de staging
define('SUPV_WABA_ID',  defined('STG_WABA_ID')   ? STG_WABA_ID   : (getenv('STG_WABA_ID')   ?: ''));
define('SUPV_WA_TOKEN', defined('STG_WA_TOKEN')  ? STG_WA_TOKEN  : (getenv('STG_WA_TOKEN')  ?: ''));

// ── DB staging ───────────────────────────────────────────────────────────────
function supvDb(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $host = defined('STG_DB_HOST') ? STG_DB_HOST : (getenv('STG_DB_HOST') ?: 'localhost');
    $db   = defined('STG_DB_NAME') ? STG_DB_NAME : (getenv('STG_DB_NAME') ?: 'transccl_crm_staging');
    $user = defined('STG_DB_USER') ? STG_DB_USER : (getenv('STG_DB_USER') ?: 'transccl_crm_user');
    $pass = defined('STG_DB_PASS') ? STG_DB_PASS : (getenv('STG_DB_PASS') ?: 'Claudio@1978');
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    return $pdo;
}

function supvLog(string $msg): void {
    $ts = date('Y-m-d H:i:s');
    error_log("[SUPV_STG $ts] $msg");
}

function supvSendAlert(string $to, string $msg): bool {
    if (empty(SUPV_WABA_ID) || empty(SUPV_WA_TOKEN)) {
        supvLog("ALERT_DRY_RUN to=$to: $msg");
        return true;
    }
    $payload = json_encode(['messaging_product'=>'whatsapp','to'=>$to,'type'=>'text',
        'text'=>['body'=>$msg]]);
    $ctx = stream_context_create(['http'=>[
        'method'  => 'POST',
        'header'  => "Authorization: Bearer " . SUPV_WA_TOKEN . "\r\nContent-Type: application/json\r\n",
        'content' => $payload,
        'timeout' => 8,
    ]]);
    $url = "https://graph.facebook.com/v19.0/" . SUPV_WABA_ID . "/messages";
    $r = @file_get_contents($url, false, $ctx);
    supvLog("ALERT_SENT to=$to ok=" . ($r !== false ? '1' : '0') . " msg=" . substr($msg, 0, 60));
    return $r !== false;
}

// ── Alerta A1: Oportunidad sin respuesta ejecutiva ────────────────────────────
function supvA1SinRespuesta(): array {
    $sql = "SELECT c.id, c.phone, c.contact_name, c.company_name, c.assigned_to,
                   c.wa_draft_quote_id, c.last_customer_msg_at,
                   TIMESTAMPDIFF(MINUTE, c.last_customer_msg_at, NOW()) AS mins_espera
            FROM wa_cloud_conversations c
            WHERE c.bot_active = 0
              AND c.wa_draft_quote_id IS NOT NULL
              AND c.last_customer_msg_at < NOW() - INTERVAL " . SUPV_MINS_SIN_ATENCION . " MINUTE
              AND NOT EXISTS (
                SELECT 1 FROM wa_cloud_messages m
                WHERE m.conversation_id = c.id
                  AND m.direction = 'out'
                  AND m.sender_type != 'bot'
                  AND m.created_at > c.last_customer_msg_at
              )
            ORDER BY c.last_customer_msg_at ASC
            LIMIT 20";
    return supvDb()->query($sql)->fetchAll();
}

// ── Alerta A2: Conversación sin asignación ────────────────────────────────────
function supvA2SinAsignacion(): array {
    $sql = "SELECT c.id, c.phone, c.contact_name, c.company_name,
                   TIMESTAMPDIFF(MINUTE, c.last_customer_msg_at, NOW()) AS mins_sin_asignar
            FROM wa_cloud_conversations c
            WHERE c.bot_active = 0
              AND c.assigned_to IS NULL
              AND c.last_customer_msg_at < NOW() - INTERVAL 5 MINUTE
            ORDER BY c.last_customer_msg_at ASC
            LIMIT 20";
    return supvDb()->query($sql)->fetchAll();
}

// ── Alerta A3: Cliente esperando demasiado ────────────────────────────────────
function supvA3EsperaLarga(): array {
    $sql = "SELECT c.id, c.phone, c.contact_name, c.company_name, c.assigned_to,
                   TIMESTAMPDIFF(MINUTE, c.last_customer_msg_at, NOW()) AS mins_espera
            FROM wa_cloud_conversations c
            WHERE c.bot_active = 0
              AND c.last_customer_msg_at < NOW() - INTERVAL " . SUPV_MINS_ESPERA_CLIENTE . " MINUTE
              AND NOT EXISTS (
                SELECT 1 FROM wa_cloud_messages m
                WHERE m.conversation_id = c.id
                  AND m.direction = 'out'
                  AND m.created_at > c.last_customer_msg_at
              )
            ORDER BY mins_espera DESC
            LIMIT 10";
    return supvDb()->query($sql)->fetchAll();
}

// ── Función principal ─────────────────────────────────────────────────────────
function supvRunAll(): array {
    $results = ['a1' => [], 'a2' => [], 'a3' => [], 'alerts_sent' => 0, 'errors' => []];

    try {
        $a1 = supvA1SinRespuesta();
        $results['a1'] = $a1;
        if ($a1) {
            $lines = ["🔔 [STG] Oportunidades WA sin respuesta ejecutiva:"];
            foreach ($a1 as $r) {
                $nombre = $r['company_name'] ?? $r['contact_name'] ?? '+' . $r['phone'];
                $lines[] = "• {$nombre} — {$r['mins_espera']} min esperando (asignado: " . ($r['assigned_to'] ?? 'N/A') . ")";
            }
            $lines[] = "Revisar en crm.transccl.cl/bandeja";
            $msg = implode("\n", $lines);
            foreach (SUPV_ALERT_PHONES as $p) {
                if (supvSendAlert($p, $msg)) $results['alerts_sent']++;
            }
        }
    } catch (Throwable $e) {
        $results['errors'][] = "A1: " . $e->getMessage();
        supvLog("ERROR A1: " . $e->getMessage());
    }

    try {
        $a2 = supvA2SinAsignacion();
        $results['a2'] = $a2;
        if ($a2) {
            $lines = ["⚠️ [STG] Conversaciones WA sin ejecutiva asignada:"];
            foreach ($a2 as $r) {
                $nombre = $r['company_name'] ?? $r['contact_name'] ?? '+' . $r['phone'];
                $lines[] = "• {$nombre} — sin asignar hace {$r['mins_sin_asignar']} min";
            }
            $msg = implode("\n", $lines);
            foreach (SUPV_ALERT_PHONES as $p) {
                if (supvSendAlert($p, $msg)) $results['alerts_sent']++;
            }
        }
    } catch (Throwable $e) {
        $results['errors'][] = "A2: " . $e->getMessage();
        supvLog("ERROR A2: " . $e->getMessage());
    }

    try {
        $a3 = supvA3EsperaLarga();
        $results['a3'] = $a3;
        if ($a3) {
            $lines = ["🚨 [STG] Clientes WA esperando respuesta >" . SUPV_MINS_ESPERA_CLIENTE . " min:"];
            foreach ($a3 as $r) {
                $nombre = $r['company_name'] ?? $r['contact_name'] ?? '+' . $r['phone'];
                $lines[] = "• {$nombre} — {$r['mins_espera']} min sin atención";
            }
            $msg = implode("\n", $lines);
            foreach (SUPV_ALERT_PHONES as $p) {
                if (supvSendAlert($p, $msg)) $results['alerts_sent']++;
            }
        }
    } catch (Throwable $e) {
        $results['errors'][] = "A3: " . $e->getMessage();
        supvLog("ERROR A3: " . $e->getMessage());
    }

    supvLog("RUN OK a1=" . count($results['a1']) . " a2=" . count($results['a2']) . " a3=" . count($results['a3']) . " sent=" . $results['alerts_sent']);
    return $results;
}

// ── Ejecución directa (cron) ──────────────────────────────────────────────────
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    $r = supvRunAll();
    echo json_encode(['ok' => true, 'data' => $r]) . PHP_EOL;
}
