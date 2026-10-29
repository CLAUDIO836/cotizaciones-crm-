<?php
/**
 * WhatsApp Cloud API Webhook — TransCCL
 * Meta: https://developers.facebook.com/apps/1769823987573457/webhooks/
 * URL pública: https://www.transccl.cl/wa_webhook.php
 * Phone Number ID: 1354527324415134  (+56 2 2914 9664)
 */

// Carga secrets si no están ya cargados por auto_prepend
$_s = '/home/transccl/crm-secrets.php';
if (file_exists($_s) && !defined('META_WA_TOKEN')) require_once $_s;

define('_DB_HOST',   'localhost');
define('_DB_NAME',   'transccl_crm');
define('_DB_USER',   'transccl_crm_user');
define('_DB_PASS',   getenv('CRM_DB_PASSWORD') ?: 'Claudio@1978');
define('_WA_TOKEN',  defined('META_WA_TOKEN')           ? META_WA_TOKEN           : (getenv('WHATSAPP_TOKEN') ?: ''));
define('_WA_PHONE',  defined('META_WA_PHONE_NUMBER_ID') ? META_WA_PHONE_NUMBER_ID : (getenv('WHATSAPP_PHONE_NUMBER_ID') ?: ''));
define('_AI_KEY',    defined('ANTHROPIC_API_KEY')       ? ANTHROPIC_API_KEY       : (getenv('ANTHROPIC_API_KEY') ?: ''));
define('_VERIFY',    defined('WA_WEBHOOK_VERIFY_TOKEN') ? WA_WEBHOOK_VERIFY_TOKEN : '');

// ── GET: verificación de Meta ─────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode      = $_GET['hub_mode']         ?? $_GET['hub.mode']         ?? '';
    $token     = $_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '';
    $challenge = $_GET['hub_challenge']    ?? $_GET['hub.challenge']    ?? '';

    if ($mode === 'subscribe' && _VERIFY !== '' && hash_equals(_VERIFY, $token)) {
        http_response_code(200);
        header('Content-Type: text/plain');
        echo $challenge;
        exit;
    }
    http_response_code(403);
    exit;
}

// ── Solo acepta POST ──────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];

// Responder 200 a Meta de inmediato y seguir procesando
http_response_code(200);
header('Content-Type: application/json');
echo '{"ok":true}';
if (ob_get_level() > 0) ob_end_flush();
flush();
if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
ignore_user_abort(true);
set_time_limit(120);

// ── Parsear y procesar mensajes ───────────────────────────────────────────────
foreach ($body['entry'] ?? [] as $entry) {
    foreach ($entry['changes'] ?? [] as $change) {
        if (($change['field'] ?? '') !== 'messages') continue;
        $val = $change['value'] ?? [];

        foreach ($val['messages'] ?? [] as $msg) {
            $wamid = $msg['id']        ?? '';
            $phone = $msg['from']      ?? '';
            $type  = $msg['type']      ?? '';
            $ts    = (int)($msg['timestamp'] ?? time());

            if (!$wamid || !$phone) continue;

            // Extraer texto según tipo
            if ($type === 'text') {
                $text = $msg['text']['body'] ?? '';
            } elseif ($type === 'button') {
                $text = $msg['button']['text'] ?? '';
            } elseif ($type === 'interactive') {
                $text = $msg['interactive']['button_reply']['title']
                     ?? $msg['interactive']['list_reply']['title']
                     ?? '';
            } else {
                $text = "[{$type}]";
            }

            // Nombre del contacto
            $name = null;
            foreach ($val['contacts'] ?? [] as $c) {
                if (($c['wa_id'] ?? '') === $phone) {
                    $name = $c['profile']['name'] ?? null;
                    break;
                }
            }

            processMessage($wamid, $phone, $text, $name, $ts);
        }
    }
}
exit;

// ─────────────────────────────────────────────────────────────────────────────

function db(): PDO {
    static $pdo;
    if (!$pdo) {
        $pdo = new PDO(
            'mysql:host=' . _DB_HOST . ';dbname=' . _DB_NAME . ';charset=utf8mb4',
            _DB_USER, _DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    }
    return $pdo;
}

function dbUuid(): string {
    return db()->query("SELECT UUID() AS u")->fetch()['u'];
}

function ensureTables(): void {
    $pdo = db();

    $pdo->exec("CREATE TABLE IF NOT EXISTS wa_cloud_conversations (
        id           CHAR(36)     NOT NULL PRIMARY KEY,
        phone        VARCHAR(30)  NOT NULL,
        contact_name VARCHAR(120),
        assigned_to  VARCHAR(36),
        bot_active   TINYINT(1)   NOT NULL DEFAULT 1,
        last_msg_at  DATETIME,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_phone (phone),
        INDEX idx_assigned (assigned_to),
        INDEX idx_last_msg (last_msg_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS wa_cloud_messages (
        id              CHAR(36)     NOT NULL PRIMARY KEY,
        conversation_id CHAR(36)     NOT NULL,
        wamid           VARCHAR(128) NOT NULL,
        direction       ENUM('in','out') NOT NULL DEFAULT 'in',
        msg_type        VARCHAR(20)  NOT NULL DEFAULT 'text',
        content         TEXT,
        status          VARCHAR(20)  NOT NULL DEFAULT 'received',
        created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_wamid (wamid),
        INDEX idx_conv (conversation_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function processMessage(string $wamid, string $phone, string $text, ?string $name, int $ts): void {
    if (!$text) return;

    try {
        ensureTables();
        $pdo = db();

        // Upsert conversación
        $stmt = $pdo->prepare("SELECT id, bot_active FROM wa_cloud_conversations WHERE phone = ?");
        $stmt->execute([$phone]);
        $conv = $stmt->fetch();

        if ($conv) {
            $convId    = $conv['id'];
            $botActive = (bool)(int)$conv['bot_active'];
            $pdo->prepare("UPDATE wa_cloud_conversations SET last_msg_at = NOW(), contact_name = COALESCE(?, contact_name) WHERE id = ?")
                ->execute([$name ?: null, $convId]);
        } else {
            $convId    = dbUuid();
            $botActive = true;
            $pdo->prepare("INSERT INTO wa_cloud_conversations (id, phone, contact_name, bot_active, last_msg_at) VALUES (?,?,?,1,NOW())")
                ->execute([$convId, $phone, $name ?: null]);
        }

        // Guardar mensaje entrante (INSERT IGNORE deduplica)
        $msgId      = dbUuid();
        $created_at = date('Y-m-d H:i:s', $ts);
        $stmt = $pdo->prepare("INSERT IGNORE INTO wa_cloud_messages
            (id, conversation_id, wamid, direction, content, created_at)
            VALUES (?,?,?,'in',?,?)");
        $stmt->execute([$msgId, $convId, $wamid, $text, $created_at]);
        $isNew = $stmt->rowCount() > 0;

        if (!$isNew || !$botActive) return;

        // Historial (últimos 20 mensajes, orden ascendente)
        $hStmt = $pdo->prepare("SELECT direction, content FROM wa_cloud_messages
            WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 20");
        $hStmt->execute([$convId]);
        $history = array_reverse($hStmt->fetchAll());

        // Llamar a Claude
        $botReply = runBot($phone, $text, $history, $name);
        if (!$botReply) return;

        // Detectar y extraer etiqueta de escalado
        $shouldEscalate = str_contains($botReply, '[ESCALAR_A_HUMANO]');
        $botReply       = trim(str_replace('[ESCALAR_A_HUMANO]', '', $botReply));

        // Enviar respuesta por WhatsApp
        if ($botReply) {
            $wamidOut = sendWA($phone, $botReply);

            // Guardar mensaje saliente
            if ($wamidOut) {
                $outId = dbUuid();
                $pdo->prepare("INSERT IGNORE INTO wa_cloud_messages
                    (id, conversation_id, wamid, direction, content)
                    VALUES (?,?,?,'out',?)")
                    ->execute([$outId, $convId, $wamidOut, $botReply]);
            }
        }

        // Escalar a humano
        if ($shouldEscalate) {
            $pdo->prepare("UPDATE wa_cloud_conversations SET bot_active = 0 WHERE id = ?")
                ->execute([$convId]);
        }

    } catch (Throwable $e) {
        // Silenciar errores para no romper la respuesta a Meta
        error_log('[wa_webhook] ERROR: ' . $e->getMessage());
    }
}

function sendWA(string $phone, string $text): ?string {
    if (!_WA_TOKEN || !_WA_PHONE) return null;

    $payload = [
        'messaging_product' => 'whatsapp',
        'to'                => $phone,
        'type'              => 'text',
        'text'              => ['body' => $text, 'preview_url' => false],
    ];

    $ch = curl_init("https://graph.facebook.com/v21.0/" . _WA_PHONE . "/messages");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . _WA_TOKEN,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT    => 15,
    ]);
    $resp   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status >= 400) {
        error_log('[wa_webhook] Meta API error ' . $status . ': ' . $resp);
        return null;
    }
    $data = json_decode($resp, true) ?? [];
    return $data['messages'][0]['id'] ?? null;
}

function runBot(string $phone, string $latestMsg, array $history, ?string $name): ?string {
    if (!_AI_KEY) return null;

    // Construir array de mensajes para Claude (alternando user/assistant)
    $messages = [];
    foreach ($history as $h) {
        $role    = $h['direction'] === 'in' ? 'user' : 'assistant';
        $content = $h['content'] ?? '';
        if (!$content) continue;

        // Consolidar mensajes consecutivos del mismo rol
        if (!empty($messages) && end($messages)['role'] === $role) {
            $messages[count($messages)-1]['content'] .= "\n" . $content;
        } else {
            $messages[] = ['role' => $role, 'content' => $content];
        }
    }

    // Debe empezar con 'user' y terminar con 'user'
    if (empty($messages) || $messages[0]['role'] !== 'user') {
        $messages = [['role' => 'user', 'content' => $latestMsg]];
    } elseif (end($messages)['role'] !== 'user') {
        $messages[] = ['role' => 'user', 'content' => $latestMsg];
    }

    $payload = [
        'model'      => 'claude-sonnet-5-5',
        'max_tokens' => 600,
        'system'     => buildSystemPrompt($phone, $name),
        'messages'   => $messages,
    ];

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => [
            'x-api-key: ' . _AI_KEY,
            'anthropic-version: 2023-06-01',
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT    => 30,
    ]);
    $resp   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status !== 200) {
        error_log('[wa_webhook] Claude API error ' . $status . ': ' . $resp);
        return null;
    }
    $data = json_decode($resp, true) ?? [];
    return $data['content'][0]['text'] ?? null;
}

function buildSystemPrompt(string $phone, ?string $name): string {
    $tz   = new DateTimeZone('America/Santiago');
    $now  = new DateTime('now', $tz);
    $dow  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'][(int)$now->format('w')];
    $h    = (int)$now->format('H');
    $m    = (int)$now->format('i');
    $wday = (int)$now->format('N'); // 1=Lun..7=Dom
    $biz  = $wday >= 1 && $wday <= 5 && ($h > 8 || ($h === 8 && $m >= 30)) && $h < 18;
    $horario = $biz ? 'dentro del horario hábil' : 'fuera del horario hábil';
    $nameStr = $name ? "\nNOMBRE WA: $name" : '';

    return "Eres el asistente virtual de TransCCL, empresa chilena de transporte de pasajeros. " .
           "Atiendes consultas de ventas por WhatsApp.\n\n" .
           "HOY: $dow {$now->format('d/m/Y')} {$now->format('H:i')} ({$horario}, L–V 8:30–18:00 hora Chile)\n" .
           "CLIENTE: $phone{$nameStr}\n\n" .
           "## TU ROL\n" .
           "- Responder al instante, amable, español de Chile, tratar de tú.\n" .
           "- Armar la ficha de solicitud conversando, sin formularios rígidos.\n" .
           "- NUNCA volver a preguntar datos que el cliente ya dio.\n" .
           "- Mensajes cortos, máximo 2 preguntas por mensaje. Emojis con moderación: 🚌 👋 ✅ 📅.\n" .
           "- Montos con punto de miles: \$157.500.\n\n" .
           "## OFERTA SALIDAS EDUCATIVAS (hasta 15-nov-2026)\n" .
           "- \$157.500 por bus: colegio y destino dentro del anillo Américo Vespucio.\n" .
           "- \$187.500 por bus: destino Buin Zoo (dentro del anillo).\n" .
           "- Bus hasta 45 pax, cinturón + climatización. DEJA Y RETIRA (el bus no queda esperando).\n" .
           "- Salida del colegio DESDE las 09:00. Regreso del destino ANTES de las 15:00, mismo día.\n" .
           "- Máx. 8 buses diarios para la oferta. Valores EXENTOS de IVA.\n" .
           "- Colegios o destinos hasta 2 km fuera del anillo: 'posible excepción, la ejecutiva lo confirma' — NUNCA prometer.\n" .
           "- Colegios con otros destinos (playa, campo, fuera de Santiago, etc.) o que necesitan espera: " .
           "'como colegio también tienen precios especiales, una ejecutiva te cotiza'. NO DAR PRECIO.\n\n" .
           "## CALIFICA PARA LA OFERTA (todos deben cumplirse)\n" .
           "1. Salida educativa (colegio, jardín, establecimiento educacional).\n" .
           "2. Colegio dentro del anillo Américo Vespucio.\n" .
           "3. Destino dentro del anillo (→ \$157.500) o Buin Zoo (→ \$187.500).\n" .
           "4. Salida ≥ 09:00 y regreso del destino < 15:00, mismo día.\n" .
           "5. Fecha ≤ 15-nov-2026.\n" .
           "6. Acepta modalidad deja y retira.\n\n" .
           "## FICHA A RECOLECTAR (conversando, en este orden)\n" .
           "1. Tipo de servicio.\n" .
           "2. N° de pasajeros.\n" .
           "3. Dirección exacta origen (calle, número, comuna).\n" .
           "4. Dirección exacta destino.\n" .
           "5. Fecha y hora de salida; hora de retorno.\n" .
           "6. ¿Espera o deja y retira? ¿Paradas?\n" .
           "7. Nombre, correo, razón social.\n" .
           "8. RUT (AL FINAL: 'para emitir la cotización formal').\n\n" .
           "Antes de preguntar, revisar TODO lo que el cliente ya escribió.\n\n" .
           "## URGENCIA (SOLO LO VERDADERO)\n" .
           "Siempre: 'Solo tenemos 8 buses diarios para esta oferta, conviene reservar pronto.' " .
           "NUNCA inventar cupos específicos restantes.\n\n" .
           "## DERIVACIÓN\n" .
           "- Salida educativa / paseo / viaje especial / evento → ejecutiva (el CRM asigna por rotación).\n" .
           "- Empresa o traslado de personal recurrente → Paola Briceño directo.\n" .
           "- Postulante a conductor → info@transccl.cl asunto 'Postulantes'. No tomar datos.\n" .
           "- Choque/accidente → pedir nombre, teléfono, lugar, hora, patente. NO admitir responsabilidad.\n\n" .
           "## HORARIO\n" .
           "Dentro del horario: 'una ejecutiva te contactará a la brevedad.'\n" .
           "Fuera del horario: 'nuestro horario es L–V 8:30–18:00; tu solicitud quedó registrada y una ejecutiva " .
           "te contactará el próximo día hábil desde las 8:30.'\n\n" .
           "## CUÁNDO ESCALAR A HUMANO\n" .
           "Incluye la etiqueta [ESCALAR_A_HUMANO] al final de tu respuesta si:\n" .
           "- La ficha está completa y el cliente confirmó el resumen.\n" .
           "- El cliente pide hablar con una persona.\n" .
           "- El cliente está molesto o reclama.\n" .
           "- Es un choque o accidente.\n" .
           "- Es traslado de personal recurrente (empresa).\n" .
           "- Llevas 8+ turnos sin ficha completa.\n\n" .
           "## REGLAS ABSOLUTAS\n" .
           "1. NUNCA dar precio fuera de la oferta ni rangos para viajes que no califican.\n" .
           "2. NUNCA confirmar reservas ni disponibilidad.\n" .
           "3. NUNCA inventar cupos específicos restantes.\n" .
           "4. NUNCA volver a pedir datos ya dados por el cliente.\n" .
           "5. NUNCA prometer que el bus espera dentro del precio de la oferta.\n" .
           "6. NUNCA decir 'SD' al cliente; decir 'traslado de personal'.\n\n" .
           "## FORMATO\n" .
           "Responde SOLO el texto del mensaje WhatsApp. Sin markdown (sin **, sin #). " .
           "Sin prefijos ni etiquetas adicionales. " .
           "Si debes escalar, añade [ESCALAR_A_HUMANO] en una línea aparte al final.";
}
