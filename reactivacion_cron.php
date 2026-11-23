<?php
/**
 * reactivacion_cron.php — Reactivación de conversaciones WA con ventana cerrada
 * Cron: cada 2 horas  (crontab: 0 */2 * * *)
 *
 * Busca conversaciones donde:
 *  - Ventana 24h cerrada (last_msg_at < hace 24h)
 *  - Sin formulario enviado
 *  - Stage activo (no ganado/perdido/spam/cerrado)
 *  - Nunca reactivadas (reactivacion_at IS NULL)
 *  - Recientes (last_msg_at >= hace 72h, para no molestar a contactos muy viejos)
 * Envía template ccl_reactivacion_formulario y marca reactivacion_at.
 */

$_s = '/home/transccl/crm-secrets.php';
if (file_exists($_s) && !defined('META_WA_TOKEN')) require_once $_s;

date_default_timezone_set('America/Santiago');

define('_DB_HOST',  'localhost');
define('_DB_NAME',  'transccl_crm');
define('_DB_USER',  'transccl_crm_user');
define('_DB_PASS',  getenv('CRM_DB_PASSWORD'));
define('_WA_TOKEN', defined('META_WA_TOKEN')           ? META_WA_TOKEN           : (getenv('WHATSAPP_TOKEN') ?: ''));
define('_WA_PHONE', defined('META_WA_PHONE_NUMBER_ID') ? META_WA_PHONE_NUMBER_ID : (getenv('WHATSAPP_PHONE_NUMBER_ID') ?: ''));
define('_TEMPLATE', 'ccl_reactivacion_formulario');
define('_FORM_BASE', 'https://crm.transccl.cl/form/');

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

function sendTemplate(string $phone, string $nombre): bool {
    if (!_WA_TOKEN || !_WA_PHONE) return false;

    $firstName = $nombre ? explode(' ', trim($nombre))[0] : 'hola';

    $payload = [
        'messaging_product' => 'whatsapp',
        'to'                => $phone,
        'type'              => 'template',
        'template'          => [
            'name'       => _TEMPLATE,
            'language'   => ['code' => 'es'],
            'components' => [
                [
                    'type'       => 'body',
                    'parameters' => [
                        ['type' => 'text', 'text' => $firstName],
                    ],
                ],
                [
                    'type'       => 'button',
                    'sub_type'   => 'url',
                    'index'      => '0',
                    'parameters' => [
                        ['type' => 'text', 'text' => $phone],
                    ],
                ],
            ],
        ],
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
        error_log('[reactivacion_cron] WA error ' . $status . ': ' . substr($resp, 0, 300));
        return false;
    }
    return true;
}

try {
    // Agregar columna si no existe (idempotente)
    try { pdo()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN reactivacion_at DATETIME NULL"); } catch (PDOException $e) {}

    $rows = pdo()->prepare(
        "SELECT id, phone, contact_name
         FROM wa_cloud_conversations
         WHERE form_submitted_at IS NULL
           AND stage NOT IN ('ganado','perdido','spam','cerrado')
           AND last_msg_at < NOW() - INTERVAL 24 HOUR
           AND last_msg_at >= NOW() - INTERVAL 72 HOUR
           AND reactivacion_at IS NULL
         ORDER BY last_msg_at DESC
         LIMIT 50"
    );
    $rows->execute();

    $sent = 0; $fail = 0;
    foreach ($rows->fetchAll() as $row) {
        $ok = sendTemplate($row['phone'], $row['contact_name'] ?? '');

        if ($ok) {
            pdo()->prepare(
                "UPDATE wa_cloud_conversations
                 SET reactivacion_at = NOW(), last_msg_at = NOW()
                 WHERE id = ?"
            )->execute([$row['id']]);
            error_log("[reactivacion_cron] SENT phone={$row['phone']}");
            $sent++;
        } else {
            $fail++;
        }

        // Pausa mínima entre envíos para no saturar la API
        usleep(300000); // 300ms
    }

    error_log("[reactivacion_cron] FIN sent={$sent} fail={$fail}");

} catch (Throwable $e) {
    error_log('[reactivacion_cron] ERROR: ' . $e->getMessage());
}
