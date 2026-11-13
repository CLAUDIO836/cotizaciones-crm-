<?php
/**
 * WhatsApp Webhook — STAGING ONLY (wa_webhook_stg.php)
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  ENTORNO AISLADO — NO AFECTA PRODUCCIÓN                      ║
 * ║  • DB: transccl_crm_staging (jamás toca transccl_crm)        ║
 * ║  • NO envía mensajes WA reales (modo dry-run)                 ║
 * ║  • Solo acepta teléfonos de la lista TEST_PHONES              ║
 * ║  • Token de verificación Meta distinto del productivo         ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Para registrar este webhook en Meta (sandbox Meta App):
 *   URL: https://www.transccl.cl/wa_webhook_stg.php
 *   Verify Token: valor de STG_WA_VERIFY (en crm-secrets.php o env)
 *
 * Para prueba local sin Meta:
 *   POST https://www.transccl.cl/wa_webhook_stg.php
 *   Header: X-Stg-Token: <STG_E2E_TOKEN>
 *   Body: {"phone":"56912345678","text":"Hola","name":"Test"}
 */

// ── Secrets ───────────────────────────────────────────────────────────────────
$_s = '/home/transccl/crm-secrets.php';
if (file_exists($_s) && !defined('META_WA_TOKEN')) require_once $_s;
$_e = __DIR__ . '/crm-env.php';
if (file_exists($_e)) require_once $_e;

date_default_timezone_set('America/Santiago');

// ── Constantes de staging ─────────────────────────────────────────────────────
define('STG_DB_NAME',   'transccl_crm_staging');
define('STG_DB_HOST',   'localhost');
define('STG_DB_USER',   defined('STG_DB_USER_K')   ? STG_DB_USER_K   : (getenv('STG_DB_USER')   ?: 'transccl_crm_user'));
define('STG_DB_PASS',   defined('STG_DB_PASS_K')   ? STG_DB_PASS_K   : (getenv('STG_DB_PASS')   ?: getenv('CRM_DB_PASSWORD') ?: 'Claudio@1978'));
define('STG_VERIFY',    defined('STG_WA_VERIFY')   ? STG_WA_VERIFY   : (getenv('STG_WA_VERIFY') ?: 'stg_verify_token_2024'));
define('STG_E2E_TOKEN', defined('CRM_E2E_TOKEN')   ? CRM_E2E_TOKEN
    : (getenv('CRM_E2E_TOKEN') ?: (getenv('E2E_STAGING_TOKEN') ?: '')));
define('_AI_KEY_STG',   defined('ANTHROPIC_API_KEY') ? ANTHROPIC_API_KEY : (getenv('ANTHROPIC_API_KEY') ?: ''));

// ── Teléfonos permitidos en staging (no se procesa ningún otro) ───────────────
define('TEST_PHONES', [
    '56900000001',  // Test Bot A
    '56900000002',  // Test Bot B
    '56900000003',  // Test Bot C
    '56912345678',  // Test manual (curl)
    '56999999999',  // Test CI/CD
    // '56XXXXXXXXX',  // Teléfono de prueba real — agregar cuando Gerencia lo autorice
]);

// Teléfonos que reciben mensajes WA reales (subset de TEST_PHONES).
// Si está vacío, todos los TEST_PHONES operan en DRY-RUN.
define('REAL_SEND_PHONES', [
    // '56XXXXXXXXX',  // mismo número que en STG_TEST_PHONES de wa_webhook.php
]);

// ── Log de staging ─────────────────────────────────────────────────────────────
function stgLog(string $msg): void {
    $logfile = '/home/transccl/logs/wa_webhook_stg.log';
    $dir = dirname($logfile);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . "\n";
    @file_put_contents($logfile, $line, FILE_APPEND | LOCK_EX);
}

// ── GET: verificación Meta (sandbox) ─────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode      = $_GET['hub_mode']         ?? $_GET['hub.mode']         ?? '';
    $token     = $_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '';
    $challenge = $_GET['hub_challenge']    ?? $_GET['hub.challenge']    ?? '';

    if ($mode === 'subscribe' && STG_VERIFY !== '' && hash_equals(STG_VERIFY, $token)) {
        http_response_code(200);
        header('Content-Type: text/plain');
        echo $challenge;
        stgLog("META VERIFY OK");
        exit;
    }
    http_response_code(403);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?? [];

// ── Modo prueba directa (sin Meta): header X-Stg-Token ───────────────────────
$directToken = $_SERVER['HTTP_X_STG_TOKEN'] ?? '';
$isDirect = (STG_E2E_TOKEN !== '' && hash_equals(STG_E2E_TOKEN, $directToken));

if ($isDirect) {
    // Payload simplificado: {"phone":"569...","text":"Hola","name":"Test"}
    $phone = $body['phone'] ?? '';
    $text  = $body['text']  ?? '';
    $name  = $body['name']  ?? null;

    if (!$phone || !$text) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'phone y text requeridos']);
        exit;
    }

    if (!in_array($phone, TEST_PHONES, true)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => "Teléfono no en whitelist: $phone"]);
        exit;
    }

    http_response_code(200);
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'mode' => 'direct_stg']);
    if (ob_get_level() > 0) ob_end_flush();
    flush();
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
    ignore_user_abort(true);
    set_time_limit(120);

    stgLog("DIRECT phone=$phone text=" . substr($text, 0, 60));
    stgProcessMessage('stg_direct_' . uniqid(), $phone, $text, $name, time());
    exit;
}

// ── Modo Meta webhook (sandbox app) ──────────────────────────────────────────
http_response_code(200);
header('Content-Type: application/json');
echo '{"ok":true}';
if (ob_get_level() > 0) ob_end_flush();
flush();
if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
ignore_user_abort(true);
set_time_limit(120);

foreach ($body['entry'] ?? [] as $entry) {
    foreach ($entry['changes'] ?? [] as $change) {
        $val = $change['value'] ?? [];
        if (($change['field'] ?? '') !== 'messages') continue;

        foreach ($val['messages'] ?? [] as $msg) {
            $wamid = $msg['id']   ?? '';
            $phone = $msg['from'] ?? '';
            $type  = $msg['type'] ?? '';
            $ts    = (int)($msg['timestamp'] ?? time());

            if (!$wamid || !$phone) continue;
            if ($type === 'reaction') continue;

            // ★ Whitelist — solo teléfonos de prueba
            if (!in_array($phone, TEST_PHONES, true)) {
                stgLog("SKIP phone=$phone (not in TEST_PHONES)");
                continue;
            }

            if ($type === 'text')        $text = $msg['text']['body'] ?? '';
            elseif ($type === 'button')  $text = $msg['button']['text'] ?? '';
            elseif ($type === 'interactive') {
                $text = $msg['interactive']['button_reply']['title']
                     ?? $msg['interactive']['list_reply']['title']
                     ?? '';
            } else { $text = "[{$type}]"; }

            $name = null;
            foreach ($val['contacts'] ?? [] as $c) {
                if (($c['wa_id'] ?? '') === $phone) { $name = $c['profile']['name'] ?? null; break; }
            }

            stgLog("RECV phone=$phone wamid=$wamid text=" . substr($text, 0, 60));
            stgProcessMessage($wamid, $phone, $text, $name, $ts);
        }
    }
}
exit;

// ─────────────────────────────────────────────────────────────────────────────
// DB staging
// ─────────────────────────────────────────────────────────────────────────────

function stgDb(): PDO {
    static $pdo;
    if (!$pdo) {
        $pdo = new PDO(
            'mysql:host=' . STG_DB_HOST . ';dbname=' . STG_DB_NAME . ';charset=utf8mb4',
            STG_DB_USER, STG_DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    }
    return $pdo;
}

function stgDbUuid(): string {
    return stgDb()->query("SELECT UUID() AS u")->fetch()['u'];
}

function stgEnsureTables(): void {
    $pdo = stgDb();
    $pdo->exec("CREATE TABLE IF NOT EXISTS wa_cloud_conversations (
        id           CHAR(36)     NOT NULL PRIMARY KEY,
        phone        VARCHAR(30)  NOT NULL,
        contact_name VARCHAR(120),
        assigned_to  VARCHAR(36),
        bot_active   TINYINT(1)   NOT NULL DEFAULT 1,
        stage        VARCHAR(20)  NOT NULL DEFAULT 'nuevo',
        source       VARCHAR(30)  NOT NULL DEFAULT 'whatsapp',
        last_msg_at  DATETIME,
        last_message TEXT,
        last_customer_msg_at DATETIME,
        unread_count INT NOT NULL DEFAULT 0,
        notes TEXT NULL,
        contact_rut   VARCHAR(20) NULL,
        contact_email VARCHAR(200) NULL,
        service_date  DATE NULL,
        service_origin VARCHAR(200) NULL,
        service_destination VARCHAR(200) NULL,
        service_passengers TINYINT NULL,
        service_type  VARCHAR(50) NULL,
        service_vehicle VARCHAR(100) NULL,
        company_name  VARCHAR(200) NULL,
        client_type   VARCHAR(10) NULL,
        service_hour  TIME NULL,
        service_hour_return TIME NULL,
        wa_draft_quote_id CHAR(36) NULL,
        form_submitted_at DATETIME NULL,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS wa_cloud_messages (
        id              CHAR(36)     NOT NULL PRIMARY KEY,
        conversation_id CHAR(36)     NOT NULL,
        wamid           VARCHAR(128) NOT NULL,
        direction       ENUM('in','out') NOT NULL DEFAULT 'in',
        msg_type        VARCHAR(20)  NOT NULL DEFAULT 'text',
        content         TEXT,
        sender_type     VARCHAR(20) NULL,
        status          VARCHAR(20)  NOT NULL DEFAULT 'received',
        created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_wamid (wamid),
        INDEX idx_conv (conversation_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

// ─────────────────────────────────────────────────────────────────────────────
// processMessage (staging) — igual a producción pero:
//   1. Usa stgDb() en lugar de db()
//   2. sendWA() es NO-OP (dry-run) — solo registra en log
// ─────────────────────────────────────────────────────────────────────────────

function stgProcessMessage(string $wamid, string $phone, string $text, ?string $name, int $ts): void {
    if (!$text) return;

    try {
        stgEnsureTables();

        // Upsert conversación
        $conv = stgDb()->prepare("SELECT id, bot_active, stage, contact_name,
            contact_rut, contact_email, company_name, client_type,
            service_origin, service_destination, service_date,
            service_hour, service_hour_return,
            service_passengers, service_type, service_vehicle,
            wa_draft_quote_id, form_submitted_at
            FROM wa_cloud_conversations WHERE phone=? LIMIT 1");
        $conv->execute([$phone]);
        $row = $conv->fetch();

        if (!$row) {
            $cid = stgDbUuid();
            stgDb()->prepare("INSERT INTO wa_cloud_conversations
                (id,phone,contact_name,bot_active,last_msg_at,last_message,last_customer_msg_at,unread_count)
                VALUES (?,?,?,1,NOW(),?,NOW(),1)")
                ->execute([$cid, $phone, $name, $text]);
            $row = ['id' => $cid, 'bot_active' => 1, 'stage' => 'nuevo',
                    'contact_name' => $name, 'contact_rut' => null,
                    'contact_email' => null, 'company_name' => null,
                    'client_type' => null, 'service_origin' => null,
                    'service_destination' => null, 'service_date' => null,
                    'service_hour' => null, 'service_hour_return' => null,
                    'service_passengers' => null, 'service_type' => null,
                    'service_vehicle' => null, 'wa_draft_quote_id' => null,
                    'form_submitted_at' => null];
        } else {
            stgDb()->prepare("UPDATE wa_cloud_conversations
                SET last_msg_at=NOW(), last_message=?, last_customer_msg_at=NOW(),
                    unread_count=unread_count+1
                    " . ($name && !$row['contact_name'] ? ", contact_name=?" : "") . "
                WHERE id=?")
                ->execute($name && !$row['contact_name']
                    ? [$text, $name, $row['id']]
                    : [$text, $row['id']]);
        }

        $convId = $row['id'];

        // Guardar mensaje entrante
        $msgId = stgDbUuid();
        try {
            stgDb()->prepare("INSERT INTO wa_cloud_messages
                (id,conversation_id,wamid,direction,msg_type,content,sender_type,status)
                VALUES (?,?,?,'in','text',?,'customer','received')")
                ->execute([$msgId, $convId, $wamid, $text]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') return; // duplicate wamid
            throw $e;
        }

        if (!$row['bot_active']) {
            stgLog("BOT_OFF conv=$convId — sin respuesta");
            return;
        }

        // Historial para Claude
        $hist = stgDb()->prepare("SELECT direction, content FROM wa_cloud_messages
            WHERE conversation_id=? ORDER BY created_at DESC LIMIT 20");
        $hist->execute([$convId]);
        $msgs = array_reverse($hist->fetchAll());

        $fichaActual = array_filter(array_intersect_key($row, array_flip([
            'contact_name','contact_email','contact_rut',
            'company_name','client_type',
            'service_origin','service_destination','service_date',
            'service_hour','service_hour_return',
            'service_passengers','service_type','service_vehicle',
            'form_submitted_at',
        ])), fn($v) => $v !== null && $v !== '');

        $systemPrompt = stgBuildSystemPrompt($fichaActual);
        $claude = stgCallClaude($systemPrompt, $msgs);

        if (!$claude) {
            stgLog("CLAUDE_NULL conv=$convId");
            return;
        }

        // Procesar FICHA_JSON
        if (preg_match('/\[FICHA_JSON:(\{.*?\})\]/s', $claude, $m)) {
            $ficha = json_decode($m[1], true) ?? [];
            $fichaMap = [
                'nombre'       => 'contact_name',
                'email'        => 'contact_email',
                'rut'          => 'contact_rut',
                'razon_social' => 'company_name',
                'tipo_cliente' => 'client_type',
                'origen'       => 'service_origin',
                'destino'      => 'service_destination',
                'fecha'        => 'service_date',
                'hora_salida'  => 'service_hour',
                'hora_retorno' => 'service_hour_return',
                'pasajeros'    => 'service_passengers',
                'tipo'         => 'service_type',
            ];
            $cols = []; $vals = [];
            foreach ($fichaMap as $key => $col) {
                if (!isset($ficha[$key]) || $ficha[$key] === '' || $ficha[$key] === null) continue;
                $v = $ficha[$key];
                if ($col === 'service_date' && preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $v, $pd)) {
                    $v = "{$pd[3]}-{$pd[2]}-{$pd[1]}";
                }
                $cols[] = "$col=?";
                $vals[] = $v;
            }
            if ($cols) {
                $vals[] = $convId;
                stgDb()->prepare("UPDATE wa_cloud_conversations SET " . implode(',', $cols) . " WHERE id=?")
                    ->execute($vals);
            }
        }

        $visible = preg_replace('/\[FICHA_JSON:.*?\]/s', '', $claude);
        $visible = trim($visible);

        // Envío real solo para REAL_SEND_PHONES; resto mantiene DRY-RUN
        if (REAL_SEND_PHONES && in_array($phone, REAL_SEND_PHONES)) {
            $wamidOut = stgSendWA($phone, $visible);
            stgLog("REAL_SEND conv=$convId to=$phone wamid=" . ($wamidOut ?? 'NULL') . " msg=" . substr($visible, 0, 80));
            if ($wamidOut) {
                // Actualizar wamid de salida con el real
                stgDb()->prepare("UPDATE wa_cloud_messages SET wamid=? WHERE conversation_id=? AND direction='out' ORDER BY created_at DESC LIMIT 1")
                    ->execute([$wamidOut, $convId]);
            }
        } else {
            stgLog("DRY_RUN_SEND conv=$convId to=$phone msg=" . substr($visible, 0, 80));
        }

        // Guardar mensaje de salida en staging DB
        $outId = stgDbUuid();
        stgDb()->prepare("INSERT INTO wa_cloud_messages
            (id,conversation_id,wamid,direction,msg_type,content,sender_type,status)
            VALUES (?,?,?,'out','text',?,'bot','sent')")
            ->execute([$outId, $convId, 'stg_out_' . uniqid(), $visible]);

        stgDb()->prepare("UPDATE wa_cloud_conversations
            SET last_msg_at=NOW(), last_message=? WHERE id=?")
            ->execute([$visible, $convId]);

    } catch (Throwable $e) {
        stgLog("ERROR " . $e->getMessage() . " in " . $e->getFile() . ':' . $e->getLine());
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// stgSendWA: envío real via Meta Cloud API (solo para REAL_SEND_PHONES)
// Usa los mismos tokens de producción (META_WA_TOKEN / META_WA_PHONE_NUMBER_ID)
// ─────────────────────────────────────────────────────────────────────────────

function stgSendWA(string $phone, string $text): ?string {
    $token   = defined('META_WA_TOKEN')           ? META_WA_TOKEN           : (getenv('WHATSAPP_TOKEN') ?: '');
    $phoneId = defined('META_WA_PHONE_NUMBER_ID') ? META_WA_PHONE_NUMBER_ID : (getenv('WHATSAPP_PHONE_NUMBER_ID') ?: '');
    if (!$token || !$phoneId) {
        stgLog("REAL_SEND_ERR no META_WA_TOKEN / META_WA_PHONE_NUMBER_ID");
        return null;
    }
    $payload = [
        'messaging_product' => 'whatsapp',
        'to'                => $phone,
        'type'              => 'text',
        'text'              => ['body' => $text, 'preview_url' => false],
    ];
    $ch = curl_init("https://graph.facebook.com/v21.0/{$phoneId}/messages");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT    => 15,
    ]);
    $resp    = curl_exec($ch);
    $status  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);
    if ($resp === false || $curlErr || $status >= 300) {
        stgLog("REAL_SEND_ERR status={$status} err={$curlErr} resp=" . substr((string)$resp, 0, 200));
        return null;
    }
    $data = json_decode($resp, true);
    return $data['messages'][0]['id'] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildSystemPrompt y callClaude — reutiliza la misma lógica que producción
// ─────────────────────────────────────────────────────────────────────────────

function stgBuildSystemPrompt(array $fichaActual): string {
    $hoy      = date('d/m/Y');
    $diasSem  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    $diaSem   = $diasSem[(int)date('w')];

    $fichaJson = json_encode($fichaActual, JSON_UNESCAPED_UNICODE);

    $pasos = "
PASO 1: Saluda y pregunta origen + destino + fecha
PASO 2: Pregunta hora de salida y hora de retorno aproximada
        Luego: ¿Es cotización para colegio/empresa o persona particular?
        Si empresa: pide nombre/razón social + RUT empresa
        Si persona: pide nombre completo
PASO 3: Pide correo electrónico
PASO 4: Pregunta número de pasajeros y tipo de vehículo preferido
PASO 5: Resume toda la información y confirma que se generará la cotización
";

    return <<<SYS
Eres Sofía, asistente comercial de TransCCL en ENTORNO DE STAGING.
Hoy es $diaSem $hoy.

## Estado actual de la ficha (STAGING)
$fichaJson

## Instrucciones
- Nunca repitas preguntas ya respondidas (revisa el estado de la ficha)
- Solo solicita datos faltantes
- Responde siempre en español, tono profesional y amable
- STAGING: no hay envíos reales

$pasos

## FICHA_JSON
Cuando captures un dato nuevo, incluye al final del mensaje:
[FICHA_JSON:{"nombre":"...","email":"...","rut":"...","razon_social":"...","tipo_cliente":"...","origen":"...","destino":"...","fecha":"...","hora_salida":"...","hora_retorno":"...","pasajeros":"...","tipo":"..."}]
Solo incluye claves con valor conocido.
SYS;
}

function stgCallClaude(string $systemPrompt, array $msgs): ?string {
    if (!_AI_KEY_STG) return null;

    $messages = [];
    foreach ($msgs as $m) {
        $messages[] = [
            'role'    => $m['direction'] === 'in' ? 'user' : 'assistant',
            'content' => $m['content'] ?? '',
        ];
    }
    if (empty($messages) || end($messages)['role'] !== 'user') {
        return null;
    }

    $payload = [
        'model'      => 'claude-sonnet-4-5',
        'max_tokens' => 400,
        'system'     => $systemPrompt,
        'messages'   => $messages,
    ];

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-api-key: ' . _AI_KEY_STG,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_TIMEOUT        => 30,
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);

    if (!$resp) return null;
    $data = json_decode($resp, true);
    return $data['content'][0]['text'] ?? null;
}
