<?php
/**
 * followup_cron.php — Seguimiento automático de formularios incompletos
 * Cron: cada 15 minutos  (crontab: 0,15,30,45 * * * *)
 */

$_s = '/home/transccl/crm-secrets.php';
if (file_exists($_s) && !defined('META_WA_TOKEN')) require_once $_s;

date_default_timezone_set('America/Santiago');

define('_DB_HOST',  'localhost');
define('_DB_NAME',  'transccl_crm');
define('_DB_USER',  'transccl_crm_user');
define('_DB_PASS',  getenv('CRM_DB_PASSWORD')); // REQUIERE CRM_DB_PASSWORD en env del cron (verificar crm-secrets.php en servidor)
define('_WA_TOKEN', defined('META_WA_TOKEN')           ? META_WA_TOKEN           : (getenv('WHATSAPP_TOKEN') ?: ''));
define('_WA_PHONE', defined('META_WA_PHONE_NUMBER_ID') ? META_WA_PHONE_NUMBER_ID : (getenv('WHATSAPP_PHONE_NUMBER_ID') ?: ''));
define('_FLYER_URL', 'https://www.transccl.cl/img/wa_flyer.webp');

// ── Secuencia de seguimiento ──────────────────────────────────────────────────
// Cada entrada: [min_desde_ultimo_followup (o desde link si es paso 0), tipo, contenido]
// Protecciones activas:
//   1. Solo conversaciones con last_msg_at < 23h (ventana WA abierta)
//   2. Pasos espaciados desde el ÚLTIMO followup, no desde el link original
//      → si el cron estuvo parado semanas, no dispara todos los pasos juntos
//   3. Paso 7 cierra la conversación y desactiva el bot
const SCHEDULE = [
    0 => [
        'min'  => 30,
        'type' => 'text',
        'msg'  => "¡Hola {nombre}! 😊 Notamos que aún no has completado el formulario. Tómate un minuto y lo gestionamos de inmediato 👉 https://crm.transccl.cl/form/{phone}",
    ],
    1 => [
        'min'  => 120,
        'type' => 'text',
        'msg'  => "{nombre}, en TransCCL nos dedicamos al traslado de personas con buses y minibuses a lo largo de todo Chile 🚌 Completa tu formulario acá: https://crm.transccl.cl/form/{phone}",
    ],
    2 => [
        'min'  => 240,
        'type' => 'text',
        'msg'  => "{nombre}, queremos ser tu solución de transporte 😊 Visítanos en www.transccl.cl y cuando estés listo, completa el formulario 👉 https://crm.transccl.cl/form/{phone}",
    ],
    3 => [
        'min'  => 360,
        'type' => 'text',
        'msg'  => "{nombre}, estamos atentos a tu formulario. Síguenos en redes: Instagram @transccclempresas · TikTok @transccl 📲 https://crm.transccl.cl/form/{phone}",
    ],
    4 => [
        'min'     => 480,
        'type'    => 'image',
        'url'     => _FLYER_URL,
        'caption' => "{nombre}, somos tu aliado en transporte de pasajeros 🚌 Completa tu formulario y te cotizamos de inmediato 👉 https://crm.transccl.cl/form/{phone}",
    ],
    5 => [
        'min'  => 720,
        'type' => 'text',
        'msg'  => "{nombre}, llevamos varias horas esperando tu formulario. Si aún tienes interés, complétalo cuando puedas — seguimos aquí 😊 https://crm.transccl.cl/form/{phone}",
    ],
    6 => [
        'min'  => 960,
        'type' => 'text',
        'msg'  => "{nombre}, faltan pocas horas para cerrar tu solicitud. El formulario toma 1 minuto 👉 https://crm.transccl.cl/form/{phone} · www.transccl.cl 🚌",
    ],
    7 => [
        'min'   => 1440,
        'type'  => 'text',
        'msg'   => "{nombre}, cerramos tu solicitud por ahora. Cuando necesites transporte, estaremos aquí 🚌 www.transccl.cl · ¡Hasta pronto!",
        'close' => true,
    ],
];

function pdo(): PDO {
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

function sendText(string $phone, string $text): bool {
    if (!_WA_TOKEN || !_WA_PHONE) return false;
    $payload = [
        'messaging_product' => 'whatsapp',
        'to'                => $phone,
        'type'              => 'text',
        'text'              => ['body' => $text, 'preview_url' => false],
    ];
    return waPost($payload);
}

function sendImage(string $phone, string $url, string $caption): bool {
    if (!_WA_TOKEN || !_WA_PHONE) return false;
    $img = ['link' => $url];
    if ($caption !== '') $img['caption'] = $caption;
    $payload = [
        'messaging_product' => 'whatsapp',
        'to'                => $phone,
        'type'              => 'image',
        'image'             => $img,
    ];
    return waPost($payload);
}

function waPost(array $payload): bool {
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
        error_log('[followup_cron] WA error ' . $status . ': ' . substr($resp, 0, 200));
        return false;
    }
    return true;
}

function fill(string $tpl, string $phone, ?string $nombre): string {
    $n = $nombre ? explode(' ', trim($nombre))[0] : 'amig@';
    return str_replace(['{nombre}', '{phone}'], [$n, $phone], $tpl);
}

// ── Procesar ──────────────────────────────────────────────────────────────────
try {
    // Agregar columna last_followup_at si no existe (idempotente)
    try {
        pdo()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN last_followup_at DATETIME NULL");
    } catch (PDOException $e) {}

    $rows = pdo()->prepare(
        "SELECT id, phone, contact_name, followup_count, last_followup_at,
                TIMESTAMPDIFF(MINUTE, form_link_sent_at, NOW()) AS mins_desde_link
         FROM wa_cloud_conversations
         WHERE form_link_sent_at IS NOT NULL
           AND form_submitted_at IS NULL
           AND bot_active = 1
           AND handoff_requested_at IS NULL
           AND stage NOT IN ('ganado','perdido','spam','cerrado')
           AND followup_count <= 7
           AND last_msg_at >= NOW() - INTERVAL 23 HOUR
         ORDER BY form_link_sent_at ASC
         LIMIT 50"
    );
    $rows->execute();

    foreach ($rows->fetchAll() as $row) {
        $count = (int)$row['followup_count'];

        if (!isset(SCHEDULE[$count])) continue;
        $step = SCHEDULE[$count];

        // Paso 0: esperar X min desde que se envió el link
        // Pasos 1-7: esperar X min desde el ÚLTIMO followup enviado
        //   → evita disparar pasos acumulados si el cron estuvo parado
        if ($count === 0) {
            $mins = (int)$row['mins_desde_link'];
        } else {
            $mins = $row['last_followup_at']
                ? (int)(abs(strtotime('now') - strtotime($row['last_followup_at'])) / 60)
                : (int)$row['mins_desde_link'];
        }

        if ($mins < $step['min']) continue; // aún no es tiempo

        $phone  = $row['phone'];
        $nombre = $row['contact_name'];
        $sent   = false;

        if ($step['type'] === 'text') {
            $msg  = fill($step['msg'], $phone, $nombre);
            $sent = sendText($phone, $msg);
        } elseif ($step['type'] === 'image') {
            $cap  = fill($step['caption'], $phone, $nombre);
            $sent = sendImage($phone, $step['url'], $cap);
        }

        if (!$sent) {
            error_log("[followup_cron] FAIL phone={$phone} step={$count}");
            continue;
        }

        error_log("[followup_cron] SENT phone={$phone} step={$count} mins={$mins}");

        // Actualizar contador, timestamp y cerrar si corresponde
        $updates = ['followup_count = followup_count + 1', 'last_followup_at = NOW()'];
        if (!empty($step['close'])) {
            $updates[] = 'bot_active = 0';
            $updates[] = "stage = 'cerrado'";
        }
        pdo()->prepare(
            "UPDATE wa_cloud_conversations SET " . implode(', ', $updates) . " WHERE id = ?"
        )->execute([$row['id']]);
    }
} catch (Throwable $e) {
    error_log('[followup_cron] ERROR: ' . $e->getMessage());
}
