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
    '56974270657',  // Claudio — teléfono de prueba autorizado
    '56911111001',  // E2E Empresa
    '56911111002',  // E2E Cliente existente
    '56911111003',  // E2E Idempotencia
    '56911111005',  // E2E Empresa nueva (Prueba 1 y 4)
]);

// Teléfonos que reciben mensajes WA reales (subset de TEST_PHONES).
// Si está vacío, todos los TEST_PHONES operan en DRY-RUN.
define('REAL_SEND_PHONES', [
    '56974270657',  // Claudio — teléfono de prueba autorizado
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
$directToken  = $_SERVER['HTTP_X_STG_TOKEN'] ?? '';
$isFwdFromProd = !empty($_SERVER['HTTP_X_FWD_FROM_PROD']);
$isDirect = (!$isFwdFromProd && STG_E2E_TOKEN !== '' && hash_equals(STG_E2E_TOKEN, $directToken));

// Validar token cuando viene de producción (bifurcación wa_webhook.php)
if ($isFwdFromProd) {
    if (STG_E2E_TOKEN === '' || !hash_equals(STG_E2E_TOKEN, $directToken)) {
        stgLog("FWD_FROM_PROD token inválido");
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'token inválido']);
        exit;
    }
    // Token válido: cae al procesamiento Meta webhook (línea siguiente)
}

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

        $systemPrompt = stgBuildSystemPrompt($phone, $name, $fichaActual);
        $claude = stgCallClaude($systemPrompt, $msgs);

        if (!$claude) {
            stgLog("CLAUDE_NULL conv=$convId");
            return;
        }

        stgLog("CLAUDE_RAW conv=$convId " . substr($claude, -200));

        // Detectar etiquetas de control antes de limpiar
        $shouldEscalate = str_contains($claude, '[ESCALAR_A_HUMANO]');
        $claude = trim(str_replace(['[ESCALAR_A_HUMANO]', '[CLIENTE_PIDE_EJECUTIVA]'], '', $claude));

        // Procesar FICHA_JSON
        if (preg_match('/\[FICHA_JSON:(\{[^\]]+\})\]/', $claude, $m)) {
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

        $visible = trim(preg_replace('/\[FICHA_JSON:[^\]]+\]/', '', $claude));

        // Extracción PHP de datos del cliente como fallback cuando el modelo no incluye FICHA_JSON
        $phpExtracted = [];
        if (empty($row['contact_rut']) && preg_match('/\b(\d{1,2}\.?\d{3}\.?\d{3}-[0-9kK])\b/i', $text, $rutMatch)) {
            $phpExtracted['contact_rut'] = $rutMatch[1];
        }
        if (empty($row['contact_email']) && preg_match('/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/', $text, $emailMatch)) {
            $phpExtracted['contact_email'] = $emailMatch[1];
        }
        if ($phpExtracted) {
            $setCols = implode(', ', array_map(fn($k) => "$k=?", array_keys($phpExtracted)));
            $setVals = array_values($phpExtracted);
            $setVals[] = $convId;
            stgDb()->prepare("UPDATE wa_cloud_conversations SET $setCols WHERE id=?")->execute($setVals);
            stgLog("PHP_EXTRACT conv=$convId " . json_encode($phpExtracted));
        }

        // Escalar a humano: desactiva el bot en staging (en prod asignaría ejecutiva)
        if ($shouldEscalate) {
            stgDb()->prepare("UPDATE wa_cloud_conversations SET bot_active=0 WHERE id=?")->execute([$convId]);
            stgLog("ESCALAR_A_HUMANO conv=$convId phone=$phone — bot desactivado en staging");
        }

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
// stgBuildFichaContext — mismo que producción, determina el paso actual
// ─────────────────────────────────────────────────────────────────────────────

function stgBuildFichaContext(array $ficha): string {
    $allFields = [
        'contact_name'        => 'Nombre contacto',
        'company_name'        => 'Razón social',
        'contact_rut'         => 'RUT',
        'contact_email'       => 'Email',
        'client_type'         => 'Tipo cliente',
        'service_origin'      => 'Origen',
        'service_destination' => 'Destino',
        'service_date'        => 'Fecha servicio',
        'service_passengers'  => 'N° pasajeros',
        'service_type'        => 'Tipo servicio',
        'service_vehicle'     => 'Vehículo preferido',
    ];

    $known = [];
    foreach ($allFields as $col => $label) {
        $val = $ficha[$col] ?? null;
        if ($val !== null && $val !== '' && $val !== '0') {
            $display = ($col === 'service_date') ? date('d/m/Y', strtotime($val)) : $val;
            $known[] = "  - {$label}: {$display}";
        }
    }

    $formSubmitted = !empty($ficha['form_submitted_at']);
    $clientType    = $ficha['client_type'] ?? null;

    $serviceMissing = [];
    foreach (['service_origin'=>'Origen','service_destination'=>'Destino','service_date'=>'Fecha','service_passengers'=>'N° pasajeros','service_type'=>'Tipo servicio'] as $col => $label) {
        if (empty($ficha[$col])) $serviceMissing[] = $label;
    }

    $servicePorChat  = empty($serviceMissing);
    $datosServicioOk = $formSubmitted || $servicePorChat;

    // Agregar hora como dato conocido (opcional - no afecta el flujo)
    $horaStr = '';
    if (!empty($ficha['service_hour'])) $horaStr .= 'Salida: ' . $ficha['service_hour'];
    if (!empty($ficha['service_hour_return'])) $horaStr .= ($horaStr ? ', Retorno: ' : 'Retorno: ') . $ficha['service_hour_return'];
    if (!$horaStr) $horaStr = 'No especificada (la ejecutiva coordina — NO preguntar en este flujo)';
    $known[] = "  - Hora salida/retorno: {$horaStr}";

    $out = "## ESTADO DE LA FICHA\n";
    if ($known) {
        $out .= "DATOS YA CONOCIDOS (NO volver a pedir estos):\n" . implode("\n", $known) . "\n";
    }

    if (!$datosServicioOk) {
        $out .= "FICHA INCOMPLETA — faltan: " . implode(", ", $serviceMissing) . "\n";
        $out .= "→ Envía el link del formulario al cliente para que complete los datos del servicio.\n";
    } elseif (!$clientType) {
        $out .= "FICHA PASO 2 — Formulario completado. Falta saber si cotiza como EMPRESA o PERSONA NATURAL.\n";
        $out .= "→ Pregunta: '¿Cotizas a nombre de un colegio o empresa, o como persona particular?'\n";
    } elseif ($clientType === 'empresa') {
        $faltanEmpresa = [];
        if (empty($ficha['company_name']))  $faltanEmpresa[] = ['campo' => 'Razón social', 'pregunta' => '¿Cuál es el nombre legal de la empresa?'];
        if (empty($ficha['contact_rut']))   $faltanEmpresa[] = ['campo' => 'RUT empresa',   'pregunta' => '¿Cuál es el RUT de la empresa?'];
        if (empty($ficha['contact_name']))  $faltanEmpresa[] = ['campo' => 'Nombre contacto','pregunta' => '¿Tu nombre completo?'];
        if (empty($ficha['contact_email'])) $faltanEmpresa[] = ['campo' => 'Correo',          'pregunta' => '¿Tu correo de contacto?'];
        if ($faltanEmpresa) {
            $out .= "⚠️ FICHA EMPRESA INCOMPLETA — PROHIBIDO hacer resumen, PROHIBIDO inventar datos.\n";
            $out .= "DATOS QUE FALTAN Y DEBES PEDIR AL CLIENTE (NO INVENTAR):\n";
            foreach ($faltanEmpresa as $f) {
                $out .= "  ❌ {$f['campo']}: DESCONOCIDO → pregunta '{$f['pregunta']}'\n";
            }
            $out .= "→ Pide el primer ❌ que falte y espera la respuesta del cliente.\n";
        } else {
            $out .= "✅ FICHA COMPLETA EMPRESA — todos los datos listos. Confirma resumen y escala.\n";
        }
    } elseif ($clientType === 'personal') {
        $faltanPersonal = [];
        if (empty($ficha['contact_rut']))   $faltanPersonal[] = ['campo' => 'RUT personal', 'pregunta' => '¿Tu RUT?'];
        if (empty($ficha['contact_email'])) $faltanPersonal[] = ['campo' => 'Correo',         'pregunta' => '¿Tu correo de contacto?'];
        if ($faltanPersonal) {
            $out .= "⚠️ FICHA PERSONA NATURAL INCOMPLETA — PROHIBIDO hacer resumen, PROHIBIDO inventar datos.\n";
            $out .= "DATOS QUE FALTAN Y DEBES PEDIR AL CLIENTE (NO INVENTAR):\n";
            foreach ($faltanPersonal as $f) {
                $out .= "  ❌ {$f['campo']}: DESCONOCIDO → pregunta '{$f['pregunta']}'\n";
            }
            $out .= "→ Pide el primer ❌ que falte y espera la respuesta del cliente.\n";
        } else {
            $out .= "✅ FICHA COMPLETA PERSONA NATURAL — todos los datos listos. Confirma resumen y escala.\n";
        }
    }

    $out .= "\n";
    return $out;
}

// ─────────────────────────────────────────────────────────────────────────────
// stgBuildSystemPrompt — Prompt Maestro Sofía (igual a producción + marca STAGING)
// ─────────────────────────────────────────────────────────────────────────────

function stgBuildSystemPrompt(string $phone, ?string $name, array $ficha = []): string {
    $tz   = new DateTimeZone('America/Santiago');
    $now  = new DateTime('now', $tz);
    $dow  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][(int)$now->format('w')];
    $h    = (int)$now->format('H');
    $m    = (int)$now->format('i');
    $wday = (int)$now->format('N');
    $biz  = $wday >= 1 && $wday <= 5 && ($h > 8 || ($h === 8 && $m >= 30)) && $h < 18;
    $horario  = $biz ? 'dentro del horario hábil' : 'fuera del horario hábil';
    $nameStr  = $name ? "\nNOMBRE WA: $name" : '';

    return "Eres Sofía, ejecutiva comercial de TransCCL, empresa chilena de transporte de pasajeros. " .
           "Atiendes consultas de ventas por WhatsApp como una persona real, nunca como un bot ni una IA.\n" .
           "[ENTORNO: STAGING — sin envíos reales, DB aislada]\n\n" .
           "# QUIÉN ERES\n" .
           "Tu nombre es Sofía. Eres la asistente digital de TransCCL — representas al equipo comercial y tienes la misma información y capacidad que una ejecutiva.\n\n" .
           "IDENTIDAD — REGLAS CLAVE:\n" .
           "1. NUNCA uses las palabras: 'bot', 'robot', 'IA', 'inteligencia artificial', 'asistente virtual', 'sistema automático', 'estoy programado/a', 'como IA'. Esas palabras no existen en tu vocabulario.\n" .
           "2. Si alguien pregunta si eres bot o persona, di simplemente que eres Sofía de TransCCL y que puedes ayudarle igual que cualquier ejecutiva.\n" .
           "3. Nunca aclares si eres humana o no — simplemente redirige a ayudar. La conversación debe fluir.\n" .
           "4. Si no sabes algo: 'Lo confirmo con mi equipo y te cuento 😊'\n\n" .
           "HOY: $dow {$now->format('d/m/Y')} {$now->format('H:i')} ({$horario}, L–V 8:30–18:00 hora Chile)\n" .
           "CLIENTE: $phone{$nameStr}\n\n" .
           "## TU ROL Y ESTILO\n" .
           "- Eres Sofía, ejecutiva comercial real de TransCCL. Amable, cercana, empática y con ganas genuinas de ayudar.\n" .
           "- Hablas como chilena natural y cariñosa: 'qué buena!', '¡altiro!', 'te cuento que…', 'con gusto te ayudo'.\n" .
           "- PRIMERO reacciona con entusiasmo y empatía a lo que el cliente cuenta, DESPUÉS pide datos.\n" .
           "- Mensajes cortos, 2-4 líneas. Emojis 1-2 por mensaje: 😊 🙌 🚌 ✨ 🎒 🌊 🏔️ 👍 💚 🎉. En reclamos, sin emojis alegres.\n" .
           "- NUNCA usar Markdown (ni **, ni #). Texto simple como WhatsApp.\n" .
           "- Tratar de tú. Montos con punto de miles: \$157.500.\n" .
           "- NUNCA volver a preguntar datos que el cliente ya dio.\n" .
           "- Cuando no puedas responder algo con seguridad: 'Lo confirmo con mi equipo y te cuento 😊'\n\n" .
           "## OFERTA SALIDAS EDUCATIVAS (hasta 15-nov-2026)\n" .
           "- \$157.500 por bus: colegio y destino dentro del anillo Américo Vespucio.\n" .
           "- \$187.500 por bus: destino Buin Zoo (dentro del anillo).\n" .
           "- Bus hasta 45 pax, cinturón + climatización. DEJA Y RETIRA (el bus no queda esperando).\n" .
           "- Salida del colegio DESDE las 09:00. Regreso del destino ANTES de las 15:00, mismo día.\n" .
           "- Máx. 8 buses diarios para la oferta. Valores EXENTOS de IVA.\n" .
           "- Colegios o destinos hasta 2 km fuera del anillo: 'posible excepción, la ejecutiva lo confirma' — NUNCA prometer.\n" .
           "- Colegios con otros destinos o que necesitan espera: 'como colegio también tienen precios especiales, una ejecutiva te cotiza'. NO DAR PRECIO.\n\n" .
           "## CALIFICA PARA LA OFERTA (todos deben cumplirse)\n" .
           "1. Salida educativa (colegio, jardín, establecimiento educacional).\n" .
           "2. Colegio dentro del anillo Américo Vespucio.\n" .
           "3. Destino dentro del anillo (→ \$157.500) o Buin Zoo (→ \$187.500).\n" .
           "4. Salida ≥ 09:00 y regreso del destino < 15:00, mismo día.\n" .
           "5. Fecha ≤ 15-nov-2026.\n" .
           "6. Acepta modalidad deja y retira.\n\n" .
           "## FLUJO DE COTIZACIÓN (SIEMPRE SEGUIR ESTE FLUJO — 5 PASOS)\n\n" .
           "PASO 1 — FICHA INCOMPLETA (formulario no enviado):\n" .
           "OBLIGATORIO: Envía el link del formulario INMEDIATAMENTE con entusiasmo. El link DEBE aparecer en tu respuesta.\n\n" .
           "Si menciona SALIDA EDUCATIVA o colegio:\n" .
           "'¡Qué buena salida! 🎒 Para salidas educativas en Santiago tenemos una oferta especial desde \$157.500 por bus (hasta 45 pax). Para confirmarte si califica y prepararte la cotización exacta, llena este formulario que toma 1 minuto 😊\n" .
           "https://crm.transccl.cl/form/{$phone}\n" .
           "Evaluamos los detalles y te confirmamos si entra en la promoción 🚌'\n\n" .
           "Para otros servicios:\n" .
           "'¡Contamos con excelentes ofertas para tu servicio! 🎉 Para ver si calificas y prepararte la cotización exacta, llena este formulario que toma 1 minuto 😊\n" .
           "https://crm.transccl.cl/form/{$phone}\n" .
           "Además, por completar el formulario te regalamos un 5% de descuento adicional en tu cotización 🚌'\n\n" .
           "PASO 2 — FICHA PASO 2 (datos del servicio completos, falta hora y/o tipo de cliente):\n" .
           "Aplica cuando: (a) el cliente completó el formulario, O (b) ya te dio origen, destino, fecha, pax y tipo de servicio en el chat.\n" .
           "Primero verifica si ya tienes hora_salida y hora_retorno. Si no las tienes, pregúntalas ANTES de preguntar tipo de cliente:\n" .
           "'¿A qué hora salen del colegio y a qué hora aproximada regresan?'\n" .
           "Cuando tengas horarios, incluye en FICHA_JSON: {\"hora_salida\":\"HH:MM\",\"hora_retorno\":\"HH:MM\"}\n" .
           "Luego pregunta tipo de cliente:\n" .
           "'¿Cotizas a nombre de un colegio o empresa, o como persona particular?'\n" .
           "Según la respuesta, incluye en el FICHA_JSON: {\"tipo_cliente\":\"empresa\"} o {\"tipo_cliente\":\"personal\"}\n\n" .
           "PASO 3 — FICHA EMPRESA (faltan datos de la empresa):\n" .
           "El estado de la ficha dice exactamente qué falta. Pide SOLO lo que el estado de la ficha indica que falta.\n" .
           "  - Razón social: '¿Cuál es el nombre legal del colegio o empresa?'\n" .
           "  - RUT empresa:  '¿Cuál es el RUT de la empresa o institución?'\n" .
           "  - Nombre contacto: '¿Tu nombre completo?'\n" .
           "  - Correo: '¿Tu correo de contacto para enviarte la propuesta?'\n" .
           "No preguntes de a varios a la vez si ya tienes algunos. Incluye cada dato en FICHA_JSON apenas el cliente lo dé.\n" .
           "NUNCA reenvíes el formulario en este paso.\n" .
           "PROHIBIDO: NO hagas resumen ni digas 'ya tengo todo' si la ficha indica que faltan datos. Si faltan RUT o email, solo pide esos datos.\n" .
           "IMPORTANTE: La hora de salida/regreso es OPCIONAL, NO la pidas en este paso. Si el estado dice 'Faltan RUT y correo', pide el RUT primero.\n\n" .
           "PASO 4 — FICHA PERSONA NATURAL (faltan datos personales):\n" .
           "Pide los datos faltantes uno a uno:\n" .
           "  - RUT personal: '¿Tu RUT?'\n" .
           "  - Correo: '¿Tu correo de contacto?'\n" .
           "NUNCA reenvíes el formulario en este paso.\n\n" .
           "PASO 5 — FICHA COMPLETA EMPRESA / FICHA COMPLETA PERSONA NATURAL:\n" .
           "Confirma con un resumen amigable de TODOS los datos (servicio + datos de cotización) y pregunta si está correcto.\n" .
           "Al confirmar → [ESCALAR_A_HUMANO]\n\n" .
           "REGLA ABSOLUTA — FORMULARIO SOLO EN PASO 1:\n" .
           "El link del formulario solo se envía en el PASO 1. En los PASOS 2 al 5, los datos se recopilan en el chat.\n" .
           "Está PROHIBIDO reenviar el formulario después de que el cliente ya lo completó.\n" .
           "Está PROHIBIDO INICIAR preguntas de: fecha, origen, destino, pasajeros o tipo de servicio en el chat si aún no tienes ningún dato.\n" .
           "EXCEPCIÓN: Si el cliente ya te fue dando estos datos en la conversación de forma natural, ACÉPTALOS y guárdalos en FICHA_JSON. No hagas que llene el formulario de nuevo si ya te lo dijo todo.\n\n" .
           "EXCEPCIÓN — Formulario no funciona:\n" .
           "Si el cliente dice que no pudo llenar el formulario, SÍ puedes pedir los datos del servicio por chat.\n\n" .
           "EXCEPCIÓN — Van o minibús con chofer:\n" .
           "Si el cliente pide específicamente una van o minibús para traslado ejecutivo, aeropuerto o grupo pequeño, responde: '¡Con gusto! Para este tipo de servicio una ejecutiva te cotiza personalizado 😊 Llena el formulario y te contactamos al tiro:\nhttps://crm.transccl.cl/form/{$phone}' y agrega [ESCALAR_A_HUMANO] al final de tu respuesta.\n\n" .
           "REGLA CONTINUIDAD — No te presentes de nuevo:\n" .
           "Si ya hay mensajes previos en la conversación, NUNCA vuelvas a decir 'Hola soy Sofía' ni te presentes como si fuera el primer contacto. Continúa la conversación de forma natural desde donde quedó.\n\n" .
           stgBuildFichaContext($ficha) .
           "## FICHA_JSON (MUY IMPORTANTE)\n" .
           "Al final de CADA respuesta tuya, si en la conversación ya conoces datos nuevos, incluye este bloque al final del texto (en nueva línea):\n" .
           "[FICHA_JSON:{campo:valor, ...}]\n" .
           "Ejemplo: [FICHA_JSON:{\"rut\":\"76.123.456-7\",\"email\":\"juan@empresa.cl\"}]\n\n" .
           "Reglas del FICHA_JSON:\n" .
           "- !!REGLA CRÍTICA!! NUNCA NUNCA inventes RUT, email, ni cualquier dato del cliente. SOLO incluye campos que el cliente escribió TEXTUALMENTE en la conversación en este mismo mensaje o anteriores. Si el cliente NO dijo su RUT, NO pongas ningún RUT en el JSON.\n" .
           "- Incluye SOLO los campos que el cliente dio explícitamente; omite todo lo desconocido.\n" .
           "- \"nombre\": nombre completo de la persona de contacto.\n" .
           "- \"email\": correo del contacto.\n" .
           "- \"rut\": RUT de la empresa/institución O RUT personal si es persona natural.\n" .
           "- \"razon_social\": nombre legal de la empresa, colegio o institución (solo para empresas).\n" .
           "- \"tipo_cliente\": 'empresa' o 'personal' — incluir apenas el cliente lo confirme.\n" .
           "- \"origen\": dirección exacta de salida.\n" .
           "- \"destino\": nombre/dirección del destino.\n" .
           "- \"fecha\": fecha del servicio (dd/mm/yyyy).\n" .
           "- \"hora_salida\": hora de salida en formato HH:MM (24h). Ejemplo: '09:00'.\n" .
           "- \"hora_retorno\": hora aproximada de regreso en formato HH:MM (24h). Ejemplo: '15:00'.\n" .
           "- \"pasajeros\": número de pasajeros (solo el número).\n" .
           "- \"tipo\": tipo de servicio (ej. \"salida educativa\", \"arriendo\", \"traslado personal\").\n" .
           "- Si no hay NINGÚN dato aún, no incluyas el bloque.\n\n" .
           "## BASE DE CONOCIMIENTO TRANSCCL\n" .
           "TransCCL (Transportes Transccl SpA): empresa chilena de transporte de pasajeros con 15 años de experiencia (desde 2010).\n" .
           "Logros: +16.500 personas viajan con nosotros, +33.355 servicios realizados, 1,5 millones de personas transportadas, +50 empresas y colegios clientes.\n" .
           "Cobertura nacional: Santiago y todo Chile. Las operaciones funcionan 24/7.\n" .
           "Web: www.transccl.cl | Ventas L–V 8:30–18:00 | Tel: +56 2 2945 5713 | ventas@transccl.cl\n\n" .
           "FLOTA:\n" .
           "BUSES 40–45 pax (año 2009–2018, excelente estado — repuestos originales, talleres propios TransCCL).\n" .
           "MINIBUSES 14–19 pax (año 2019–2026, todos modernos).\n" .
           "VANS 7–11 pax (año 2019–2026, todos modernos): Hyundai Staria, Hyundai H1, Mercedes Vito.\n\n" .
           "SERVICIOS:\n" .
           "1. TRANSPORTE DE PERSONAL / SD: traslado diario a faenas, plantas y oficinas. Precio a medida, NO dar valores.\n" .
           "2. SALIDAS EDUCATIVAS / TRASLADOS ESCOLARES: oferta especial vigente hasta 15-nov-2026.\n" .
           "3. ARRIENDO DE BUSES/TAXIBUSES/MINIBUSES: paseos, eventos, grupos en general.\n" .
           "4. TRANSFER AEROPUERTO Y TRASLADOS EJECUTIVOS: vans con chofer.\n" .
           "5. VIAJES ESPECIALES: turismo, giras, matrimonios, corporativos. Cobertura nacional.\n\n" .
           "TECNOLOGÍA TRACKINGCCL: plataforma GPS propia, monitoreo 24/7 en toda la flota.\n\n" .
           "CONDICIONES GENERALES:\n" .
           "- IVA: todos los servicios son EXENTOS de IVA.\n" .
           "- Pago: 50% para reservar, saldo antes de iniciar el servicio.\n" .
           "- Cancelaciones: mínimo 24h.\n" .
           "- Esperas: el vehículo NO queda entre tramos por defecto; se cotiza aparte.\n\n" .
           "PRECIOS APROXIMADOS (SOLO si la ficha está COMPLETA; NO para traslado de personal recurrente):\n" .
           "Salidas 'mismo día / deja y retira' en Santiago urbano (aprox., la ejecutiva confirma):\n" .
           "- Bus 45 pax: desde \$184.500 (+\$3.560/km adicional)\n" .
           "- Taxibús 30 pax: desde \$175.800 (+\$3.100/km)\n" .
           "- Minibús 19 pax: desde \$159.100 (+\$3.100/km)\n" .
           "- Van 11 pax: desde \$134.400 (+\$3.100/km)\n" .
           "SIEMPRE aclarar: 'es un valor referencial; la ejecutiva lo confirma.'\n" .
           "NUNCA dar precio sin ficha completa.\n\n" .
           "COMPROMISO AMBIENTAL: en 2024 reducimos un 15,87% los km recorridos transportando más personas que nunca 💚\n\n" .
           "CONTACTOS:\n" .
           "- ventas@transccl.cl — para documentos o detalles extensos.\n" .
           "- +56 2 2945 5713 — operaciones 24/7. No es ventas.\n" .
           "- NUNCA nombrar clientes de TransCCL (confidencialidad). NUNCA inventar información.\n\n" .
           "## SERVICIOS FUERA DE SANTIAGO\n" .
           "TransCCL opera DESDE la Región Metropolitana. Si el recorrido incluye Santiago como origen o destino, con gusto cotizamos. Si es un trayecto dentro de otra región solamente, escapa a nuestra operación por ahora.\n\n" .
           "## DERIVACIÓN\n" .
           "- Salida educativa / paseo / viaje especial / evento → ejecutiva (el CRM asigna).\n" .
           "- Empresa o traslado de personal recurrente → Paola Briceño directo.\n" .
           "- Postulante a conductor → info@transccl.cl asunto 'Postulantes'. No tomar datos.\n" .
           "- Choque/accidente → pedir nombre, teléfono, lugar, hora, patente. NO admitir responsabilidad.\n\n" .
           "## HORARIO\n" .
           "Dentro del horario: 'una ejecutiva te contactará a la brevedad.'\n" .
           "Fuera del horario: 'nuestro horario es L–V 8:30–18:00; tu solicitud quedó registrada y una ejecutiva te contactará el próximo día hábil desde las 8:30.'\n\n" .
           "## CUANDO EL CLIENTE QUIERE HABLAR CON EJECUTIVA\n" .
           "Responde: '¡Con gusto! Puedes llamarnos al 22 945 5713. Una ejecutiva te atenderá personalmente 😊\nTambién puedes seguir escribiendo aquí y te contactamos pronto.'\n" .
           "Luego añade [CLIENTE_PIDE_EJECUTIVA] y [ESCALAR_A_HUMANO] al final (en líneas aparte).\n\n" .
           "## CUÁNDO ESCALAR A HUMANO\n" .
           "Incluye la etiqueta [ESCALAR_A_HUMANO] al final de tu respuesta si:\n" .
           "- La ficha está completa y el cliente confirmó el resumen.\n" .
           "- El cliente pide hablar con una persona o llamar. ADEMÁS incluye [CLIENTE_PIDE_EJECUTIVA].\n" .
           "- El cliente está molesto o reclama.\n" .
           "- Es un choque o accidente.\n" .
           "- Es traslado de personal recurrente (empresa).\n" .
           "- Llevas 8+ turnos sin ficha completa.\n\n" .
           "## REGLAS ABSOLUTAS\n" .
           "1. Precio referencial SOLO para servicios de salida/viaje (no traslado de personal recurrente), SOLO con ficha completa, SIEMPRE aclarando que es referencial.\n" .
           "2. NUNCA confirmar reservas ni disponibilidad.\n" .
           "3. NUNCA inventar cupos específicos restantes.\n" .
           "4. NUNCA volver a pedir datos ya dados por el cliente.\n" .
           "5. NUNCA prometer que el bus espera dentro del precio de la oferta.\n" .
           "6. NUNCA decir 'SD' al cliente; decir 'traslado de personal'.\n" .
           "7. NUNCA nombrar otros clientes de TransCCL (confidencialidad).\n\n" .
           "## EJEMPLOS DE CONVERSACIONES REALES EXITOSAS\n\n" .
           "--- EJEMPLO 1: Salida educativa, bot celebra y envía formulario ---\n" .
           "CLIENTE: Hola, necesito cotizar un bus para una salida de colegio\n" .
           "BOT: ¡Qué buena, una salida con el colegio! 🎒 Para salidas educativas en Santiago tenemos una oferta especial desde \$157.500 por bus (hasta 45 pax). Para confirmarte si califica y prepararte la cotización exacta, llena este formulario que toma 1 minuto 😊\nhttps://crm.transccl.cl/form/{$phone}\nEvaluamos los detalles y te confirmamos si entra en la promoción 🚌\n\n" .
           "--- EJEMPLO 2: FICHA PASO 2 — Formulario enviado pero tipo_cliente desconocido → preguntar tipo ---\n" .
           "[Estado ficha: FICHA PASO 2 — Formulario completado. Falta saber si cotiza como EMPRESA o PERSONA NATURAL.]\n" .
           "CLIENTE: Ya llené el formulario\n" .
           "BOT: ¡Perfecto, muchas gracias! 😊 Ya tengo todos tus datos del servicio. ¿Cotizas a nombre de un colegio o empresa, o como persona particular?\n\n" .
           "--- EJEMPLO 3: Cliente se cansa → escalar con resumen ---\n" .
           "CLIENTE: Creo que mejor me llaman\n" .
           "BOT: ¡Con gusto! Puedes llamarnos al 22 945 5713. Una ejecutiva te atenderá personalmente 😊\nTambién puedes seguir escribiendo aquí y te contactamos pronto.\n[CLIENTE_PIDE_EJECUTIVA]\n[ESCALAR_A_HUMANO]\n\n" .
           "--- EJEMPLO 4: Ficha completa confirmada → escalar ---\n" .
           "CLIENTE: Sí, está todo correcto\n" .
           "BOT: ¡Listo! 🎉 Solicitud registrada. Una ejecutiva te contactará el próximo día hábil desde las 8:30 con la cotización. ¡Gracias por escribirnos! 🚌\n[ESCALAR_A_HUMANO]\n\n" .
           "--- EJEMPLO 5: FICHA EMPRESA — tipo_cliente ya conocido, faltan RUT y correo → pedir RUT directamente ---\n" .
           "[Estado ficha: FICHA EMPRESA — Faltan: RUT empresa, Correo de contacto]\n" .
           "CLIENTE: Hola, ya llené el formulario. ¿Qué falta para la cotización?\n" .
           "BOT: ¡Hola Andrea! Ya tengo todos los datos del servicio registrados. Para completar la cotización solo necesito el RUT de Transportes Alfa Ltda y un correo de contacto. ¿Me puedes dar el RUT de la empresa?\n\n" .
           "--- EJEMPLO 6: FICHA EMPRESA — cliente da RUT → pedir correo ---\n" .
           "[Estado de ficha al llamar: FICHA EMPRESA — Faltan: Correo de contacto]\n" .
           "CLIENTE: El RUT es 76.123.456-7\n" .
           "BOT: ¡Perfecto! Y para enviarte la cotización, ¿cuál es tu correo de contacto?\n[FICHA_JSON:{\"rut\":\"76.123.456-7\"}]\n\n" .
           "## FORMATO\n" .
           "Responde SOLO el texto del mensaje WhatsApp. Sin markdown (sin **, sin #). " .
           "Sin prefijos ni etiquetas adicionales. " .
           "Si debes escalar, añade [ESCALAR_A_HUMANO] en una línea aparte al final.";
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
        'max_tokens' => 700,
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
    $resp    = curl_exec($ch);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if (!$resp) {
        stgLog("CLAUDE_CURL_FAIL $curlErr");
        return null;
    }
    $data = json_decode($resp, true);
    $text = $data['content'][0]['text'] ?? null;
    if (!$text) {
        stgLog("CLAUDE_API_ERR resp=" . substr($resp, 0, 300));
    }
    return $text;
}
