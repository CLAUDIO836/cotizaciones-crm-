<?php
// Actualizar stages WA — 12 conversaciones de Jhocisbell aprobadas el 25-nov-2026
define('DB_HOST','localhost');
define('DB_NAME','transccl_crm');
define('DB_USER','transccl_crm_user');
define('DB_PASS', getenv('CRM_DB_PASSWORD'));

$pdo = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset=utf8mb4', DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);

// Helper: normalizar teléfono (quitar +, espacios, guiones)
function normPhone($p) { return preg_replace('/[^0-9]/', '', $p); }

// ── Grupo 1: cotizaciones ABIERTAS (5 del cruce original) ──────────────────
// Se buscan por nombre/empresa en lead_requests → luego por WA phone
$by_lead = [
    // [nombre_lead, empresa_lead, nuevo_stage]
    ['Elisa Alvarado',    'ABAQUS',       'cotizando'],
    ['Jorge Hoyl',        'Parques de Chile', 'cotizando'],
    ['Marcela Bernales',  'Lord Cochrane','cotizando'],
    ['Verónica Méndez',   '',             'perdido'],
    ['Valentina Pradenas','Parque Arauco','perdido'],
];

$results = [];

foreach ($by_lead as [$nombre, $empresa, $newStage]) {
    // Buscar el lead para obtener teléfono
    $q = "SELECT contacto_telefono, wa_conv_phone FROM lead_requests WHERE ";
    $params = [];
    if ($empresa) {
        $q .= "(LOWER(contacto_nombre) LIKE ? OR LOWER(empresa_nombre) LIKE ?)";
        $params = ['%' . strtolower($nombre) . '%', '%' . strtolower($empresa) . '%'];
    } else {
        $q .= "LOWER(contacto_nombre) LIKE ?";
        $params = ['%' . strtolower($nombre) . '%'];
    }
    $q .= " ORDER BY created_at DESC LIMIT 1";
    $lead = $pdo->prepare($q);
    $lead->execute($params);
    $lr = $lead->fetch();

    $phones = array_filter([
        $lr['contacto_telefono'] ?? null,
        $lr['wa_conv_phone'] ?? null,
    ]);

    $found = false;
    foreach ($phones as $ph) {
        $norm = normPhone($ph);
        if (!$norm) continue;
        // Buscar en WA por teléfono normalizado
        $wq = $pdo->prepare("SELECT id, phone, stage FROM wa_cloud_conversations WHERE REPLACE(REPLACE(phone,'+',''),' ','') = ? LIMIT 1");
        $wq->execute([$norm]);
        $wa = $wq->fetch();
        if ($wa) {
            $old = $wa['stage'];
            $pdo->prepare("UPDATE wa_cloud_conversations SET stage = ? WHERE id = ?")->execute([$newStage, $wa['id']]);
            $results[] = ['nombre' => $nombre, 'phone' => $ph, 'old_stage' => $old, 'new_stage' => $newStage, 'ok' => true];
            $found = true;
            break;
        }
    }
    if (!$found) {
        // Intentar match por nombre directo en wa_cloud_conversations
        $wq2 = $pdo->prepare("SELECT id, phone, stage FROM wa_cloud_conversations WHERE LOWER(contact_name) LIKE ? LIMIT 1");
        $wq2->execute(['%' . strtolower(explode(' ', $nombre)[0]) . '%']);
        $wa2 = $wq2->fetch();
        if ($wa2) {
            $old = $wa2['stage'];
            $pdo->prepare("UPDATE wa_cloud_conversations SET stage = ? WHERE id = ?")->execute([$newStage, $wa2['id']]);
            $results[] = ['nombre' => $nombre, 'phone' => $wa2['phone'], 'old_stage' => $old, 'new_stage' => $newStage, 'ok' => true, 'match' => 'name'];
        } else {
            $results[] = ['nombre' => $nombre, 'phone' => null, 'old_stage' => null, 'new_stage' => $newStage, 'ok' => false, 'error' => 'NO ENCONTRADO'];
        }
    }
}

// ── Grupo 2: por número directo (Jhocisbell los identificó manualmente) ────
$by_phone = [
    // [nombre, teléfono, nuevo_stage]
    ['Noemi Valdebenito',       '+56958208054', 'cotizando'],
    ['(sin nombre)',             '+56957695834', 'cotizando'],
    ['Edu Teixidó',             '+56994275696', 'cotizando'],
    ['Evelyn González Rodríguez','+56965355293', 'cotizando'],
    ['Krisbell Contreras',       '+56998567094', 'ganado'],
    ['Nicolás',                  '+56968340719', 'ganado'],
    ['Voltaire Moeller',         '+56988040543', 'ganado'],
];

foreach ($by_phone as [$nombre, $ph, $newStage]) {
    $norm = normPhone($ph);
    $wq = $pdo->prepare("SELECT id, phone, stage FROM wa_cloud_conversations WHERE REPLACE(REPLACE(phone,'+',''),' ','') = ? LIMIT 1");
    $wq->execute([$norm]);
    $wa = $wq->fetch();
    if ($wa) {
        $old = $wa['stage'];
        $pdo->prepare("UPDATE wa_cloud_conversations SET stage = ? WHERE id = ?")->execute([$newStage, $wa['id']]);
        $results[] = ['nombre' => $nombre, 'phone' => $ph, 'old_stage' => $old, 'new_stage' => $newStage, 'ok' => true];
    } else {
        $results[] = ['nombre' => $nombre, 'phone' => $ph, 'old_stage' => null, 'new_stage' => $newStage, 'ok' => false, 'error' => 'NO ENCONTRADO EN WA'];
    }
}

header('Content-Type: application/json');
echo json_encode(['total' => count($results), 'results' => $results], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
