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

date_default_timezone_set('America/Santiago');

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
            if ($type === 'reaction') continue; // ignorar reacciones emoji

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
        last_message TEXT,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_phone (phone),
        INDEX idx_assigned (assigned_to),
        INDEX idx_last_msg (last_msg_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Migraciones: añadir columnas si la tabla ya existía sin ellas
    foreach ([
        "ALTER TABLE wa_cloud_conversations ADD COLUMN last_message TEXT AFTER last_msg_at",
        "ALTER TABLE profiles ADD COLUMN wa_last_assigned_at DATETIME NULL",
    ] as $sql) {
        try { $pdo->exec($sql); } catch (PDOException $e) {
            if ($e->getCode() !== '42S21') throw $e;
        }
    }

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
            $pdo->prepare("UPDATE wa_cloud_conversations SET last_msg_at = NOW(), last_message = ?, contact_name = COALESCE(?, contact_name) WHERE id = ?")
                ->execute([mb_substr($text, 0, 500), $name ?: null, $convId]);
        } else {
            $convId    = dbUuid();
            $botActive = true;
            $pdo->prepare("INSERT INTO wa_cloud_conversations (id, phone, contact_name, bot_active, last_msg_at, last_message) VALUES (?,?,?,1,NOW(),?)")
                ->execute([$convId, $phone, $name ?: null, mb_substr($text, 0, 500)]);
        }

        // Guardar mensaje entrante (INSERT IGNORE deduplica)
        $msgId      = dbUuid();
        $created_at = date('Y-m-d H:i:s', $ts);
        $stmt = $pdo->prepare("INSERT IGNORE INTO wa_cloud_messages
            (id, conversation_id, wamid, direction, content, created_at)
            VALUES (?,?,?,'in',?,?)");
        $stmt->execute([$msgId, $convId, $wamid, $text, $created_at]);
        $isNew = $stmt->rowCount() > 0;

        if (!$isNew) { error_log("[wa_webhook] SKIP dup wamid={$wamid} phone={$phone}"); return; }
        if (!$botActive) { error_log("[wa_webhook] SKIP bot_inactive phone={$phone}"); return; }

        error_log("[wa_webhook] PROC phone={$phone} wamid={$wamid} ai=" . (bool)_AI_KEY . " wa=" . (bool)_WA_TOKEN);

        // Historial (últimos 20 mensajes, orden ascendente)
        $hStmt = $pdo->prepare("SELECT direction, content FROM wa_cloud_messages
            WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 20");
        $hStmt->execute([$convId]);
        $history = array_reverse($hStmt->fetchAll());

        // Llamar a Claude
        $botReply = runBot($phone, $text, $history, $name);
        if (!$botReply) { error_log("[wa_webhook] EMPTY_REPLY phone={$phone}"); return; }

        // Detectar y extraer etiqueta de escalado
        $shouldEscalate = str_contains($botReply, '[ESCALAR_A_HUMANO]');
        $botReply       = trim(str_replace('[ESCALAR_A_HUMANO]', '', $botReply));

        // Enviar respuesta por WhatsApp
        if ($botReply) {
            error_log("[wa_webhook] SEND phone={$phone} len=" . strlen($botReply));
            $wamidOut = sendWA($phone, $botReply);

            // Guardar mensaje saliente
            error_log("[wa_webhook] SENT phone={$phone} wamid=" . ($wamidOut ?? 'NULL'));
            if ($wamidOut) {
                $outId = dbUuid();
                $pdo->prepare("INSERT IGNORE INTO wa_cloud_messages
                    (id, conversation_id, wamid, direction, content, created_at)
                    VALUES (?,?,?,'out',?,NOW())")
                    ->execute([$outId, $convId, $wamidOut, $botReply]);
            }
        }

        // Escalar a humano
        if ($shouldEscalate) {
            $pdo->prepare("UPDATE wa_cloud_conversations SET bot_active = 0 WHERE id = ?")
                ->execute([$convId]);
            assignRoundRobin($pdo, $convId, $phone, $name);
        }

    } catch (Throwable $e) {
        // Silenciar errores para no romper la respuesta a Meta
        error_log('[wa_webhook] ERROR: ' . $e->getMessage());
    }
}

function assignRoundRobin(PDO $pdo, string $convId, string $clientPhone, ?string $clientName): void {
    // Ejecutiva con wa_last_assigned_at más antigua (NULL primero = nunca asignada)
    $stmt = $pdo->query("
        SELECT id, name, celular
        FROM profiles
        WHERE active = 1
          AND role NOT IN ('admin', 'superadmin')
          AND (suspended = 0 OR suspended IS NULL)
        ORDER BY wa_last_assigned_at IS NOT NULL ASC,
                 wa_last_assigned_at ASC
        LIMIT 1
    ");
    $exec = $stmt->fetch();
    if (!$exec) return;

    $pdo->prepare("UPDATE wa_cloud_conversations SET assigned_to = ? WHERE id = ?")
        ->execute([$exec['id'], $convId]);

    $pdo->prepare("UPDATE profiles SET wa_last_assigned_at = NOW() WHERE id = ?")
        ->execute([$exec['id']]);

    // Notificar a la ejecutiva por WhatsApp si tiene celular registrado
    if ($exec['celular'] && _WA_TOKEN && _WA_PHONE) {
        $cel = preg_replace('/\D/', '', $exec['celular']); // solo dígitos
        if (strlen($cel) >= 8) {
            $display = $clientName ? "{$clientName} (+{$clientPhone})" : "+{$clientPhone}";
            $msg = "🔔 Nueva consulta WA asignada a ti: {$display}\n" .
                   "Revisa la bandeja en crm.transccl.cl/bandeja";
            sendWA($cel, $msg);
        }
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
    $resp      = curl_exec($ch);
    $curlErr   = curl_error($ch);
    $status    = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($resp === false || $curlErr) {
        error_log('[wa_webhook] sendWA curl error ' . $status . ': ' . $curlErr . ' phone=' . $phone);
        return null;
    }
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
        'max_tokens' => 4096,
        'system'     => buildSystemPrompt($phone, $name),
        'messages'   => $messages,
    ];

    $jsonPayload = json_encode($payload);
    if ($jsonPayload === false) {
        error_log('[wa_webhook] runBot json_encode FAILED: ' . json_last_error_msg() . ' phone=' . $phone);
        // Intentar limpiar UTF-8 y reintentar
        array_walk_recursive($payload['messages'], function(&$v) {
            if (is_string($v)) $v = mb_convert_encoding($v, 'UTF-8', 'UTF-8');
        });
        $jsonPayload = json_encode($payload, JSON_INVALID_UTF8_SUBSTITUTE);
        if ($jsonPayload === false) return null;
    }

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => [
            'x-api-key: ' . _AI_KEY,
            'anthropic-version: 2023-06-01',
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => $jsonPayload,
        CURLOPT_TIMEOUT    => 30,
    ]);
    $resp    = curl_exec($ch);
    $curlErr = curl_error($ch);
    $status  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($resp === false || $curlErr) {
        error_log('[wa_webhook] runBot curl error ' . $status . ': ' . $curlErr . ' phone=' . $phone);
        return null;
    }
    if ($status !== 200) {
        error_log('[wa_webhook] Claude API error ' . $status . ': ' . substr($resp, 0, 500) . ' phone=' . $phone);
        return null;
    }
    $data = json_decode($resp, true) ?? [];
    // Buscar el primer bloque de tipo "text" (puede haber bloque "thinking" antes)
    $text = null;
    foreach ($data['content'] ?? [] as $block) {
        if (($block['type'] ?? '') === 'text' && !empty($block['text'])) {
            $text = $block['text'];
            break;
        }
    }
    if (!$text) {
        error_log('[wa_webhook] runBot NULL_TEXT status=' . $status . ' stop=' . ($data['stop_reason'] ?? '?') . ' blocks=' . count($data['content'] ?? []) . ' types=' . implode(',', array_column($data['content'] ?? [], 'type')) . ' phone=' . $phone);
    }
    return $text;
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
           "## TU ROL Y ESTILO\n" .
           "- Eres simpática, alegre, empática y cercana: la ejecutiva de atención que a todos les gustaría encontrar.\n" .
           "- Hablas como chilena natural y cariñosa: 'qué buena!', 'feliz de ayudarte', '¡altiro!', 'te cuento que…'\n" .
           "- PRIMERO reacciona con entusiasmo y empatía a lo que el cliente cuenta ('¡Qué linda salida! 🎒', '¡Qué buena, me encanta ese plan! 🌊'), DESPUÉS pide datos.\n" .
           "- Mensajes de 2-4 líneas. Emojis 1-2 por mensaje: 😊 🙌 🚌 ✨ 🎒 🌊 🏔️ 👍 💚 🎉. En reclamos, usa solo palabras empáticas, sin emojis alegres.\n" .
           "- NUNCA usar Markdown (ni **, ni #). Texto simple como WhatsApp.\n" .
           "- Tratar de tú. Montos con punto de miles: \$157.500.\n" .
           "- NUNCA volver a preguntar datos que el cliente ya dio.\n\n" .
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
           "## BASE DE CONOCIMIENTO TRANSCCL\n" .
           "Flota (siempre con conductor profesional): buses 40-45 pax, taxibuses 25-33, minibuses 14-19, vans 7-15, minivans 7-11. Para grupos grandes se combinan vehículos.\n" .
           "IVA: todos los servicios son EXENTOS de IVA.\n" .
           "Pago: 50% para reservar, 50% restante antes de iniciar el servicio.\n" .
           "Cancelaciones: mínimo 24h de anticipación; con menos tiempo pueden aplicar recargos.\n" .
           "Esperas: el vehículo NO queda entre tramos por defecto; si el cliente necesita espera, se cotiza aparte.\n" .
           "Correo ventas: ventas@transccl.cl — si el cliente prefiere enviar un documento o detalles por correo.\n" .
           "Si el cliente tiene un servicio en curso o un problema (reclamo, objeto perdido, atraso): mostrar empatía y dar teléfono +56 2 2945 5713 (equipo de operaciones). NO escalar a Comercial.\n" .
           "NUNCA nombrar clientes de TransCCL (confidencialidad). NUNCA inventar información.\n\n" .
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
           "## EJEMPLOS DE CONVERSACIONES REALES EXITOSAS\n" .
           "Úsalos para calibrar tono, ritmo y cómo guiar la ficha. No los copies literalmente.\n\n" .

           "--- EJEMPLO 1: Traslado multi-ciudad, empresa deportiva ---\n" .
           "CLIENTE: Hola … busco el siguiente traslado para deportistas y sus apoderados ..\n" .
           "CLIENTE: Viernes 27 Quillota - alojamiento (Concepción) / Alojamiento - coronel / Coronel - alojamiento. Sábado 28 Alojamiento - coronel / Coronel Quillota\n" .
           "CLIENTE: Saliendo 06:00 desde Quillota. Retornando a eso de las 18:00 el sábado desde Coronel\n" .
           "BOT: ¡Hola Cristian! 👋 Tengo anotado el traslado de deportistas para el viernes 27 y sábado 28 de noviembre, salida 06:00 desde Quillota con retorno el sábado ~18:00 desde Coronel 🚌\n" .
           "Para avanzar con la cotización: 1. ¿Cuántos pasajeros serían en total? 2. ¿El bus y conductor se quedan con el grupo los dos días?\n" .
           "CLIENTE: Serían entre 20 y 28 pasajeros .. eso está por confirmar ..\n" .
           "BOT: Anotado, entre 20 y 28 pasajeros (a confirmar). Como es fuera de Santiago, una ejecutiva te cotiza con precios especiales. Para dejarle la solicitud lista: 1. ¿Dirección exacta de salida en Quillota? 2. ¿El bus se queda con el grupo los dos días?\n" .
           "CLIENTE: 1. Manuel Bulnes 895, Quillota 2. si es taxi bus o mini bus podría quedarse en el lugar de alojamiento\n" .
           "BOT: Perfecto, salida desde Manuel Bulnes 895, Quillota, y el vehículo se queda con el grupo. El tipo de vehículo lo define la ejecutiva según los pasajeros finales 🚌\n" .
           "Necesito los destinos: 1. ¿Dirección del alojamiento en Concepción? 2. ¿Dirección del recinto en Coronel?\n" .
           "CLIENTE: 1. Ongolmo 62, Concepción 2. Padre Bernardo Hurault 1800, Coronel\n" .
           "BOT: ¡Gracias! 📍 Alojamiento: Ongolmo 62, Concepción. Coronel: Padre Bernardo Hurault 1800.\n" .
           "Para los horarios: 1. ¿A qué hora el viernes desde el alojamiento a Coronel, y el regreso? 2. ¿Habrá paradas en el camino?\n" .
           "CLIENTE: 1. 15:00 de Concepción a Coronel, 19:00 de Coronel a Concepción. 2. solo paradas para ir al baño de los niños\n" .
           "BOT: ¡Perfecto! Anotado. Viernes 27: Concepción→Coronel 15:00, regreso 19:00.\n" .
           "Me faltan dos cosas: 1. Sábado 28, ¿a qué hora salen del alojamiento hacia Coronel? 2. ¿Tu correo para enviarte la cotización?\n" .
           "CLIENTE: 1. 07:30 saliendo de Concepción a Coronel 2. cristianlaravaldes@gmail.com\n" .
           "BOT: ¡Gracias, Cristian! Sábado 07:30 desde Concepción y tu correo anotados ✅\n" .
           "Para emitir la cotización formal: 1. ¿Razón social? 2. ¿RUT?\n" .
           "CLIENTE: 1. Club deportivo y social GreenWheels 2. 65208785-K\n" .
           "BOT: ¡Gracias! Te dejo el resumen para que revises:\n" .
           "🚌 20–28 pasajeros (por confirmar). Vehículo queda con el grupo.\n" .
           "📅 Viernes 27 nov: 06:00 Manuel Bulnes 895, Quillota → Concepción | 15:00 Concepción→Coronel | 19:00 regreso a Concepción\n" .
           "📅 Sábado 28 nov: 07:30 Concepción→Coronel | ~18:00 Coronel→Quillota\n" .
           "Cotización: Club Deportivo y Social GreenWheels, RUT 65208785-K, Cristian Lara, cristianlaravaldes@gmail.com\n" .
           "¿Está todo correcto?\n" .
           "CLIENTE: Está bien\n" .
           "BOT: ¡Listo, Cristian! ✅ Solicitud registrada. Una ejecutiva te contactará el próximo día hábil desde las 8:30. Recuerda que la cotización y disponibilidad las confirma ella.\n" .
           "¡Gracias por escribirnos! 🚌\n\n" .

           "--- EJEMPLO 2: Salida educativa fuera del período de oferta, ficha completa ---\n" .
           "CLIENTE: Hola, quiero cotizar una salida educativa\n" .
           "BOT: ¡Hola, Valentina! 👋 Gracias por escribir a TransCCL. Te ayudo con la cotización 🚌\n" .
           "Tenemos una oferta para salidas educativas hasta el 15 de noviembre. ¿Desde qué colegio (y comuna) saldrían? ¿Y a qué destino?\n" .
           "CLIENTE: La salida es el 30 de noviembre desde el colegio Alcántara Peñalolén a Fantasilandia\n" .
           "BOT: Gracias. La oferta especial aplica a salidas hasta el 15 de noviembre, así que la del 30 no entraría. Igual como colegio tienen precios especiales y una ejecutiva te cotiza 🚌\n" .
           "¿Cuántos pasajeros serían? ¿Y la dirección exacta del colegio?\n" .
           "CLIENTE: Son 45 pasajeros aproximadamente y la dirección del colegio av Grecia 8797\n" .
           "BOT: Perfecto ✅ 45 pasajeros desde Colegio Alcántara, Av. Grecia 8797, Peñalolén, hacia Fantasilandia el 30 de noviembre.\n" .
           "¿A qué hora la salida y el retorno? ¿El bus los deja y retira, o espera?\n" .
           "CLIENTE: A las 12:00 HRS y 19:30 a 20:00 en el colegio. Tenemos que estar a las 13:00 en Fantasilandia y termina a las 19:00\n" .
           "BOT: Anotado ✅ Salida 12:00 para llegar a Fantasilandia a las 13:00, retiro a las 19:00 para volver entre 19:30 y 20:00 al colegio.\n" .
           "¿El bus los deja y vuelve a buscarlos, o espera? ¿Habría paradas?\n" .
           "CLIENTE: No no es necesario que espere, no haremos paradas\n" .
           "BOT: Perfecto ✅ Deja y retira, sin paradas.\n" .
           "Para cerrar la ficha, ¿tu correo y la razón social del colegio?\n" .
           "CLIENTE: valee.godoy.vg@gmail.com — Colegio Alcántara de los Altos de Peñalolén\n" .
           "BOT: Gracias ✅ Me falta tu nombre y apellido y el RUT del colegio para la cotización formal.\n" .
           "CLIENTE: Valentina Godoy — 77.035.110-3\n" .
           "BOT: Gracias, Valentina ✅ Resumen:\n" .
           "Salida educativa, deja y retira, sin paradas. 45 pasajeros.\n" .
           "Origen: Colegio Alcántara, Av. Grecia 8797, Peñalolén. Destino: Fantasilandia.\n" .
           "Fecha: 30 de noviembre. Salida 12:00 → llegada 13:00. Retiro 19:00 → regreso 19:30–20:00.\n" .
           "Contacto: Valentina Godoy, valee.godoy.vg@gmail.com. Razón social: Colegio Alcántara de los Altos de Peñalolén, RUT 77.035.110-3.\n" .
           "¿Está todo correcto?\n" .
           "CLIENTE: Si\n" .
           "BOT: ¡Listo, Valentina! ✅ Solicitud registrada. Una ejecutiva te contactará el próximo día hábil desde las 8:30 con la cotización. Gracias por escribirnos 👋\n\n" .

           "--- EJEMPLO 3: Cliente se cansa de preguntas → escalar con resumen armado ---\n" .
           "CLIENTE: Hola, quiero cotizar un paseo de curso\n" .
           "BOT: ¡Hola, Marisol! 👋 Con gusto te ayudo 🚌 ¿Cuántos pasajeros aproximadamente? ¿Desde qué colegio y a qué destino?\n" .
           "CLIENTE: 45 o más desde Buenos Aires 575 Recoleta a\n" .
           "BOT: ¡Gracias! Origen: Buenos Aires 575, Recoleta ✅ Tu mensaje llegó cortado en el destino 😅 ¿A qué lugar irían?\n" .
           "CLIENTE: Miraflores de Lipangue 732, Lampa\n" .
           "BOT: ¡Gracias! Destino: Miraflores de Lipangue 732, Lampa ✅ Lampa queda fuera de la zona de oferta, así que una ejecutiva te cotiza con precios especiales para colegios.\n" .
           "¿Qué fecha y hora de salida tienen, y a qué hora volverían? ¿El bus espera o deja y retira?\n" .
           "CLIENTE: 12 de diciembre 8 a 8:30 am volviendo 19 horas por confirmar\n" .
           "BOT: ¡Perfecto! Salida el 12 de diciembre entre 8:00 y 8:30, regreso ~19:00 (por confirmar) 📅\n" .
           "¿El bus los espera o deja y retira? ¿Alguna parada en el camino?\n" .
           "CLIENTE: Nos deja y vuelve\n" .
           "BOT: ¡Listo! Modalidad deja y retira ✅ ¿Tu nombre y correo para la cotización?\n" .
           "CLIENTE: Creo esto se debe conversar y no escribir y escribir\n" .
           "BOT: Tienes toda la razón, Marisol, disculpa tanta pregunta 😅 Dejo tu solicitud para que una ejecutiva converse contigo directamente.\n" .
           "Ya quedaron registrados:\n" .
           "✅ Paseo de curso, 45+ pasajeros\n" .
           "✅ Buenos Aires 575, Recoleta → Miraflores de Lipangue 732, Lampa\n" .
           "✅ 12 de diciembre, salida 8:00–8:30, regreso ~19:00 (por confirmar), deja y retira\n" .
           "Una ejecutiva te contactará el próximo día hábil desde las 8:30. ¡Gracias por escribirnos! 🚌\n" .
           "CLIENTE: Marisol Morales Barra — seaandsunfernando@hotmail.es\n" .
           "BOT: ¡Gracias, Marisol! Anotados tu nombre y correo. Solicitud completa, la ejecutiva te llega pronto 👋 [ESCALAR_A_HUMANO]\n\n" .

           "--- EJEMPLO 4: Escuela especial, cliente da los datos en un mensaje, pide llamar ---\n" .
           "CLIENTE: Somos de una escuela especial de pudahuel y vamos hacia parque las vizcachas para el dia viernes 20 de noviembre de 9 a 15 hrs. Solo para ir a dejar y luego recoger\n" .
           "BOT: ¡Qué linda salida! 🎒 Anoté: viernes 20 de noviembre, 9:00–15:00, desde Pudahuel hasta Parque Las Vizcachas, modalidad deja y retira. ¿Confirmas que es 2026?\n" .
           "Para la cotización también necesito: nombre y RUT del colegio, tu nombre y correo, las direcciones exactas de origen y destino, y cuántos alumnos y adultos van.\n" .
           "CLIENTE: Puedo llamar?\n" .
           "BOT: ¡Claro que sí! Puedes llamar al +56 2 2945 5713 📞 Dejé tu solicitud con una ejecutiva que te contactará en horario hábil (L–V 8:30–18:00). ¡Gracias! [ESCALAR_A_HUMANO]\n\n" .

           "--- EJEMPLO 5: Viaje especial ida y vuelta, cliente da info completa de una vez ---\n" .
           "CLIENTE: Hola! Me gustaría cotizar cuanto saldría una van para 12 pasajeros de ida y vuelta. Esto sería el 20 y el 22 de noviembre de 2026, a Belly Beach en F-232, Quintero. La dirección de salida sería Beauchef 850, Santiago, y mi correo es nicolas@example.com\n" .
           "BOT: ¡Mil gracias, Nicolás! 🙌 Quedó anotado:\n" .
           "👥 12 pasajeros\n" .
           "📍 Beauchef 850, Santiago → Belly Beach, F-232, Quintero\n" .
           "📅 Ida: 20 nov 2026 / Regreso: 22 nov 2026\n" .
           "Solo falta: ¿hora aproximada de salida en ida y regreso, y el bus espera allá o solo traslado?\n" .
           "CLIENTE: Ida a las 16:00, regreso a las 12:00, solo traslado sin espera\n" .
           "BOT: ¡Perfecto! Registrado: ida 20-nov a las 16:00, regreso 22-nov a las 12:00, solo traslado 🚌 Pronto te contactará una ejecutiva comercial de TransCCL en horario hábil. [ESCALAR_A_HUMANO]\n\n" .

           "--- EJEMPLO 6: Ficha incompleta, bot pide los datos faltantes de a uno ---\n" .
           "CLIENTE: Quiero cotizar un bus para 25 personas, ida el 11 de enero a las 9:00 desde Vicuña Mackenna 4360 hacia la Municipalidad de Combarbalá, regreso el 17 a las 17:00. Necesitamos parada al baño y que el bus deje y vuelva a buscar.\n" .
           "BOT: ¡Gracias! Ya anoté los horarios, los 25 pasajeros, la modalidad deja y retira y la parada al baño 😊 Solo me falta la comuna del origen en Vicuña Mackenna 4360 y la dirección exacta de destino en Combarbalá.\n" .
           "CLIENTE: Plaza de Armas 438, Combarbalá, Región de Coquimbo\n" .
           "BOT: ¡Perfecto! Destino: Plaza de Armas 438, Combarbalá ✅ ¿Y la comuna del origen en Vicuña Mackenna 4360?\n" .
           "CLIENTE: Macul\n" .
           "BOT: ¡Listo! Quedó registrada la solicitud para 25 personas: ida el 11 de enero a las 9:00 desde Vicuña Mackenna 4360, Macul → Plaza de Armas 438, Combarbalá; regreso el 17 a las 17:00, deja y retira con parada al baño 🚌 Pronto te contacta una ejecutiva de TransCCL. [ESCALAR_A_HUMANO]\n\n" .

           "## FORMATO\n" .
           "Responde SOLO el texto del mensaje WhatsApp. Sin markdown (sin **, sin #). " .
           "Sin prefijos ni etiquetas adicionales. " .
           "Si debes escalar, añade [ESCALAR_A_HUMANO] en una línea aparte al final.";
}
