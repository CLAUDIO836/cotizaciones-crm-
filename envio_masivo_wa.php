<?php
// Script: envío masivo plantilla ccl_reactivacion_formulario a las 318 en espera
// Ejecutar UNA SOLA VEZ. Neutralizar después.

$host = 'localhost';
$db   = 'transccl_crm';
$user = 'transccl_crm_user';
$pass = getenv('CRM_DB_PASSWORD');

$_s = '/home/transccl/crm-secrets.php';
if (file_exists($_s)) require_once $_s;

$pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$token      = defined('META_WA_TOKEN') ? META_WA_TOKEN : (getenv('META_WA_TOKEN') ?: '');
$phoneNumId = '1354527324415134'; // Sofía +56 2 2914 9664

if (!$token) die("❌ META_WA_TOKEN no encontrado\n");

// Obtener las 318 conversaciones en espera (sin lead_request vinculado)
$convs = $pdo->query("
    SELECT c.id, c.phone, c.contact_name
    FROM wa_cloud_conversations c
    LEFT JOIN lead_requests lr
        ON lr.wa_conv_phone IS NOT NULL
        AND REPLACE(lr.wa_conv_phone,'+','') = REPLACE(c.phone,'+','')
    WHERE c.stage NOT IN ('ganado','perdido','spam')
      AND c.last_msg_at >= NOW() - INTERVAL 30 DAY
      AND lr.id IS NULL
    ORDER BY c.last_msg_at DESC
    LIMIT 1000
")->fetchAll(PDO::FETCH_ASSOC);

$total = count($convs);
echo "Total a enviar: $total\n\n";

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
            'components' => [[
                'type'       => 'body',
                'parameters' => [['type' => 'text', 'text' => $nombre]],
            ]],
        ],
    ]);

    $ch = curl_init("https://graph.facebook.com/v19.0/{$phoneNumId}/messages");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $token,
            'Content-Type: application/json',
        ],
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($resp, true);
    if (isset($data['messages'][0]['id'])) {
        $ok++;
        if ($i < 5 || $i % 50 === 0) echo "✅ [{$i}] {$nombre} ({$phone})\n";
    } else {
        $err++;
        $errMsg = $data['error']['message'] ?? 'Error desconocido';
        $errList[] = "{$nombre} ({$phone}): {$errMsg}";
        echo "❌ [{$i}] {$nombre} ({$phone}): {$errMsg}\n";
    }

    // Pausa cada 10 mensajes para respetar rate limits
    if (($i + 1) % 10 === 0) usleep(200000); // 200ms
}

echo "\n══════════════════════════\n";
echo "✅ Enviados: $ok / $total\n";
echo "❌ Errores:  $err\n";
if ($errList) {
    echo "\nDetalle errores:\n";
    foreach ($errList as $e) echo "  - $e\n";
}
echo "\n✅ Script completado.\n";
