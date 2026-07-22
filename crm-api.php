<?php
/**
 * CRM Transccl - API Backend
 * Subir a: https://transccl.cl/crm-api.php (public_html)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

// ── Config ────────────────────────────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'transccl_crm');
define('DB_USER', 'transccl_crm_user');
define('DB_PASS', 'Claudio@1978');
define('JWT_SECRET', getenv('CRM_JWT_SECRET') ?: 'crm-transccl-secret-2024-change-me');
define('SESSION_HOURS', 72);

// ── DB ────────────────────────────────────────────────────────────────────────
function db(): PDO {
    static $pdo;
    if (!$pdo) {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER, DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    }
    return $pdo;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ok($data = null)  { echo json_encode(['ok' => true, 'data' => $data]); exit; }
function err($msg, $code = 400) { http_response_code($code); echo json_encode(['error' => $msg]); exit; }
function body(): array { return json_decode(file_get_contents('php://input'), true) ?? []; }

function uuid(): string {
    $stmt = db()->query("SELECT UUID() AS u");
    return $stmt->fetch()['u'];
}

// ── JWT / Auth ────────────────────────────────────────────────────────────────
function b64url(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function b64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/'));
}

function createJWT(array $payload): string {
    $header  = b64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $pl      = b64url(json_encode($payload));
    $sig     = b64url(hash_hmac('sha256', "$header.$pl", JWT_SECRET, true));
    return "$header.$pl.$sig";
}

function verifyJWT(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $pl, $sig] = $parts;
    $expected = b64url(hash_hmac('sha256', "$header.$pl", JWT_SECRET, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(b64url_decode($pl), true);
    if (!$data || ($data['exp'] ?? 0) < time()) return null;
    return $data;
}

function getAuthUser(): ?array {
    // Apache/cPanel puede bloquear HTTP_AUTHORIZATION; buscar en múltiples fuentes
    $auth = $_SERVER['HTTP_AUTHORIZATION']
         ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
         ?? (function_exists('apache_request_headers') ? (apache_request_headers()['Authorization'] ?? '') : '')
         ?? '';
    $token = null;
    if (str_starts_with($auth, 'Bearer ')) {
        $token = substr($auth, 7);
    } elseif (!empty($_GET['token'])) {
        $token = $_GET['token'];
    } elseif (!empty($_COOKIE['crm_token'])) {
        $token = $_COOKIE['crm_token'];
    }
    if (!$token) return null;
    return verifyJWT($token);
}

function requireAuth(): array {
    $user = getAuthUser();
    if (!$user) err('Unauthorized', 401);
    return $user;
}

function requireAdmin(): array {
    $user = requireAuth();
    if ($user['role'] !== 'admin') err('Forbidden', 403);
    return $user;
}

// ── Router ────────────────────────────────────────────────────────────────────
$action = $_GET['action'] ?? '';

// ── AUTH ──────────────────────────────────────────────────────────────────────
if ($action === 'login') {
    $b = body();
    $email    = trim($b['email'] ?? '');
    $password = $b['password'] ?? '';
    if (!$email || !$password) err('Email y contraseña requeridos');

    $stmt = db()->prepare('SELECT * FROM profiles WHERE email = ? AND active = 1 LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        err('Credenciales incorrectas', 401);
    }

    $exp = time() + SESSION_HOURS * 3600;
    $payload = ['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name'], 'role' => $user['role'], 'exp' => $exp];
    $jwt = createJWT($payload);

    ok(['token' => $jwt, 'user' => ['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name'], 'role' => $user['role']]]);
}

// Google OAuth — busca o crea perfil por email (sin contraseña)
if ($action === 'google_auth') {
    $b = body();
    $email = trim($b['email'] ?? '');
    $name  = trim($b['name']  ?? '');
    if (!$email) err('Email requerido');

    // Buscar perfil existente
    $stmt = db()->prepare('SELECT * FROM profiles WHERE email = ? AND active = 1 LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user) {
        // Crear perfil con rol vendedor por defecto
        $id = uuid();
        db()->prepare('INSERT INTO profiles (id, email, name, role, password_hash, active) VALUES (?, ?, ?, ?, ?, 1)')
             ->execute([$id, $email, $name ?: $email, 'vendedor', password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT)]);
        $stmt = db()->prepare('SELECT * FROM profiles WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $user = $stmt->fetch();
    }

    $exp = time() + SESSION_HOURS * 3600;
    $payload = ['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name'], 'role' => $user['role'], 'exp' => $exp];
    $jwt = createJWT($payload);
    ok(['token' => $jwt, 'user' => ['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name'], 'role' => $user['role']]]);
}

if ($action === 'me') {
    $user = requireAuth();
    ok(['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name'], 'role' => $user['role']]);
}

if ($action === 'change_password') {
    $user = requireAuth();
    $b = body();
    $current = $b['current_password'] ?? '';
    $new     = $b['new_password'] ?? '';
    if (!$current || strlen($new) < 6) err('Datos inválidos');

    $stmt = db()->prepare('SELECT password_hash FROM profiles WHERE id = ?');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    if (!$row || !password_verify($current, $row['password_hash'])) err('Contraseña actual incorrecta');

    $hash = password_hash($new, PASSWORD_BCRYPT);
    db()->prepare('UPDATE profiles SET password_hash = ? WHERE id = ?')->execute([$hash, $user['id']]);
    ok();
}

// ── PROFILES ─────────────────────────────────────────────────────────────────
if ($action === 'profiles_list') {
    requireAuth();
    $rows = db()->query('SELECT id, email, name, role, active, created_at FROM profiles ORDER BY name')->fetchAll();
    ok($rows);
}

if ($action === 'profiles_create') {
    requireAdmin();
    $b = body();
    $email    = trim($b['email'] ?? '');
    $password = $b['password'] ?? '';
    $name     = trim($b['name'] ?? '');
    $role     = $b['role'] ?? 'vendedor';
    if (!$email || !$password || !$name) err('Datos requeridos');
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $id = uuid();
    db()->prepare('INSERT INTO profiles (id, email, name, role, password_hash) VALUES (?,?,?,?,?)')->execute([$id, $email, $name, $role, $hash]);
    $stmt = db()->prepare('SELECT id, email, name, role, active FROM profiles WHERE id = ?');
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($action === 'profiles_update') {
    $me = requireAuth();
    $b  = body();
    $id = $b['id'] ?? $me['id'];
    if ($me['role'] !== 'admin' && $id !== $me['id']) err('Forbidden', 403);
    $fields = [];
    $vals   = [];
    if (isset($b['name']))  { $fields[] = 'name = ?';  $vals[] = $b['name']; }
    if (isset($b['role']) && $me['role'] === 'admin')  { $fields[] = 'role = ?';  $vals[] = $b['role']; }
    if (isset($b['active']) && $me['role'] === 'admin') { $fields[] = 'active = ?'; $vals[] = (int)$b['active']; }
    if (isset($b['password']) && strlen($b['password']) >= 6) {
        $fields[] = 'password_hash = ?';
        $vals[]   = password_hash($b['password'], PASSWORD_BCRYPT);
    }
    if (!$fields) err('Nada que actualizar');
    $vals[] = $id;
    db()->prepare('UPDATE profiles SET ' . implode(',', $fields) . ' WHERE id = ?')->execute($vals);
    ok();
}

if ($action === 'profiles_update_password') {
    $me = requireAuth();
    $b  = body();
    $pw = $b['password'] ?? '';
    if (strlen($pw) < 6) err('Mínimo 6 caracteres');
    db()->prepare('UPDATE profiles SET password_hash = ? WHERE id = ?')->execute([password_hash($pw, PASSWORD_BCRYPT), $me['id']]);
    ok();
}

// ── COMPANIES ─────────────────────────────────────────────────────────────────
if ($action === 'companies_list') {
    requireAuth();
    ok(db()->query('SELECT * FROM companies ORDER BY name')->fetchAll());
}

if ($action === 'companies_create') {
    requireAuth();
    $b = body(); $id = uuid();
    db()->prepare('INSERT INTO companies (id,name,rut) VALUES (?,?,?)')->execute([$id, $b['name'] ?? '', $b['rut'] ?? null]);
    $stmt = db()->prepare('SELECT * FROM companies WHERE id = ?'); $stmt->execute([$id]); ok($stmt->fetch());
}

if ($action === 'companies_delete') {
    requireAuth();
    $b = body(); $id = $b['id'] ?? '';
    db()->prepare('DELETE FROM companies WHERE id = ?')->execute([$id]);
    ok();
}

// ── CLIENTS ─────────────────────────────────────────────────────────────────
if ($action === 'clients_list') {
    requireAuth();
    ok(db()->query('SELECT * FROM clients ORDER BY name')->fetchAll());
}

if ($action === 'clients_search') {
    requireAuth();
    $q = '%' . ($_GET['q'] ?? '') . '%';
    $stmt = db()->prepare('SELECT * FROM clients WHERE name LIKE ? OR rut LIKE ? ORDER BY name LIMIT 20');
    $stmt->execute([$q, $q]);
    ok($stmt->fetchAll());
}

if ($action === 'clients_get') {
    requireAuth();
    $stmt = db()->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute([$_GET['id'] ?? '']);
    ok($stmt->fetch() ?: null);
}

if ($action === 'clients_by_rut') {
    requireAuth();
    $rut = $_GET['rut'] ?? '';
    $stmt = db()->prepare("SELECT c.*, JSON_ARRAYAGG(JSON_OBJECT('id',ct.id,'name',ct.name,'email',ct.email,'phone_mobile',ct.phone_mobile,'phone_landline',ct.phone_landline,'cargo',ct.cargo)) AS contacts_json FROM clients c LEFT JOIN contacts ct ON ct.client_id = c.id WHERE REPLACE(c.rut,'.','') LIKE ? GROUP BY c.id LIMIT 1");
    $stmt->execute(['%' . str_replace('.', '', $rut) . '%']);
    $row = $stmt->fetch();
    if (!$row) { ok(null); exit; }
    $row['contacts'] = json_decode($row['contacts_json'] ?? '[]', true);
    // Filter out null contacts (when no contacts exist, JSON_ARRAYAGG returns [null])
    $row['contacts'] = array_values(array_filter($row['contacts'], fn($c) => $c && isset($c['id'])));
    unset($row['contacts_json']);
    ok($row);
}

if ($action === 'contacts_create') {
    requireAuth();
    $b = body();
    $id = uuid();
    db()->prepare('INSERT INTO contacts (id,client_id,name,email,phone_mobile,phone_landline,cargo) VALUES (?,?,?,?,?,?,?)')->execute([
        $id, $b['client_id'] ?? '', $b['name'] ?? '', $b['email'] ?? null, $b['phone_mobile'] ?? null, $b['phone_landline'] ?? null, $b['cargo'] ?? null
    ]);
    $stmt = db()->prepare('SELECT * FROM contacts WHERE id = ?');
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($action === 'clients_create') {
    requireAuth();
    $b  = body();
    $id = uuid();
    db()->prepare('INSERT INTO clients (id,name,rut,email,phone,address) VALUES (?,?,?,?,?,?)')->execute([
        $id, $b['name'] ?? '', $b['rut'] ?? null, $b['email'] ?? null, $b['phone'] ?? null, $b['address'] ?? null
    ]);
    $stmt = db()->prepare('SELECT * FROM clients WHERE id = ?');
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($action === 'clients_update') {
    requireAuth();
    $b  = body();
    $id = $b['id'] ?? '';
    if (!$id) err('id requerido');
    db()->prepare('UPDATE clients SET name=?,rut=?,email=?,phone=?,address=? WHERE id=?')->execute([
        $b['name'] ?? '', $b['rut'] ?? null, $b['email'] ?? null, $b['phone'] ?? null, $b['address'] ?? null, $id
    ]);
    ok();
}

// ── PIPELINES ─────────────────────────────────────────────────────────────────
if ($action === 'pipelines_list') {
    requireAuth();
    $active = isset($_GET['all']) ? '' : 'WHERE active = 1';
    ok(db()->query("SELECT * FROM pipelines $active ORDER BY sort_order")->fetchAll());
}

if ($action === 'pipelines_create') {
    requireAdmin();
    $b = body();
    $id = uuid();
    $sort = (int)(db()->query('SELECT COALESCE(MAX(sort_order),0)+1 AS s FROM pipelines')->fetch()['s']);
    db()->prepare('INSERT INTO pipelines (id,name,color,sort_order) VALUES (?,?,?,?)')->execute([$id, $b['name'], $b['color'] ?? '#FF6C37', $sort]);
    $stmt = db()->prepare('SELECT * FROM pipelines WHERE id = ?');
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($action === 'pipelines_update') {
    requireAdmin();
    $b  = body();
    $id = $b['id'] ?? '';
    if (!$id) err('id requerido');
    db()->prepare('UPDATE pipelines SET name=?,color=?,active=?,sort_order=? WHERE id=?')->execute([
        $b['name'], $b['color'] ?? '#FF6C37', isset($b['active']) ? (int)$b['active'] : 1, $b['sort_order'] ?? 0, $id
    ]);
    ok();
}

// ── QUOTATIONS ───────────────────────────────────────────────────────────────
if ($action === 'quotations_summary') {
    $user = requireAuth();
    $isAdmin = $user['role'] === 'admin';

    $where = ['1=1'];
    $params = [];

    if (!$isAdmin) { $where[] = 'vendedor_id = ?'; $params[] = $user['id']; }
    if (!empty($_GET['status'])) { $where[] = 'status = ?'; $params[] = $_GET['status']; }
    if (!empty($_GET['vendedor']) && $isAdmin) { $where[] = 'vendedor_id = ?'; $params[] = $_GET['vendedor']; }
    if (!empty($_GET['pipeline'])) { $where[] = 'pipeline_id = ?'; $params[] = $_GET['pipeline']; }
    if (!empty($_GET['company'])) { $where[] = 'company_id = ?'; $params[] = $_GET['company']; }
    if (!empty($_GET['year']))  { $where[] = '`year` = ?';  $params[] = (int)$_GET['year']; }
    if (!empty($_GET['month'])) { $where[] = '`month` = ?'; $params[] = (int)$_GET['month']; }
    if (!empty($_GET['start'])) { $where[] = 'issue_date >= ?'; $params[] = $_GET['start']; }
    if (!empty($_GET['q'])) {
        $where[] = '(number LIKE ? OR client_name LIKE ?)';
        $like = '%' . $_GET['q'] . '%';
        $params[] = $like; $params[] = $like;
    }

    $sql = 'SELECT * FROM quotations_summary WHERE ' . implode(' AND ', $where) . ' ORDER BY created_at DESC';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    ok($stmt->fetchAll());
}

if ($action === 'quotations_get') {
    requireAuth();
    $id = $_GET['id'] ?? '';
    $stmt = db()->prepare('
        SELECT q.*,
               c.name AS client_name, c.rut AS client_rut, c.email AS client_email,
               c.phone AS client_phone, c.address AS client_address,
               p.name AS profile_name,
               pl.name AS pipeline_name
        FROM quotations q
        LEFT JOIN clients  c  ON c.id  = q.client_id
        LEFT JOIN profiles p  ON p.id  = q.user_id
        LEFT JOIN pipelines pl ON pl.id = q.pipeline_id
        WHERE q.id = ?
    ');
    $stmt->execute([$id]);
    $q = $stmt->fetch();
    if (!$q) err('No encontrada', 404);

    $stmt2 = db()->prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order');
    $stmt2->execute([$id]);
    $q['quotation_items'] = $stmt2->fetchAll();
    $q['clients']   = ['name' => $q['client_name'], 'rut' => $q['client_rut'], 'email' => $q['client_email'], 'phone' => $q['client_phone'], 'address' => $q['client_address']];
    $q['profiles']  = ['name' => $q['profile_name']];
    $q['pipelines'] = ['name' => $q['pipeline_name']];
    ok($q);
}

if ($action === 'quotations_create') {
    $user = requireAuth();
    $b = body();
    $id = uuid();
    try {
    // Auto number
    $year = date('Y');
    $count = (int)(db()->query("SELECT COUNT(*)+1 AS n FROM quotations WHERE YEAR(created_at) = $year")->fetch()['n']);
    $number = 'COT-' . $year . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);

    // Normalizar fecha_salida y fecha_retorno (pueden venir como datetime-local "YYYY-MM-DDTHH:MM")
    $fechaSalida = $b['fecha_salida'] ?? null;
    if ($fechaSalida && str_contains($fechaSalida, 'T')) {
        [$fechaSalida, $horaSalida] = explode('T', $fechaSalida, 2);
    } else {
        $horaSalida = $b['hora_salida'] ?? null;
    }
    $fechaRetorno = $b['fecha_retorno'] ?? null;
    if ($fechaRetorno && str_contains($fechaRetorno, 'T')) {
        [$fechaRetorno, $horaRetorno] = explode('T', $fechaRetorno, 2);
    } else {
        $horaRetorno = $b['hora_retorno'] ?? null;
    }
    // fecha_destino (campo legacy del form, guardarlo en fecha_retorno si no hay fecha_retorno)
    if (!$fechaRetorno && !empty($b['fecha_destino'])) {
        $fd = $b['fecha_destino'];
        if (str_contains($fd, 'T')) {
            [$fechaRetorno, $horaRetorno] = explode('T', $fd, 2);
        } else {
            $fechaRetorno = $fd;
        }
    }

    db()->prepare('
        INSERT INTO quotations (id,number,status,etapa,company,company_id,issue_date,expiry_date,
          subtotal,tax_pct,total,notes,terms,desde,hasta,desde_lat,desde_lng,hasta_lat,hasta_lng,
          distancia_km,fecha_salida,hora_salida,fecha_retorno,hora_retorno,user_id,client_id,pipeline_id,pipedrive_deal_id,
          vehicle_type,observaciones,contact_id,descuento_pct)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ')->execute([
        $id, $number,
        $b['status'] ?? 'open', $b['etapa'] ?? 'lead',
        $b['company'] ?? 'Transccl', $b['company_id'] ?? null,
        $b['issue_date'] ?? date('Y-m-d'), $b['expiry_date'] ?? null,
        $b['subtotal'] ?? 0, $b['tax_pct'] ?? 19, $b['total'] ?? 0,
        $b['notes'] ?? null, $b['terms'] ?? null,
        $b['desde'] ?? null, $b['hasta'] ?? null,
        $b['desde_lat'] ?? null, $b['desde_lng'] ?? null,
        $b['hasta_lat'] ?? null, $b['hasta_lng'] ?? null,
        $b['distancia_km'] ?? null,
        $fechaSalida ?: null, $horaSalida ?: null,
        $fechaRetorno ?: null, $horaRetorno ?: null,
        $b['user_id'] ?: $user['id'], $b['client_id'] ?? null,
        null, $b['pipedrive_deal_id'] ?? null,
        $b['vehicle_type'] ?? null, $b['observaciones'] ?? null,
        $b['contact_id'] ?? null, $b['descuento_pct'] ?? 0,
    ]);

    // Insert items
    if (!empty($b['items']) && is_array($b['items'])) {
        $itemStmt = db()->prepare('INSERT INTO quotation_items (id,quotation_id,codigo,description,pasajeros,quantity,unit_price,subtotal,sort_order) VALUES (?,?,?,?,?,?,?,?,?)');
        foreach ($b['items'] as $i => $item) {
            $qty = $item['quantity'] ?? 1;
            $up  = $item['unit_price'] ?? 0;
            $itemStmt->execute([uuid(), $id, $item['codigo'] ?? null, $item['description'], $item['pasajeros'] ?? null, $qty, $up, $item['subtotal'] ?? $qty * $up, $item['sort_order'] ?? $i]);
        }
    }
    ok(['id' => $id, 'number' => $number]);
    } catch (Throwable $e) {
        err('DB Error: ' . $e->getMessage());
    }
}

if ($action === 'quotations_update') {
    requireAuth();
    $b = body();
    $id = $b['id'] ?? '';
    if (!$id) err('id requerido');

    // Solo actualizar campos que vienen explícitamente en el body
    $fields = [
        'number'           => 'COALESCE(?,number)',
        'status'           => '?',
        'etapa'            => '?',
        'company'          => '?',
        'company_id'       => '?',
        'issue_date'       => '?',
        'expiry_date'      => '?',
        'subtotal'         => '?',
        'tax_pct'          => '?',
        'total'            => '?',
        'notes'            => '?',
        'terms'            => '?',
        'desde'            => '?',
        'hasta'            => '?',
        'desde_lat'        => '?',
        'desde_lng'        => '?',
        'hasta_lat'        => '?',
        'hasta_lng'        => '?',
        'distancia_km'     => '?',
        'fecha_salida'     => '?',
        'hora_salida'      => '?',
        'fecha_retorno'    => '?',
        'hora_retorno'     => '?',
        'client_id'        => '?',
        'pipedrive_deal_id'=> '?',
        'vehicle_type'     => '?',
        'observaciones'    => '?',
        'contact_id'       => '?',
        'descuento_pct'    => '?',
    ];
    $setClauses = [];
    $params = [];
    foreach ($fields as $col => $expr) {
        if (array_key_exists($col, $b)) {
            $setClauses[] = "$col = " . ($col === 'number' ? 'COALESCE(?,number)' : '?');
            $params[] = $b[$col];
        }
    }
    if (empty($setClauses)) { ok(); }
    $params[] = $id;
    db()->prepare('UPDATE quotations SET ' . implode(', ', $setClauses) . ' WHERE id = ?')->execute($params);

    // Reemplazar items
    if (isset($b['items']) && is_array($b['items'])) {
        db()->prepare('DELETE FROM quotation_items WHERE quotation_id = ?')->execute([$id]);
        $itemStmt = db()->prepare('INSERT INTO quotation_items (id,quotation_id,codigo,description,pasajeros,quantity,unit_price,subtotal,sort_order) VALUES (?,?,?,?,?,?,?,?,?)');
        foreach ($b['items'] as $i => $item) {
            $qty = $item['quantity'] ?? 1;
            $up  = $item['unit_price'] ?? 0;
            $itemStmt->execute([uuid(), $id, $item['codigo'] ?? null, $item['description'], $item['pasajeros'] ?? null, $qty, $up, $item['subtotal'] ?? $qty * $up, $item['sort_order'] ?? $i]);
        }
    }
    ok();
}

if ($action === 'quotations_by_pipedrive_deal') {
    // No auth required — called from Pipedrive webhook (no user token)
    $deal_id = $_GET['deal_id'] ?? '';
    $stmt = db()->prepare('SELECT id, status FROM quotations WHERE pipedrive_deal_id = ?');
    $stmt->execute([$deal_id]);
    $row = $stmt->fetch();
    echo json_encode(['data' => $row ?: null]);
    exit;
}

if ($action === 'pipedrive_webhook') {
    // No auth — Pipedrive webhook, verificar secret
    $secret = getenv('CRM_JWT_SECRET') ?: JWT_SECRET;
    $incomingSecret = $_SERVER['HTTP_X_PIPEDRIVE_SIGNATURE'] ?? $_GET['secret'] ?? '';
    if ($incomingSecret !== $secret && $incomingSecret !== 'pd-webhook-transccl-2024') {
        http_response_code(401); echo json_encode(['error' => 'Unauthorized']); exit;
    }
    $payload = body();
    $event   = $payload['event'] ?? '';
    $current = $payload['current'] ?? $payload['data']['current'] ?? [];
    $dealId  = (string)($current['id'] ?? '');
    if (!$dealId) ok(['skipped' => 'no deal id']);

    // Buscar cotización por pipedrive_deal_id
    $stmt = db()->prepare('SELECT id, status, etapa FROM quotations WHERE pipedrive_deal_id = ? LIMIT 1');
    $stmt->execute([$dealId]);
    $quot = $stmt->fetch();
    if (!$quot) ok(['skipped' => 'quotation not found for deal ' . $dealId]);

    $updates = [];
    $params  = [];

    // Sync status: won/lost/open
    $pdStatus = $current['status'] ?? null;
    if ($pdStatus && in_array($pdStatus, ['won', 'lost', 'open'])) {
        $crmStatus = $pdStatus === 'open' ? 'open' : $pdStatus;
        if ($crmStatus !== $quot['status']) {
            $updates[] = 'status = ?';
            $params[]  = $crmStatus;
        }
    }

    if ($updates) {
        $params[] = $quot['id'];
        db()->prepare('UPDATE quotations SET ' . implode(', ', $updates) . ' WHERE id = ?')->execute($params);
    }

    ok(['updated' => $quot['id'], 'deal' => $dealId]);
}

if ($action === 'quotations_delete') {
    requireAuth();
    $b = body();
    $id = $b['id'] ?? $_GET['id'] ?? '';
    db()->prepare('DELETE FROM quotations WHERE id = ?')->execute([$id]);
    ok();
}

if ($action === 'quotations_set_status') {
    requireAuth();
    $b = body();
    db()->prepare('UPDATE quotations SET status = ? WHERE id = ?')->execute([$b['status'], $b['id']]);
    ok();
}

if ($action === 'quotations_set_etapa') {
    requireAuth();
    $b = body();
    db()->prepare('UPDATE quotations SET etapa = ? WHERE id = ?')->execute([$b['etapa'], $b['id']]);
    ok();
}

// ── ACTIVITIES ───────────────────────────────────────────────────────────────
if ($action === 'activities_list') {
    requireAuth();
    $stmt = db()->prepare('
        SELECT a.*, p.name AS user_name
        FROM quotation_activities a
        LEFT JOIN profiles p ON p.id = a.user_id
        WHERE a.quotation_id = ?
        ORDER BY a.created_at DESC
    ');
    $stmt->execute([$_GET['quotation_id'] ?? '']);
    ok($stmt->fetchAll());
}

if ($action === 'activities_create') {
    $user = requireAuth();
    $b = body();
    $id = uuid();
    db()->prepare('INSERT INTO quotation_activities (id,quotation_id,user_id,type,subject,note,due_date) VALUES (?,?,?,?,?,?,?)')->execute([
        $id, $b['quotation_id'], $b['user_id'] ?? $user['id'],
        $b['type'] ?? 'llamada', $b['subject'] ?? '', $b['note'] ?? null, $b['due_date'] ?? null,
    ]);
    $stmt = db()->prepare('SELECT a.*, p.name AS user_name FROM quotation_activities a LEFT JOIN profiles p ON p.id = a.user_id WHERE a.id = ?');
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($action === 'activities_update') {
    requireAuth();
    $b = body();
    $id = $b['id'] ?? '';
    $done = !empty($b['done']) ? 1 : 0;
    $doneAt = $done ? date('Y-m-d H:i:s') : null;
    db()->prepare('UPDATE quotation_activities SET done = ?, done_at = ? WHERE id = ?')->execute([$done, $doneAt, $id]);
    ok();
}

if ($action === 'activities_list_all') {
    $user = requireAuth();
    $isAdmin = $user['role'] === 'admin';

    $where = ['1=1'];
    $params = [];

    $filter  = $_GET['filter'] ?? 'pendientes';
    $tipo    = $_GET['tipo'] ?? '';
    $vendedor = $_GET['vendedor'] ?? '';
    $today = date('Y-m-d');

    if ($filter === 'pendientes') { $where[] = 'a.done = 0'; }
    if ($filter === 'hoy') { $where[] = 'DATE(a.due_date) = ?'; $params[] = $today; }
    if ($filter === 'vencidas') { $where[] = 'a.done = 0 AND a.due_date < ?'; $params[] = $today; }
    if ($tipo) { $where[] = 'a.type = ?'; $params[] = $tipo; }
    if ($vendedor && $isAdmin) { $where[] = 'a.user_id = ?'; $params[] = $vendedor; }
    elseif (!$isAdmin) { $where[] = 'a.user_id = ?'; $params[] = $user['id']; }

    $sql = '
        SELECT a.*, p.name AS user_name, q.number AS quotation_number, c.name AS client_name
        FROM quotation_activities a
        LEFT JOIN profiles p ON p.id = a.user_id
        LEFT JOIN quotations q ON q.id = a.quotation_id
        LEFT JOIN clients c ON c.id = q.client_id
        WHERE ' . implode(' AND ', $where) . '
        ORDER BY a.due_date ASC, a.created_at DESC
        LIMIT 200
    ';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    ok($stmt->fetchAll());
}

// ── NOTES ─────────────────────────────────────────────────────────────────────
if ($action === 'notes_list') {
    requireAuth();
    $stmt = db()->prepare('
        SELECT n.*, p.name AS user_name
        FROM quotation_notes n
        LEFT JOIN profiles p ON p.id = n.user_id
        WHERE n.quotation_id = ?
        ORDER BY n.created_at DESC
    ');
    $stmt->execute([$_GET['quotation_id'] ?? '']);
    ok($stmt->fetchAll());
}

if ($action === 'notes_create') {
    $user = requireAuth();
    $b = body();
    $id = uuid();
    db()->prepare('INSERT INTO quotation_notes (id,quotation_id,user_id,content) VALUES (?,?,?,?)')->execute([
        $id, $b['quotation_id'], $b['user_id'] ?? $user['id'], $b['content'] ?? '',
    ]);
    $stmt = db()->prepare('SELECT n.*, p.name AS user_name FROM quotation_notes n LEFT JOIN profiles p ON p.id = n.user_id WHERE n.id = ?');
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($action === 'notes_delete') {
    requireAuth();
    $b = body();
    $id = $b['id'] ?? $_GET['id'] ?? '';
    db()->prepare('DELETE FROM quotation_notes WHERE id = ?')->execute([$id]);
    ok();
}

// ── QUOTATION APPROVALS ───────────────────────────────────────────────────────
if ($action === 'approvals_by_quotation') {
    requireAuth();
    $stmt = db()->prepare('SELECT * FROM quotation_approvals WHERE quotation_id = ? ORDER BY created_at DESC LIMIT 1');
    $stmt->execute([$_GET['quotation_id'] ?? '']);
    ok($stmt->fetch() ?: null);
}

if ($action === 'approvals_create') {
    requireAuth();
    $b = body();
    $quotation_id = $b['quotation_id'] ?? '';

    // Fetch quotation data
    $stmt = db()->prepare('SELECT q.*,c.name AS cname, c.rut AS crut, p.name AS pname FROM quotations q LEFT JOIN clients c ON c.id=q.client_id LEFT JOIN profiles p ON p.id=q.user_id WHERE q.id=?');
    $stmt->execute([$quotation_id]);
    $q = $stmt->fetch();
    if (!$q) err('Cotización no encontrada', 404);

    $checkStmt = db()->prepare('SELECT id, token, response FROM quotation_approvals WHERE quotation_id = ? ORDER BY created_at DESC LIMIT 1');
    $checkStmt->execute([$quotation_id]);
    $existing = $checkStmt->fetch();
    if ($existing) ok(['already_exists' => true, 'token' => $existing['token']]);

    // Fetch items
    $itemsStmt = db()->prepare('SELECT description,quantity,unit_price,subtotal FROM quotation_items WHERE quotation_id=? ORDER BY sort_order');
    $itemsStmt->execute([$quotation_id]);
    $items = $itemsStmt->fetchAll();

    $id = uuid();
    $token = (db()->query('SELECT UUID() AS u')->fetch())['u'];
    db()->prepare('
        INSERT INTO quotation_approvals (id,token,quotation_id,client_name,client_rut,seller_name,
          desde,hasta,fecha_salida,hora_salida,fecha_retorno,hora_retorno,total,company_name,items,sent_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())
    ')->execute([
        $id, $token, $quotation_id,
        $q['cname'], $q['crut'], $q['pname'],
        $q['desde'], $q['hasta'],
        $q['fecha_salida'], $q['hora_salida'],
        $q['fecha_retorno'], $q['hora_retorno'],
        $q['total'],
        $q['company'] ?? 'Transccl SpA',
        json_encode($items),
    ]);
    ok(['id' => $id, 'token' => $token]);
}

if ($action === 'approvals_get') {
    $token = $_GET['token'] ?? '';
    $stmt = db()->prepare('
        SELECT qa.*, q.pipedrive_deal_id
        FROM quotation_approvals qa
        LEFT JOIN quotations q ON q.id = qa.quotation_id
        WHERE qa.token = ?
    ');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) err('No encontrada', 404);
    if ($row['items'] && is_string($row['items'])) {
        $row['items'] = json_decode($row['items'], true);
    }
    ok($row);
}

if ($action === 'approvals_respond') {
    $b = body();
    $token = $b['token'] ?? $_GET['token'] ?? '';
    $response = $b['response'] ?? '';
    $responded_name = $b['responded_name'] ?? '';
    $responded_rut  = $b['responded_rut'] ?? '';
    $rejection_reason = $b['rejection_reason'] ?? null;

    if (!in_array($response, ['accepted', 'rejected'])) err('response inválido');
    if (!$responded_name || !$responded_rut) err('Nombre y RUT requeridos');
    if ($response === 'rejected' && !trim($rejection_reason ?? '')) err('Motivo de rechazo requerido');

    $stmt = db()->prepare('SELECT * FROM quotation_approvals WHERE token = ?');
    $stmt->execute([$token]);
    $approval = $stmt->fetch();
    if (!$approval) err('No encontrada', 404);
    if ($approval['response']) err('Ya fue respondida', 409);

    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';

    db()->prepare('UPDATE quotation_approvals SET response=?,responded_at=NOW(),responded_name=?,responded_rut=?,responded_ip=?,responded_user_agent=?,rejection_reason=? WHERE token=?')
        ->execute([$response, $responded_name, $responded_rut, $ip, $ua, $rejection_reason, $token]);

    if ($approval['quotation_id']) {
        $status = $response === 'accepted' ? 'won' : 'lost';
        db()->prepare('UPDATE quotations SET status=? WHERE id=?')->execute([$status, $approval['quotation_id']]);
    }
    ok(['quotation_id' => $approval['quotation_id'], 'status' => $response === 'accepted' ? 'won' : 'lost']);
}

// ── APPROVAL LETTERS ─────────────────────────────────────────────────────────
if ($action === 'letters_by_quotation') {
    requireAuth();
    $stmt = db()->prepare('SELECT * FROM approval_letters WHERE quotation_id = ? ORDER BY created_at DESC LIMIT 1');
    $stmt->execute([$_GET['quotation_id'] ?? '']);
    ok($stmt->fetch() ?: null);
}

if ($action === 'letters_create') {
    requireAuth();
    $b = body();
    $quotation_id = $b['quotation_id'] ?? '';

    $stmt = db()->prepare('SELECT q.*,c.name AS cname,c.rut AS crut,c.email AS cemail,c.phone AS cphone,p.name AS pname FROM quotations q LEFT JOIN clients c ON c.id=q.client_id LEFT JOIN profiles p ON p.id=q.user_id WHERE q.id=?');
    $stmt->execute([$quotation_id]);
    $q = $stmt->fetch();
    if (!$q) err('Cotización no encontrada', 404);

    $id = uuid();
    $token = (db()->query('SELECT UUID() AS u')->fetch())['u'];
    db()->prepare('
        INSERT INTO approval_letters (id,token,quotation_id,client_name,client_rut,client_email,client_phone,
          seller_name,desde,hasta,fecha_salida,hora_salida,fecha_retorno,hora_retorno,total,company_name,sent_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())
    ')->execute([
        $id, $token, $quotation_id,
        $q['cname'], $q['crut'], $q['cemail'], $q['cphone'],
        $q['pname'], $q['desde'], $q['hasta'],
        $q['fecha_salida'], $q['hora_salida'],
        $q['fecha_retorno'], $q['hora_retorno'],
        $q['total'], $q['company'] ?? 'Transccl SpA',
    ]);
    ok(['id' => $id, 'token' => $token]);
}

if ($action === 'letters_get') {
    $token = $_GET['token'] ?? '';
    $stmt = db()->prepare('SELECT al.*, q.pipedrive_deal_id, q.number AS quotation_number FROM approval_letters al LEFT JOIN quotations q ON q.id=al.quotation_id WHERE al.token=?');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) err('No encontrada', 404);
    ok($row);
}

if ($action === 'letters_delete') {
    requireAuth();
    $b = body();
    $token = $b['token'] ?? $_GET['token'] ?? '';
    db()->prepare('DELETE FROM approval_letters WHERE token = ?')->execute([$token]);
    ok();
}

if ($action === 'letters_sign') {
    $b = body();
    $token = $b['token'] ?? $_GET['token'] ?? '';
    $signed_name = $b['signed_name'] ?? '';
    $signed_rut  = $b['signed_rut'] ?? '';
    if (!$signed_name || !$signed_rut) err('Nombre y RUT requeridos');

    $stmt = db()->prepare('SELECT * FROM approval_letters WHERE token = ?');
    $stmt->execute([$token]);
    $letter = $stmt->fetch();
    if (!$letter) err('Carta no encontrada', 404);
    if ($letter['signed_at']) err('Ya fue firmada', 409);

    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';

    db()->prepare('
        UPDATE approval_letters SET
          signed_at=NOW(), signed_name=?, signed_rut=?, signed_ip=?, signed_user_agent=?,
          billing_name=?, billing_rut=?, billing_address=?, billing_company=?, billing_glosa=?
        WHERE token=?
    ')->execute([
        $signed_name, $signed_rut, $ip, $ua,
        $b['billing_name'] ?? null, $b['billing_rut'] ?? null,
        $b['billing_address'] ?? null, $b['billing_company'] ?? null,
        $b['billing_glosa'] ?? null, $token,
    ]);
    // Return letter with updated data for PDF generation in Next.js
    $stmt2 = db()->prepare('SELECT al.*, q.pipedrive_deal_id, q.number AS quotation_number FROM approval_letters al LEFT JOIN quotations q ON q.id=al.quotation_id WHERE al.token=?');
    $stmt2->execute([$token]);
    ok($stmt2->fetch());
}

// ── LEAD REQUESTS ─────────────────────────────────────────────────────────────
if ($action === 'leads_pending_count') {
    requireAuth();
    $stmt = db()->query("SELECT COUNT(*) AS count FROM lead_requests WHERE status = 'pendiente'");
    ok($stmt->fetch());
}

if ($action === 'leads_list') {
    requireAuth();
    $stmt = db()->query('SELECT * FROM lead_requests ORDER BY created_at DESC');
    ok($stmt->fetchAll());
}

if ($action === 'leads_create') {
    $b = body();
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
    $id = uuid();
    db()->prepare('
        INSERT INTO lead_requests (id,status,target_company,tipo_servicio,empresa_nombre,empresa_rut,
          contacto_nombre,contacto_cargo,contacto_email,contacto_telefono,
          desde,hasta,pasajeros_aprox,fecha_inicio,observaciones,ip_address,user_agent)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ')->execute([
        $id, 'pendiente',
        $b['target_company'] ?? null, $b['tipo_servicio'] ?? null,
        $b['empresa_nombre'] ?? null, $b['empresa_rut'] ?? null,
        $b['contacto_nombre'] ?? null, $b['contacto_cargo'] ?? null,
        $b['contacto_email'] ?? null, $b['contacto_telefono'] ?? null,
        $b['desde'] ?? null, $b['hasta'] ?? null,
        $b['pasajeros_aprox'] ?? null, $b['fecha_inicio'] ?? null,
        $b['observaciones'] ?? null, $ip, $ua,
    ]);
    ok(['id' => $id]);
}

if ($action === 'leads_update_status') {
    requireAuth();
    $b = body();
    db()->prepare('UPDATE lead_requests SET status = ? WHERE id = ?')->execute([$b['status'], $b['id']]);
    ok();
}

// ── CONTRACTS ─────────────────────────────────────────────────────────────────
if ($action === 'contracts_list') {
    $user = requireAuth();
    $isAdmin = $user['role'] === 'admin';
    $where = ['1=1'];
    $params = [];
    if (!$isAdmin) { $where[] = 'c.user_id = ?'; $params[] = $user['id']; }
    if (!empty($_GET['status'])) { $where[] = 'c.status = ?'; $params[] = $_GET['status']; }
    $sql = '
        SELECT c.*, cl.name AS client_name, cl.rut AS client_rut, p.name AS profile_name, q.number AS quotation_number
        FROM contracts c
        LEFT JOIN clients  cl ON cl.id = c.client_id
        LEFT JOIN profiles p  ON p.id  = c.user_id
        LEFT JOIN quotations q ON q.id = c.quotation_id
        WHERE ' . implode(' AND ', $where) . '
        ORDER BY c.created_at DESC
    ';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['clients'] = ['name' => $r['client_name'], 'rut' => $r['client_rut']];
        $r['profiles'] = ['name' => $r['profile_name']];
        $r['quotations'] = ['number' => $r['quotation_number']];
    }
    ok($rows);
}

if ($action === 'contracts_get') {
    requireAuth();
    $stmt = db()->prepare('SELECT c.*, cl.name AS client_name, cl.rut AS client_rut, cl.email AS client_email, cl.phone AS client_phone, p.name AS profile_name, q.number AS quotation_number FROM contracts c LEFT JOIN clients cl ON cl.id=c.client_id LEFT JOIN profiles p ON p.id=c.user_id LEFT JOIN quotations q ON q.id=c.quotation_id WHERE c.id=?');
    $stmt->execute([$_GET['id'] ?? '']);
    $r = $stmt->fetch();
    if (!$r) err('No encontrado', 404);
    $r['clients'] = ['name' => $r['client_name'], 'rut' => $r['client_rut'], 'email' => $r['client_email'], 'phone' => $r['client_phone']];
    $r['profiles'] = ['name' => $r['profile_name']];
    $r['quotations'] = ['number' => $r['quotation_number']];
    ok($r);
}

if ($action === 'contracts_create') {
    $user = requireAuth();
    $b = body();
    $id = uuid();
    $year = date('Y');
    $count = (int)(db()->query("SELECT COUNT(*)+1 AS n FROM contracts WHERE YEAR(created_at)=$year")->fetch()['n']);
    $number = 'CONT-' . $year . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
    db()->prepare('INSERT INTO contracts (id,number,status,start_date,end_date,value,notes,user_id,client_id,quotation_id) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute([
        $id, $number, $b['status'] ?? 'active',
        $b['start_date'] ?? null, $b['end_date'] ?? null,
        $b['value'] ?? 0, $b['notes'] ?? null,
        $b['user_id'] ?? $user['id'], $b['client_id'] ?? null, $b['quotation_id'] ?? null,
    ]);
    ok(['id' => $id, 'number' => $number]);
}

if ($action === 'contracts_update') {
    requireAuth();
    $b = body();
    $id = $b['id'] ?? '';
    db()->prepare('UPDATE contracts SET status=?,start_date=?,end_date=?,value=?,notes=?,client_id=?,quotation_id=? WHERE id=?')->execute([
        $b['status'] ?? 'active', $b['start_date'] ?? null, $b['end_date'] ?? null,
        $b['value'] ?? 0, $b['notes'] ?? null, $b['client_id'] ?? null, $b['quotation_id'] ?? null, $id,
    ]);
    ok();
}

if ($action === 'contracts_update_status') {
    requireAuth();
    $b = body();
    db()->prepare('UPDATE contracts SET status=? WHERE id=?')->execute([$b['status'], $b['id']]);
    ok();
}

// ── Not found ─────────────────────────────────────────────────────────────────
err("Acción '$action' no encontrada", 404);
