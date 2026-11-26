<?php http_response_code(404); exit;
// Script: envío masivo ccl_reactivacion_formulario a 273 cerrado sin formulario
// EJECUTADO 2026-11-26. NEUTRALIZADO.
/**
 * envio_masivo_wa.php — Campaña 26-nov-2026
 * Envía ccl_reactivacion_formulario a conversaciones stage=cerrado sin lead_request
 * Acceso: ?clave=transccl2026
 */

if (($_GET['clave'] ?? '') !== 'transccl2026') { http_response_code(403); exit("403\n"); }

header('Content-Type: text/plain; charset=utf-8');
set_time_limit(600);

$_s = '/home/transccl/crm-secrets.php';
if (file_exists($_s) && !defined('META_WA_TOKEN')) require_once $_s;

$pass       = getenv('CRM_DB_PASSWORD');
$token      = defined('META_WA_TOKEN') ? META_WA_TOKEN : (getenv('META_WA_TOKEN') ?: '');
$phoneNumId = defined('META_WA_PHONE_NUMBER_ID') ? META_WA_PHONE_NUMBER_ID : '1354527324415134';

if (!$token) { echo "❌ META_WA_TOKEN no encontrado\n"; exit; }

$pdo = new PDO(
    "mysql:host=localhost;dbname=transccl_crm;charset=utf8mb4",
    'transccl_crm_user', $pass,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

// Asegurar columna reactivacion_at
try { $pdo->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN reactivacion_at DATETIME NULL"); } catch (PDOException $e) {}

// 288 contactos: cerrado, sin lead_request, últimos 30 días
$convs = $pdo->query("
    SELECT c.id, c.phone, c.contact_name
    FROM wa_cloud_conversations c
    LEFT JOIN lead_requests lr ON lr.wa_conv_phone IS NOT NULL
        AND REPLACE(lr.wa_conv_phone,'+','') = REPLACE(c.phone,'+','')
    WHERE c.stage = 'cerrado'
      AND c.last_msg_at >= NOW() - INTERVAL 30 DAY
      AND lr.id IS NULL
      AND c.reactivacion_at IS NULL
    ORDER BY c.last_msg_at DESC
    LIMIT 60
")->fetchAll();

$total = count($convs);
echo "Contactos a enviar: $total\n\n";
if ($total === 0) { echo "✅ Nada que enviar.\n"; exit; }

$ok = 0; $err = 0; $errList = [];

foreach ($convs as $i => $conv) {
    $phone  = ltrim($conv['phone'] ?? '', '+');
    $nombre = $conv['contact_name'] ?: 'Cliente';
    $nombre = preg_replace('/[\x{10000}-\x{10FFFF}]/u', '', $nombre);
    $nombre = trim($nombre) ?: 'Cliente';

    $payload = json_encode([
        'messaging_product' => 'whatsapp',
        'to'   => $phone,
        'type' => 'template',
        'template' => [
            'name'     => 'ccl_reactivacion_formulario',
            'language' => ['code' => 'es'],
            'components' => [
                [
                    'type'       => 'body',
                    'parameters' => [['type' => 'text', 'text' => $nombre]],
                ],
                [
                    'type'     => 'button',
                    'sub_type' => 'url',
                    'index'    => '0',
                    'parameters' => [['type' => 'text', 'text' => $phone]],
                ],
            ],
        ],
    ]);

    $ch = curl_init("https://graph.facebook.com/v21.0/{$phoneNumId}/messages");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ],
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($resp, true);
    $wamid = $data['messages'][0]['id'] ?? null;

    if ($wamid) {
        $pdo->prepare(
            "UPDATE wa_cloud_conversations SET reactivacion_at = NOW() WHERE id = ?"
        )->execute([$conv['id']]);

        try {
            $pdo->prepare(
                "INSERT IGNORE INTO wa_cloud_messages
                 (id, conversation_id, wamid, direction, msg_type, content, status, sender_type, created_at)
                 VALUES (UUID(), ?, ?, 'out', 'template', 'template:reactivacion', 'sent', 'bot', NOW())"
            )->execute([$conv['id'], $wamid]);
        } catch (Throwable $e) {}

        $ok++;
        echo "✅ [{$i}] {$nombre} ({$phone})\n";
    } else {
        $err++;
        $errMsg = $data['error']['message'] ?? 'Error desconocido';
        $errList[] = "{$nombre} ({$phone}): {$errMsg}";
        echo "❌ [{$i}] {$nombre} ({$phone}): {$errMsg}\n";
    }

    // 100ms entre envíos
    usleep(100000);
}

echo "\n══════════════════════════\n";
echo "✅ Enviados: $ok / $total\n";
echo "❌ Errores:  $err\n";
if ($errList) {
    echo "\nDetalle errores:\n";
    foreach ($errList as $e) echo "  - $e\n";
}
echo "\n¡Campaña 26-nov completada!\n";
