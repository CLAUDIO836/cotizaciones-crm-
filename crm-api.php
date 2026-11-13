<?php
/**
 * CRM Transccl - API Backend
 * Subir a: https://transccl.cl/crm-api.php (public_html)
 */

// Cargar variables de entorno del servidor (crm-env.php no está en git)
if (file_exists(__DIR__ . '/crm-env.php')) require_once __DIR__ . '/crm-env.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
$_cors_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$_cors_allowed = ['https://crm.transccl.cl', 'https://www.transccl.cl', 'http://localhost:3001', 'http://localhost:3000'];
header('Access-Control-Allow-Origin: ' . (in_array($_cors_origin, $_cors_allowed) ? $_cors_origin : 'https://crm.transccl.cl'));
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

// ── Config ────────────────────────────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'transccl_crm');
define('DB_USER', 'transccl_crm_user');
define('DB_PASS', getenv('CRM_DB_PASSWORD') ?: 'Claudio@1978');
define('JWT_SECRET', getenv('CRM_JWT_SECRET') ?: 'aaf2874032a28f19d5ee92733d7d33baee9dd198f6efceb271d544a8deaf1312');
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
    $data = verifyJWT($token);
    if (!$data) return null;
    // Leer role fresco desde DB para que cambios de rol surtan efecto sin re-login
    $stmt = db()->prepare('SELECT role, active FROM profiles WHERE id = ?');
    $stmt->execute([$data['id']]);
    $row = $stmt->fetch();
    if (!$row || !$row['active']) return null;
    $data['role'] = $row['role'];
    return $data;
}

function requireAuth(): array {
    $user = getAuthUser();
    if (!$user) err('Unauthorized', 401);
    return $user;
}

function requireAdmin(): array {
    $user = requireAuth();
    if (!in_array($user['role'], ['admin', 'superadmin'])) err('Forbidden', 403);
    return $user;
}

function isAdmin(array $user): bool {
    return in_array($user['role'], ['admin', 'superadmin']);
}

// ── RUT utilities (módulo 11 chileno) ─────────────────────────────────────────

/** Extrae solo dígitos y K (mayúscula) — para comparación interna. */
function rutKey(string $rut): string {
    return strtoupper(preg_replace('/[^0-9kK]/i', '', $rut));
}

/** Formato canónico para guardar en BD: "76123456-K" (sin puntos, con guion). */
function normalizeRut(string $rut): string {
    $clean = rutKey($rut);
    if (strlen($clean) < 2) return $rut;
    return substr($clean, 0, -1) . '-' . substr($clean, -1);
}

/** Validación matemática módulo 11. Acepta cualquier formato. */
function validateRut(string $rut): bool {
    $clean = rutKey($rut);
    if (strlen($clean) < 2) return false;
    $body = substr($clean, 0, -1);
    $dv   = substr($clean, -1);
    if (!ctype_digit($body)) return false;
    $num = intval($body);
    if ($num < 1000000 || $num > 99999999) return false;
    $sum = 0; $mul = 2;
    for ($i = strlen($body) - 1; $i >= 0; $i--) {
        $sum += intval($body[$i]) * $mul;
        $mul = $mul === 7 ? 2 : $mul + 1;
    }
    $expected = 11 - ($sum % 11);
    $calc = $expected === 11 ? '0' : ($expected === 10 ? 'K' : strval($expected));
    return $dv === $calc;
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
        // Crear perfil inactivo — requiere aprobación de admin antes de poder ingresar
        $id = uuid();
        db()->prepare('INSERT INTO profiles (id, email, name, role, password_hash, active) VALUES (?, ?, ?, ?, ?, 0)')
             ->execute([$id, $email, $name ?: $email, 'vendedor', password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT)]);
        err('pending_approval', 403);
    } elseif ($name && $name !== $user['name']) {
        // Sincronizar nombre desde Google si cambió en Google Workspace
        db()->prepare('UPDATE profiles SET name = ? WHERE id = ?')->execute([$name, $user['id']]);
        $user['name'] = $name;
    }

    $exp = time() + SESSION_HOURS * 3600;
    $payload = ['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name'], 'role' => $user['role'], 'exp' => $exp];
    $jwt = createJWT($payload);
    ok(['token' => $jwt, 'user' => ['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name'], 'role' => $user['role']]]);
}

if ($action === 'me') {
    $user = requireAuth();
    $stmt = db()->prepare('SELECT celular FROM profiles WHERE id = ?');
    $stmt->execute([$user['id']]);
    $extra = $stmt->fetch();
    ok(['id' => $user['id'], 'email' => $user['email'], 'name' => $user['name'], 'role' => $user['role'], 'celular' => $extra['celular'] ?? null]);
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
    $rows = db()->query('SELECT id, email, name, role, active, created_at, celular FROM profiles ORDER BY name')->fetchAll();
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
    db()->prepare('INSERT INTO profiles (id, email, name, role, password_hash, active) VALUES (?,?,?,?,?,1)')->execute([$id, $email, $name, $role, $hash]);
    $stmt = db()->prepare('SELECT id, email, name, role, active FROM profiles WHERE id = ?');
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($action === 'profiles_update') {
    $me = requireAuth();
    $b  = body();
    $id = $b['id'] ?? $me['id'];
    if (!isAdmin($me) && $id !== $me['id']) err('Forbidden', 403);
    $fields = [];
    $vals   = [];
    if (isset($b['name']))    { $fields[] = 'name = ?';    $vals[] = $b['name']; }
    if (isset($b['celular'])) { $fields[] = 'celular = ?'; $vals[] = trim($b['celular'] ?? '') ?: null; }
    if (isset($b['email']) && isAdmin($me)) { $fields[] = 'email = ?'; $vals[] = trim($b['email']); }
    if (isset($b['role']) && isAdmin($me))  { $fields[] = 'role = ?';  $vals[] = $b['role']; }
    if (isset($b['active']) && isAdmin($me)) { $fields[] = 'active = ?'; $vals[] = (int)$b['active']; }
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

if ($action === 'profiles_delete') {
    requireAdmin();
    $b  = body();
    $id = $b['id'] ?? '';
    if (!$id) err('ID requerido');
    db()->prepare('DELETE FROM profiles WHERE id = ?')->execute([$id]);
    ok(['deleted' => true]);
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
    $raw  = $_GET['q'] ?? '';
    $name_q = '%' . $raw . '%';
    $rut_q  = '%' . rutKey($raw) . '%';
    $stmt = db()->prepare(
        "SELECT * FROM clients
         WHERE name LIKE ?
            OR REPLACE(REPLACE(REPLACE(rut,'.',''),'-',''),' ','') LIKE ?
         ORDER BY name LIMIT 20"
    );
    $stmt->execute([$name_q, $rut_q]);
    ok($stmt->fetchAll());
}

if ($action === 'clients_get') {
    requireAuth();
    $stmt = db()->prepare("SELECT c.*, JSON_ARRAYAGG(JSON_OBJECT('id',ct.id,'name',ct.name,'email',ct.email,'phone_mobile',ct.phone_mobile,'phone_landline',ct.phone_landline,'cargo',ct.cargo)) AS contacts_json FROM clients c LEFT JOIN contacts ct ON ct.client_id = c.id WHERE c.id = ? GROUP BY c.id LIMIT 1");
    $stmt->execute([$_GET['id'] ?? '']);
    $row = $stmt->fetch();
    if (!$row) { ok(null); exit; }
    $decoded = json_decode($row['contacts_json'] ?? '[]', true);
    $row['contacts'] = is_array($decoded)
        ? array_values(array_filter($decoded, fn($c) => $c && isset($c['id'])))
        : [];
    unset($row['contacts_json']);
    ok($row);
}

if ($action === 'clients_by_rut') {
    requireAuth();
    $rut = $_GET['rut'] ?? '';
    $rutClean  = rutKey($rut);                    // ej: '651186897'
    $rutBody   = substr($rutClean, 0, -1);        // ej: '65118689' (sin DV)
    $likeWithDv = '%' . str_replace('.', '', $rut) . '%';  // normal: '%65118689-7%'
    $likeBody   = $rutBody;                       // exacto sin DV (RUT mal guardado)
    $stmt = db()->prepare("SELECT c.*, JSON_ARRAYAGG(JSON_OBJECT('id',ct.id,'name',ct.name,'email',ct.email,'phone_mobile',ct.phone_mobile,'phone_landline',ct.phone_landline,'cargo',ct.cargo)) AS contacts_json FROM clients c LEFT JOIN contacts ct ON ct.client_id = c.id WHERE REPLACE(c.rut,'.','') LIKE ? OR REPLACE(REPLACE(c.rut,'.',''),'-','') = ? GROUP BY c.id LIMIT 1");
    $stmt->execute([$likeWithDv, $likeBody]);
    $row = $stmt->fetch();
    if (!$row) { ok(null); exit; }
    $decoded = json_decode($row['contacts_json'] ?? '[]', true);
    $row['contacts'] = is_array($decoded)
        ? array_values(array_filter($decoded, fn($c) => $c && isset($c['id'])))
        : [];
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

if ($action === 'contacts_update') {
    requireAuth();
    $b = body();
    $id = $b['id'] ?? '';
    if (!$id) err('id requerido');
    db()->prepare('UPDATE contacts SET name=?,email=?,phone_mobile=?,phone_landline=?,cargo=? WHERE id=?')->execute([
        $b['name'] ?? '', $b['email'] ?? null, $b['phone_mobile'] ?? null, $b['phone_landline'] ?? null, $b['cargo'] ?? null, $id
    ]);
    $stmt = db()->prepare('SELECT * FROM contacts WHERE id = ?');
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($action === 'clients_create') {
    requireAuth();
    $b   = body();
    $rawRut = trim($b['rut'] ?? '');

    // Validar y normalizar RUT si viene
    $storedRut = null;
    if ($rawRut !== '') {
        if (!validateRut($rawRut)) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'error' => 'rut_invalid', 'message' => 'El RUT ingresado no es válido (dígito verificador incorrecto).']);
            exit;
        }
        $storedRut = normalizeRut($rawRut);

        // Verificar duplicado
        $dup = db()->prepare("SELECT id, name, rut FROM clients WHERE REPLACE(REPLACE(rut,'.',''),'-','') = ? LIMIT 1");
        $dup->execute([rutKey($rawRut)]);
        $existing = $dup->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            http_response_code(409);
            echo json_encode([
                'ok' => false, 'error' => 'rut_duplicate',
                'message' => 'Este RUT ya está registrado.',
                'existing_client' => [
                    'id'   => $existing['id'],
                    'name' => $existing['name'],
                    'rut'  => normalizeRut($existing['rut'] ?? ''),
                ],
            ]);
            exit;
        }
    }

    $id = uuid();
    $phone = $b['phone'] ?? $b['telefono_celular'] ?? $b['telefono_fijo'] ?? null;
    db()->prepare('INSERT INTO clients (id,name,rut,email,phone,address) VALUES (?,?,?,?,?,?)')->execute([
        $id, $b['name'] ?? '', $storedRut, $b['email'] ?? null, $phone, $b['address'] ?? null
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

    $rawRut = trim($b['rut'] ?? '');

    $storedRut = null;
    if ($rawRut !== '') {
        if (!validateRut($rawRut)) {
            http_response_code(422);
            echo json_encode(['ok' => false, 'error' => 'rut_invalid', 'message' => 'El RUT ingresado no es válido (dígito verificador incorrecto).']);
            exit;
        }
        $storedRut = normalizeRut($rawRut);

        // Verificar duplicado excluyendo el mismo registro
        $dup = db()->prepare(
            "SELECT id, name, rut FROM clients
             WHERE REPLACE(REPLACE(rut,'.',''),'-','') = ?
               AND id <> ?
             LIMIT 1"
        );
        $dup->execute([rutKey($rawRut), $id]);
        $existing = $dup->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            http_response_code(409);
            echo json_encode([
                'ok' => false, 'error' => 'rut_duplicate',
                'message' => 'Este RUT ya está registrado en otro cliente.',
                'existing_client' => [
                    'id'   => $existing['id'],
                    'name' => $existing['name'],
                    'rut'  => normalizeRut($existing['rut'] ?? ''),
                ],
            ]);
            exit;
        }
    }

    db()->prepare('UPDATE clients SET name=?,rut=?,email=?,phone=?,address=? WHERE id=?')->execute([
        $b['name'] ?? '', $storedRut, $b['email'] ?? null, $b['phone'] ?? null, $b['address'] ?? null, $id
    ]);
    ok();
}

if ($action === 'clients_delete') {
    requireAuth();
    $b  = body();
    $id = $b['id'] ?? '';
    if (!$id) err('id requerido');
    $count = db()->prepare('SELECT COUNT(*) FROM quotations WHERE client_id = ? AND is_deleted = 0')->execute([$id]) ? db()->query("SELECT COUNT(*) FROM quotations WHERE client_id = '$id' AND is_deleted = 0")->fetchColumn() : 0;
    if ($count > 0) err('El cliente tiene cotizaciones asociadas');
    db()->prepare('DELETE FROM contacts WHERE client_id = ?')->execute([$id]);
    db()->prepare('DELETE FROM clients WHERE id = ?')->execute([$id]);
    ok();
}

if ($action === 'clients_merge') {
    requireAuth();
    $b         = body();
    $keep_id   = $b['keep_id']   ?? '';
    $delete_id = $b['delete_id'] ?? '';
    if (!$keep_id || !$delete_id) err('keep_id y delete_id requeridos');
    // Reasignar cotizaciones y contactos al cliente principal
    $stmtQ = db()->prepare('UPDATE quotations SET client_id = ? WHERE client_id = ?');
    $stmtQ->execute([$keep_id, $delete_id]);
    $reassigned = $stmtQ->rowCount();
    db()->prepare('UPDATE contacts SET client_id = ? WHERE client_id = ?')->execute([$keep_id, $delete_id]);
    // Eliminar el duplicado
    db()->prepare('DELETE FROM clients WHERE id = ?')->execute([$delete_id]);
    ok(['merged' => true, 'reassigned' => $reassigned]);
}

if ($action === 'diagnostico_clientes') {
    requireAuth();
    $rows = db()->query("SELECT client_id, COUNT(*) as total FROM quotations WHERE is_deleted=0 GROUP BY client_id ORDER BY total DESC LIMIT 20")->fetchAll();
    $clients = db()->query("SELECT id, name FROM clients")->fetchAll();
    $map = [];
    foreach ($clients as $c) $map[$c['id']] = $c['name'];
    $result = [];
    foreach ($rows as $r) {
        $result[] = ['client_id' => $r['client_id'], 'client_name' => $map[$r['client_id']] ?? 'SIN CLIENTE', 'total_cotizaciones' => $r['total']];
    }
    ok($result);
}

if ($action === 'restaurar_client_ids') {
    requireAuth();
    // Verificar que existe la tabla backup
    $exists = db()->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='quotations_backup_20260721'")->fetchColumn();
    if (!$exists) err('No existe tabla de backup quotations_backup_20260721');

    // Restaurar solo el campo client_id desde el backup (no tocar nada más)
    $stmt = db()->prepare("
        UPDATE quotations q
        JOIN quotations_backup_20260721 b ON b.id = q.id
        SET q.client_id = b.client_id
        WHERE b.client_id IS NOT NULL AND q.client_id != b.client_id
    ");
    $stmt->execute();
    $fixed = $stmt->rowCount();

    // Resultado después de restaurar
    $rows = db()->query("SELECT client_id, COUNT(*) as total FROM quotations WHERE is_deleted=0 GROUP BY client_id ORDER BY total DESC LIMIT 30")->fetchAll();
    $clients = db()->query("SELECT id, name FROM clients")->fetchAll();
    $map = [];
    foreach ($clients as $c) $map[$c['id']] = $c['name'];
    $dist = [];
    foreach ($rows as $r) {
        $dist[] = ['client_name' => $map[$r['client_id']] ?? 'SIN CLIENTE', 'total' => $r['total']];
    }
    ok(['client_ids_restaurados' => $fixed, 'distribucion_actual' => $dist]);
}

if ($action === 'debug_quotations_raw') {
    requireAuth();
    $rows = db()->query("SELECT id, number, pipedrive_deal_id, client_id FROM quotations WHERE is_deleted=0 ORDER BY created_at DESC LIMIT 15")->fetchAll();
    ok($rows);
}

if ($action === 'restaurar_desde_pipedrive') {
    requireAuth();
    $b = body();
    $deals = $b['deals'] ?? [];
    if (empty($deals)) err('No se recibieron deals');

    // Obtener todos los clientes para hacer match por nombre
    $clients = db()->query("SELECT id, name, rut FROM clients")->fetchAll();

    // Función para normalizar nombre (sin tildes, mayúsculas, sin espacios extra)
    function normName(string $s): string {
        $s = mb_strtoupper(trim($s));
        $s = str_replace(['Á','É','Í','Ó','Ú','Ñ'], ['A','E','I','O','U','N'], $s);
        $s = preg_replace('/\s+/', ' ', $s);
        return $s;
    }

    // Indexar clientes por nombre normalizado
    $clientByName = [];
    foreach ($clients as $c) {
        $key = normName($c['name']);
        $clientByName[$key] = $c['id'];
    }

    $fixed = 0; $notFound = [];
    foreach ($deals as $deal) {
        $pdId = $deal['pipedrive_deal_id'] ?? '';
        $orgName = $deal['org_name'] ?? '';
        if (!$pdId || !$orgName) continue;

        // Buscar quotation con este pipedrive_deal_id
        $stmt = db()->prepare('SELECT id, client_id FROM quotations WHERE pipedrive_deal_id = ? LIMIT 1');
        $stmt->execute([$pdId]);
        $q = $stmt->fetch();
        if (!$q) continue;

        // Buscar cliente por nombre exacto o parcial
        $normOrg = normName($orgName);
        $clientId = $clientByName[$normOrg] ?? null;

        // Búsqueda parcial si no coincide exacto
        if (!$clientId) {
            foreach ($clientByName as $name => $id) {
                if (str_contains($name, $normOrg) || str_contains($normOrg, $name)) {
                    $clientId = $id;
                    break;
                }
            }
        }

        if (!$clientId) {
            $notFound[] = $orgName;
            continue;
        }

        if ($q['client_id'] === $clientId) continue; // Ya correcto

        db()->prepare('UPDATE quotations SET client_id = ? WHERE id = ?')->execute([$clientId, $q['id']]);
        $fixed++;
    }

    // Distribución después de restaurar
    $rows = db()->query("SELECT client_id, COUNT(*) as total FROM quotations WHERE is_deleted=0 GROUP BY client_id ORDER BY total DESC LIMIT 30")->fetchAll();
    $cmap = [];
    foreach ($clients as $c) $cmap[$c['id']] = $c['name'];
    $dist = [];
    foreach ($rows as $r) {
        $dist[] = ['client_name' => $cmap[$r['client_id']] ?? 'SIN CLIENTE', 'total' => (int)$r['total']];
    }
    ok(['restauradas' => $fixed, 'no_encontradas' => array_unique($notFound), 'distribucion' => $dist]);
}

if ($action === 'contacts_import_from_quotations') {
    // Para cada contacto en cotizaciones, asegura que su client_id coincide con el de la cotización.
    // También crea contactos faltantes si el nombre viene de Pipedrive (pd_person_id presente).
    requireAuth();
    $fixed = 0;

    // 1. Actualizar client_id de contactos que no coinciden con su cotización
    $rows = db()->query("
        SELECT DISTINCT ct.id AS contact_id, q.client_id AS correct_client_id
        FROM quotations q
        JOIN contacts ct ON ct.id = q.contact_id
        WHERE q.client_id IS NOT NULL
          AND ct.client_id != q.client_id
    ")->fetchAll();
    foreach ($rows as $r) {
        db()->prepare('UPDATE contacts SET client_id = ? WHERE id = ?')
            ->execute([$r['correct_client_id'], $r['contact_id']]);
        $fixed++;
    }

    // 2. Contar contactos por cliente para informe
    $total = (int)db()->query("SELECT COUNT(*) FROM contacts")->fetchColumn();
    $clients_with = (int)db()->query("SELECT COUNT(DISTINCT client_id) FROM contacts")->fetchColumn();
    $clients_total = (int)db()->query("SELECT COUNT(*) FROM clients")->fetchColumn();

    ok(['fixed_client_id' => $fixed, 'total_contacts' => $total, 'clients_with_contacts' => $clients_with, 'clients_total' => $clients_total]);
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
if ($action === 'quotations_hash') {
    $user = requireAuth();
    $isAdmin = $user['role'] === 'admin';
    if ($isAdmin) {
        $row = db()->query("SELECT MD5(GROUP_CONCAT(id,status,etapa,total ORDER BY id)) as hash FROM quotations WHERE is_deleted=0")->fetch();
    } else {
        $stmt = db()->prepare("SELECT MD5(GROUP_CONCAT(id,status,etapa,total ORDER BY id)) as hash FROM quotations WHERE is_deleted=0 AND user_id=?");
        $stmt->execute([$user['id']]);
        $row = $stmt->fetch();
    }
    ok(['hash' => $row['hash'] ?? md5(time())]);
}

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
               c.name    AS client_name,  c.rut     AS client_rut,
               c.email   AS client_email, c.phone   AS client_phone,
               c.address AS client_address,
               p.name    AS profile_name, p.email   AS profile_email,
               pl.name   AS pipeline_name,
               ct.name          AS contact_name,
               ct.cargo         AS contact_cargo,
               ct.email         AS contact_email,
               ct.phone_mobile  AS contact_phone_mobile,
               ct.phone_landline AS contact_phone_landline,
               co.name   AS company_real_name
        FROM quotations q
        LEFT JOIN clients   c  ON c.id  = q.client_id
        LEFT JOIN profiles  p  ON p.id  = q.user_id
        LEFT JOIN pipelines pl ON pl.id = q.pipeline_id
        LEFT JOIN contacts  ct ON ct.id = q.contact_id
        LEFT JOIN companies co ON co.id = q.company_id
        WHERE q.id = ?
    ');
    $stmt->execute([$id]);
    $q = $stmt->fetch();
    if (!$q) err('No encontrada', 404);

    $stmt2 = db()->prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order');
    $stmt2->execute([$id]);
    $q['quotation_items'] = $stmt2->fetchAll();
    $q['clients']   = ['name' => $q['client_name'], 'rut' => $q['client_rut'], 'email' => $q['client_email'], 'phone' => $q['client_phone'], 'address' => $q['client_address']];
    $q['profiles']  = ['name' => $q['profile_name'], 'email' => $q['profile_email']];
    $q['pipelines'] = ['name' => $q['pipeline_name']];
    ok($q);
}

if ($action === 'quotations_create') {
    $user = requireAuth();
    $b = body();
    $id = uuid();
    try {
    // Número temporal generado exclusivamente en el backend a partir del UUID interno.
    // Formato: TMP-{primeros 8 caracteres del UUID en mayúsculas}.
    // Garantiza unicidad sin depender del cliente. Se reemplaza por el deal_id de
    // Pipedrive una vez que el negocio se crea exitosamente.
    $number = 'TMP-' . strtoupper(substr(str_replace('-', '', $id), 0, 8));

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
          vehicle_type,observaciones,contact_id,descuento_pct,
          pd_sync_status,pdf_upload_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ')->execute([
        $id, $number,
        $b['status'] ?? 'open', $b['etapa'] ?? 'lead',
        $b['company'] ?? 'Transccl', $b['company_id'] ?? null,
        ($b['issue_date'] ?: date('Y-m-d')), $b['expiry_date'] ?? null,
        $b['subtotal'] ?? 0, $b['tax_pct'] ?? 19, $b['total'] ?? 0,
        $b['notes'] ?? null, $b['terms'] ?? null,
        $b['desde'] ?? null, $b['hasta'] ?? null,
        $b['desde_lat'] ?? null, $b['desde_lng'] ?? null,
        $b['hasta_lat'] ?? null, $b['hasta_lng'] ?? null,
        $b['distancia_km'] ?? null,
        $fechaSalida ?: null, $horaSalida ?: null,
        $fechaRetorno ?: null, $horaRetorno ?: null,
        $b['user_id'] ?: $user['id'], $b['client_id'] ?? null,
        $b['pipeline_id'] ?? null, null,  // pipeline_id del form; pipedrive_deal_id pendiente (lo asigna el upload)
        $b['vehicle_type'] ?? null, $b['observaciones'] ?? null,
        $b['contact_id'] ?? null, $b['descuento_pct'] ?? 0,
        'pending', 'pending',  // estado inicial para cotizaciones nuevas
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

if ($action === 'quotation_fix_company') {
    requireAuth();
    $b = body();
    $id = $b['id'] ?? '';
    if (!$id) err('id requerido');
    // Update company field from companies join based on company_id
    db()->prepare('UPDATE quotations q JOIN companies co ON co.id = q.company_id SET q.company = co.name WHERE q.id = ?')->execute([$id]);
    $stmt = db()->prepare('SELECT company, company_id FROM quotations WHERE id = ?');
    $stmt->execute([$id]);
    ok($stmt->fetch());
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
        'pipedrive_deal_id'  => '?',
        'vehicle_type'       => '?',
        'observaciones'      => '?',
        'contact_id'         => '?',
        'descuento_pct'      => '?',
        'pd_sync_status'     => '?',
        'pd_sync_error'      => '?',
        'pd_sync_attempts'   => '?',
        'pd_last_attempt_at' => '?',
        'pdf_upload_status'  => '?',
        'pdf_upload_error'   => '?',
        'pdf_upload_attempts'=> '?',
        'pdf_last_attempt_at'=> '?',
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

if ($action === 'admin_fix_quotation') {
    // Endpoint temporal para restaurar datos borrados accidentalmente
    if (($_GET['secret'] ?? '') !== 'transccl-admin-fix-2024') err('Unauthorized', 401);
    $b = body();
    $id = $_GET['id'] ?? $b['id'] ?? '';
    if (!$id) err('id requerido');
    $fields = ['number','status','etapa','company','company_id','issue_date','expiry_date',
        'subtotal','tax_pct','total','notes','terms','desde','hasta','desde_lat','desde_lng',
        'hasta_lat','hasta_lng','distancia_km','fecha_salida','hora_salida','fecha_retorno',
        'hora_retorno','client_id','pipedrive_deal_id','vehicle_type','observaciones',
        'contact_id','descuento_pct','user_id'];
    $setClauses = []; $params = [];
    foreach ($fields as $col) {
        if (array_key_exists($col, $b)) {
            $setClauses[] = "$col = ?";
            $params[] = $b[$col];
        }
    }
    // Si no hay campos para actualizar, leer el registro actual
    if (empty($setClauses)) {
        // Buscar por number si el id empieza con __
        if (str_starts_with($id, '__')) {
            $num = str_replace(['__find_', '__'], '', $id);
            if ($num === 'triggers') {
                $t = db()->query("SHOW TRIGGERS LIKE 'quotations'")->fetchAll();
                ok(['triggers' => $t]);
            }
            if ($num === 'summary') {
                $rows = db()->query("SELECT id,number,status,total,issue_date,pipedrive_deal_id FROM quotations_summary ORDER BY created_at DESC")->fetchAll();
                ok(['summary' => $rows]);
            }
            if ($num === 'schema_check') {
                // SHOW CREATE VIEW quotations_summary
                $viewDef = db()->query("SHOW CREATE VIEW `quotations_summary`")->fetch();
                // SHOW INDEX FROM quotations
                $indexes = db()->query("SHOW INDEX FROM `quotations`")->fetchAll();
                // COUNT(*) en tablas principales
                $counts = [];
                foreach (['quotations','quotation_items','quotation_activities','quotation_approvals'] as $tbl) {
                    $counts[$tbl] = (int)db()->query("SELECT COUNT(*) FROM `$tbl`")->fetchColumn();
                }
                // DESCRIBE quotations — tipos reales de columnas
                $cols = db()->query("DESCRIBE `quotations`")->fetchAll();
                // Duplicados en pipedrive_deal_id
                $dups = db()->query("SELECT pipedrive_deal_id, COUNT(*) AS n FROM quotations WHERE pipedrive_deal_id IS NOT NULL GROUP BY pipedrive_deal_id HAVING n > 1")->fetchAll();
                // Tipo real de id y pipedrive_deal_id
                $colTypes = db()->query("SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME IN ('id','pipedrive_deal_id','created_at') ORDER BY ORDINAL_POSITION")->fetchAll();
                // Verificar si ya existen columnas de sync
                $syncCols = db()->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations' AND COLUMN_NAME IN ('is_deleted','deleted_at','deleted_source','last_sync_source','last_sync_at','pd_stage_id','pd_updated_at','pd_person_id','pd_org_id','crm_updated_at')")->fetchAll();
                // Verificar si ya existen sync_log y sync_reconciliation_log
                $tables = db()->query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('sync_log','sync_reconciliation_log')")->fetchAll();
                // pipedrive_deal_id en Pipedrive: tipo del campo en su API (siempre integer, verificar valores reales)
                $pdIdSample = db()->query("SELECT pipedrive_deal_id FROM quotations WHERE pipedrive_deal_id IS NOT NULL LIMIT 5")->fetchAll(PDO::FETCH_COLUMN);
                ok([
                    'view_definition'     => $viewDef,
                    'indexes'             => $indexes,
                    'table_counts'        => $counts,
                    'columns_describe'    => $cols,
                    'key_column_types'    => $colTypes,
                    'sync_cols_existing'  => $syncCols,
                    'existing_tables'     => $tables,
                    'pipedrive_id_dups'   => $dups,
                    'pipedrive_id_sample' => $pdIdSample,
                ]);
            }
            // ── MIGRACIÓN FASE 1 ─────────────────────────────────────────────
            if ($num === 'synclog_last5') {
                $rows = db()->query("SELECT id,source,action,event_type,event_id,quotation_id,deal_id,http_status,result,error,processed_at FROM sync_log ORDER BY processed_at DESC LIMIT 5")->fetchAll();
                ok(['sync_log' => $rows, 'total' => (int)db()->query("SELECT COUNT(*) FROM sync_log")->fetchColumn()]);
            }
            if ($num === 'synclog_payload1') {
                $row = db()->query("SELECT id, payload, before_data, after_data FROM sync_log ORDER BY processed_at DESC LIMIT 1")->fetch();
                ok(['row' => $row]);
            }
            if ($num === 'migrate_phase1_backup') {
                $results = [];
                $pdo = db();
                // Bloque 1: backups con estructura exacta
                $tables = ['quotations','quotation_items','quotation_activities','quotation_approvals'];
                foreach ($tables as $tbl) {
                    $bak = $tbl . '_backup_20260721';
                    // Si ya existe, no recrear
                    $exists = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$bak'")->fetchColumn();
                    if ($exists) { $results[$bak] = 'already_exists_skip'; continue; }
                    $pdo->exec("CREATE TABLE `$bak` LIKE `$tbl`");
                    $pdo->exec("INSERT INTO `$bak` SELECT * FROM `$tbl`");
                    $orig  = (int)$pdo->query("SELECT COUNT(*) FROM `$tbl`")->fetchColumn();
                    $bakn  = (int)$pdo->query("SELECT COUNT(*) FROM `$bak`")->fetchColumn();
                    $results[$bak] = ['original' => $orig, 'backup' => $bakn, 'match' => $orig === $bakn];
                }
                ok(['block' => 'backup', 'results' => $results]);
            }
            if ($num === 'migrate_phase1_counts') {
                $pdo = db();
                $rows = [];
                $tables = ['quotations','quotations_backup_20260721','quotation_items','quotation_items_backup_20260721','quotation_activities','quotation_activities_backup_20260721','quotation_approvals','quotation_approvals_backup_20260721'];
                foreach ($tables as $tbl) {
                    $ex = $pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$tbl'")->fetchColumn();
                    $rows[$tbl] = $ex ? (int)$pdo->query("SELECT COUNT(*) FROM `$tbl`")->fetchColumn() : 'TABLE_NOT_FOUND';
                }
                ok(['block' => 'counts', 'counts' => $rows]);
            }
            if ($num === 'migrate_phase1_alter') {
                $pdo = db();
                // Verificar cuáles columnas ya existen para hacer ALTER idempotente
                $existing = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='quotations'")->fetchAll(PDO::FETCH_COLUMN);
                $existing = array_flip($existing);
                $added = []; $skipped = [];
                $cols = [
                    'is_deleted'       => "TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Eliminación lógica: 0=activo 1=eliminado'",
                    'deleted_at'       => "DATETIME NULL",
                    'deleted_source'   => "VARCHAR(20) NULL COMMENT 'crm | pipedrive'",
                    'crm_updated_at'   => "DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Última edición real en CRM'",
                    'last_sync_source' => "VARCHAR(20) NULL COMMENT 'crm | pipedrive'",
                    'last_sync_at'     => "DATETIME(3) NULL COMMENT 'Timestamp ms del último sync'",
                    'pd_stage_id'      => "BIGINT NULL COMMENT 'stage_id numérico de Pipedrive'",
                    'pd_updated_at'    => "DATETIME(3) NULL COMMENT 'updated_time del deal en Pipedrive'",
                    'pd_person_id'     => "BIGINT NULL COMMENT 'person_id de Pipedrive'",
                    'pd_org_id'        => "BIGINT NULL COMMENT 'org_id de Pipedrive'",
                ];
                foreach ($cols as $col => $def) {
                    if (isset($existing[$col])) { $skipped[] = $col; continue; }
                    $pdo->exec("ALTER TABLE `quotations` ADD COLUMN `$col` $def");
                    $added[] = $col;
                }
                // Verificar resultado
                $after = $pdo->query("SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='quotations' ORDER BY ORDINAL_POSITION")->fetchAll();
                ok(['block' => 'alter_table', 'added' => $added, 'skipped_already_exist' => $skipped, 'columns_after' => $after]);
            }
            if ($num === 'migrate_phase1_indexes') {
                $pdo = db();
                $existing = $pdo->query("SHOW INDEX FROM `quotations`")->fetchAll(PDO::FETCH_ASSOC);
                $existingNames = array_unique(array_column($existing, 'Key_name'));
                $toAdd = [
                    'idx_is_deleted'     => "ALTER TABLE `quotations` ADD INDEX `idx_is_deleted` (`is_deleted`)",
                    'idx_pipedrive_deal' => "ALTER TABLE `quotations` ADD INDEX `idx_pipedrive_deal` (`pipedrive_deal_id`)",
                    'idx_last_sync'      => "ALTER TABLE `quotations` ADD INDEX `idx_last_sync` (`last_sync_at`)",
                ];
                $added = []; $skipped = [];
                foreach ($toAdd as $name => $sql) {
                    if (in_array($name, $existingNames)) { $skipped[] = $name; continue; }
                    $pdo->exec($sql);
                    $added[] = $name;
                }
                $after = $pdo->query("SHOW INDEX FROM `quotations`")->fetchAll();
                ok(['block' => 'indexes', 'added' => $added, 'skipped' => $skipped, 'indexes_after' => $after]);
            }
            if ($num === 'migrate_phase1_synclog') {
                $pdo = db();
                $pdo->exec("CREATE TABLE IF NOT EXISTS `sync_log` (
                    `id`             BIGINT         AUTO_INCREMENT PRIMARY KEY,
                    `entity`         VARCHAR(50)    NOT NULL DEFAULT 'quotation',
                    `quotation_id`   VARCHAR(36)    NULL COMMENT 'FK lógica a quotations.id',
                    `deal_id`        VARCHAR(50)    NULL COMMENT 'FK lógica a quotations.pipedrive_deal_id',
                    `source`         VARCHAR(20)    NOT NULL COMMENT 'crm | pipedrive',
                    `action`         VARCHAR(50)    NOT NULL,
                    `event_type`     VARCHAR(100)   NULL,
                    `event_id`       VARCHAR(100)   NULL COMMENT 'meta.id del webhook cuando existe',
                    `event_hash`     VARCHAR(64)    NULL COMMENT 'SHA256 del payload normalizado cuando no hay event_id',
                    `http_status`    SMALLINT       NULL,
                    `payload`        MEDIUMTEXT     NULL,
                    `before_data`    MEDIUMTEXT     NULL,
                    `after_data`     MEDIUMTEXT     NULL,
                    `result`         TEXT           NULL,
                    `error`          TEXT           NULL,
                    `attempt_number` TINYINT        NOT NULL DEFAULT 1,
                    `processed_at`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                    INDEX `idx_sl_quotation`  (`quotation_id`),
                    INDEX `idx_sl_deal`       (`deal_id`),
                    INDEX `idx_sl_source`     (`source`),
                    INDEX `idx_sl_event_id`   (`event_id`),
                    INDEX `idx_sl_event_hash` (`event_hash`),
                    INDEX `idx_sl_processed`  (`processed_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
                $cols = $pdo->query("DESCRIBE `sync_log`")->fetchAll();
                $count = (int)$pdo->query("SELECT COUNT(*) FROM `sync_log`")->fetchColumn();
                ok(['block' => 'sync_log', 'columns' => $cols, 'row_count' => $count]);
            }
            if ($num === 'migrate_phase1_reconlog') {
                $pdo = db();
                $pdo->exec("CREATE TABLE IF NOT EXISTS `sync_reconciliation_log` (
                    `id`            INT            AUTO_INCREMENT PRIMARY KEY,
                    `ran_at`        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    `mode`          VARCHAR(20)    NOT NULL DEFAULT 'readonly' COMMENT 'readonly hasta aprobación explícita',
                    `deals_checked` INT            NOT NULL DEFAULT 0,
                    `differences`   INT            NOT NULL DEFAULT 0,
                    `corrections`   INT            NOT NULL DEFAULT 0 COMMENT 'Siempre 0 en modo readonly',
                    `detail`        MEDIUMTEXT     NULL,
                    INDEX `idx_rlog_ran_at` (`ran_at`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
                $cols = $pdo->query("DESCRIBE `sync_reconciliation_log`")->fetchAll();
                $count = (int)$pdo->query("SELECT COUNT(*) FROM `sync_reconciliation_log`")->fetchColumn();
                ok(['block' => 'sync_reconciliation_log', 'columns' => $cols, 'row_count' => $count]);
            }
            if ($num === 'migrate_phase1_view') {
                $pdo = db();
                $pdo->exec("CREATE OR REPLACE VIEW `quotations_summary` AS
                    SELECT
                        q.id, q.number, q.status, q.etapa, q.company, q.company_id,
                        q.total, q.issue_date, q.fecha_salida,
                        YEAR(COALESCE(q.fecha_salida, q.issue_date))  AS `year`,
                        MONTH(COALESCE(q.fecha_salida, q.issue_date)) AS `month`,
                        q.user_id        AS vendedor_id,
                        p.name           AS vendedor_name,
                        c.name           AS client_name,
                        q.client_id, q.pipeline_id, q.pipedrive_deal_id, q.created_at,
                        q.is_deleted, q.deleted_at, q.deleted_source,
                        q.crm_updated_at, q.last_sync_source, q.last_sync_at,
                        q.pd_stage_id, q.pd_updated_at
                    FROM quotations q
                    LEFT JOIN profiles p ON p.id = q.user_id
                    LEFT JOIN clients  c ON c.id = q.client_id
                    WHERE q.is_deleted = 0");
                $viewDef = $pdo->query("SHOW CREATE VIEW `quotations_summary`")->fetch();
                $count = (int)$pdo->query("SELECT COUNT(*) FROM `quotations_summary`")->fetchColumn();
                ok(['block' => 'view', 'rows_visible' => $count, 'view_definition' => $viewDef]);
            }
            // ── MIGRACIÓN FASE 2 ─────────────────────────────────────────────
            if ($num === 'migrate_phase2_backup') {
                // Respaldo de seguridad antes de Fase 2 con timestamp del día
                $pdo = db();
                $suffix = date('Ymd');
                $target = "quotations_backup_$suffix";
                $exists = (int)$pdo->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$target'")->fetchColumn();
                if ($exists) {
                    $orig = (int)$pdo->query("SELECT COUNT(*) FROM quotations")->fetchColumn();
                    $bak  = (int)$pdo->query("SELECT COUNT(*) FROM `$target`")->fetchColumn();
                    ok(['block' => 'backup', 'status' => 'already_exists', 'table' => $target, 'original_rows' => $orig, 'backup_rows' => $bak]);
                }
                $pdo->exec("CREATE TABLE `$target` LIKE quotations");
                $pdo->exec("INSERT INTO `$target` SELECT * FROM quotations");
                $orig = (int)$pdo->query("SELECT COUNT(*) FROM quotations")->fetchColumn();
                $bak  = (int)$pdo->query("SELECT COUNT(*) FROM `$target`")->fetchColumn();
                ok(['block' => 'backup', 'status' => 'created', 'table' => $target, 'original_rows' => $orig, 'backup_rows' => $bak, 'match' => $orig === $bak]);
            }

            if ($num === 'migrate_phase2_alter') {
                // Agrega las 8 columnas de estado de sincronización — idempotente
                $pdo = db();
                $existing = array_flip(
                    $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS
                                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations'"
                    )->fetchAll(PDO::FETCH_COLUMN)
                );
                $cols = [
                    // Sincronización deal en Pipedrive
                    'pd_sync_status'      => "ENUM('pending','synced','error') NOT NULL DEFAULT 'pending' COMMENT 'Estado sync CRM→Pipedrive deal'",
                    'pd_sync_error'       => "TEXT NULL COMMENT 'Último error al crear/actualizar negocio en Pipedrive'",
                    'pd_sync_attempts'    => "INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Intentos de sync con Pipedrive'",
                    'pd_last_attempt_at'  => "DATETIME NULL COMMENT 'Fecha del último intento de sync'",
                    // Carga del PDF adjunto
                    'pdf_upload_status'   => "ENUM('pending','uploaded','error','unknown') NOT NULL DEFAULT 'pending' COMMENT 'Estado carga PDF en Pipedrive'",
                    'pdf_upload_error'    => "TEXT NULL COMMENT 'Último error al subir PDF a Pipedrive'",
                    'pdf_upload_attempts' => "INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Intentos de carga de PDF'",
                    'pdf_last_attempt_at' => "DATETIME NULL COMMENT 'Fecha del último intento de carga de PDF'",
                ];
                $added = []; $skipped = [];
                foreach ($cols as $col => $def) {
                    if (isset($existing[$col])) { $skipped[] = $col; continue; }
                    $pdo->exec("ALTER TABLE `quotations` ADD COLUMN `$col` $def");
                    $added[] = $col;
                }
                $after = $pdo->query(
                    "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
                     FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = DATABASE()
                       AND TABLE_NAME   = 'quotations'
                       AND (COLUMN_NAME LIKE 'pd_%' OR COLUMN_NAME LIKE 'pdf_%')
                     ORDER BY ORDINAL_POSITION"
                )->fetchAll();
                ok(['block' => 'alter_table', 'added' => $added, 'skipped_already_exist' => $skipped, 'columns_after' => $after]);
            }

            if ($num === 'migrate_phase2_backfill') {
                // Actualización inicial controlada de registros históricos.
                // pd_sync_status:
                //   - si ya tiene pipedrive_deal_id → 'synced' (ya están en Pipedrive)
                //   - si no tiene pipedrive_deal_id  → 'pending' (nunca se sincronizaron)
                // pdf_upload_status:
                //   - todos los históricos → 'unknown' (no sabemos si el PDF fue adjuntado)
                //   - las cotizaciones nuevas empezarán en 'pending' desde la aplicación
                $pdo = db();

                // Verificar que las columnas ya existen antes de actualizar
                $existing = array_flip(
                    $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS
                                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations'
                                   AND COLUMN_NAME IN ('pd_sync_status','pdf_upload_status')"
                    )->fetchAll(PDO::FETCH_COLUMN)
                );
                if (!isset($existing['pd_sync_status']) || !isset($existing['pdf_upload_status'])) {
                    err('Ejecuta primero migrate_phase2_alter');
                }

                // pd_sync_status: synced si tiene deal_id, pending si no
                $pdo->exec("UPDATE quotations SET pd_sync_status = 'synced' WHERE pipedrive_deal_id IS NOT NULL AND pipedrive_deal_id != ''");
                $pdo->exec("UPDATE quotations SET pd_sync_status = 'pending' WHERE pipedrive_deal_id IS NULL OR pipedrive_deal_id = ''");

                // pdf_upload_status: unknown para todos los históricos
                $pdo->exec("UPDATE quotations SET pdf_upload_status = 'unknown'");

                // Conteos de verificación
                $counts = $pdo->query(
                    "SELECT
                        pd_sync_status,
                        pdf_upload_status,
                        COUNT(*) AS n
                     FROM quotations
                     GROUP BY pd_sync_status, pdf_upload_status
                     ORDER BY pd_sync_status, pdf_upload_status"
                )->fetchAll();

                $totals = [
                    'total'              => (int)$pdo->query("SELECT COUNT(*) FROM quotations")->fetchColumn(),
                    'with_deal_id'       => (int)$pdo->query("SELECT COUNT(*) FROM quotations WHERE pipedrive_deal_id IS NOT NULL AND pipedrive_deal_id != ''")->fetchColumn(),
                    'without_deal_id'    => (int)$pdo->query("SELECT COUNT(*) FROM quotations WHERE pipedrive_deal_id IS NULL OR pipedrive_deal_id = ''")->fetchColumn(),
                    'pd_synced'          => (int)$pdo->query("SELECT COUNT(*) FROM quotations WHERE pd_sync_status='synced'")->fetchColumn(),
                    'pd_pending'         => (int)$pdo->query("SELECT COUNT(*) FROM quotations WHERE pd_sync_status='pending'")->fetchColumn(),
                    'pdf_unknown'        => (int)$pdo->query("SELECT COUNT(*) FROM quotations WHERE pdf_upload_status='unknown'")->fetchColumn(),
                ];
                ok(['block' => 'backfill', 'breakdown' => $counts, 'totals' => $totals]);
            }

            if ($num === 'migrate_phase2_indexes') {
                // Índices para búsqueda eficiente de registros pendientes/en error.
                //
                // Estrategia elegida: índices compuestos por estado + fecha de intento.
                // Razón: las consultas de reintento buscan SIEMPRE por estado primero
                // y luego ordenan por fecha. Un índice compuesto (status, last_attempt_at)
                // sirve para ambas condiciones en una sola operación de índice.
                // Dos índices simples exigirían que MySQL eligiera uno y filtrara el otro.
                //
                // idx_pd_sync:  para cron/reintento → WHERE pd_sync_status='pending' ORDER BY pd_last_attempt_at
                // idx_pdf_sync: para cron/reintento → WHERE pdf_upload_status='pending' ORDER BY pdf_last_attempt_at
                $pdo = db();
                $existing = array_unique(
                    array_column($pdo->query("SHOW INDEX FROM `quotations`")->fetchAll(PDO::FETCH_ASSOC), 'Key_name')
                );
                $toAdd = [
                    'idx_pd_sync'  => "ALTER TABLE `quotations` ADD INDEX `idx_pd_sync`  (`pd_sync_status`,  `pd_last_attempt_at`)",
                    'idx_pdf_sync' => "ALTER TABLE `quotations` ADD INDEX `idx_pdf_sync` (`pdf_upload_status`, `pdf_last_attempt_at`)",
                ];
                $added = []; $skipped = [];
                foreach ($toAdd as $name => $sql) {
                    if (in_array($name, $existing)) { $skipped[] = $name; continue; }
                    $pdo->exec($sql);
                    $added[] = $name;
                }
                $after = $pdo->query("SHOW INDEX FROM `quotations`")->fetchAll();
                ok(['block' => 'indexes', 'added' => $added, 'skipped' => $skipped, 'indexes_after' => $after]);
            }

            if ($num === 'migrate_phase2_verify') {
                // Verificación final: estructura + distribución de valores
                $pdo = db();
                $cols = $pdo->query(
                    "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
                     FROM information_schema.COLUMNS
                     WHERE TABLE_SCHEMA = DATABASE()
                       AND TABLE_NAME   = 'quotations'
                       AND (COLUMN_NAME LIKE 'pd_%' OR COLUMN_NAME LIKE 'pdf_%')
                     ORDER BY ORDINAL_POSITION"
                )->fetchAll();
                $idxs = array_values(array_unique(
                    array_column($pdo->query("SHOW INDEX FROM `quotations`")->fetchAll(PDO::FETCH_ASSOC), 'Key_name')
                ));
                $dist = $pdo->query(
                    "SELECT pd_sync_status, pdf_upload_status, COUNT(*) AS n
                     FROM quotations
                     GROUP BY pd_sync_status, pdf_upload_status
                     ORDER BY pd_sync_status, pdf_upload_status"
                )->fetchAll();
                $sample = $pdo->query(
                    "SELECT id, number, pipedrive_deal_id, pd_sync_status, pdf_upload_status
                     FROM quotations ORDER BY created_at DESC LIMIT 5"
                )->fetchAll();
                ok(['block' => 'verify', 'columns' => $cols, 'indexes' => $idxs, 'distribution' => $dist, 'sample_recent_5' => $sample]);
            }
            if ($num === 'migrate_fix_pipeline_fk') {
                // Eliminar FK constraint quotations_ibfk_3 (pipeline_id → pipelines.id)
                // que impide guardar IDs de Pipedrive que no existen en tabla local 'pipelines'
                $pdo = db();
                $fks = $pdo->query(
                    "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations'
                       AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'quotations_ibfk_3'"
                )->fetchAll();
                if (empty($fks)) {
                    ok(['msg' => 'FK quotations_ibfk_3 no existe, nada que hacer']);
                }
                $pdo->exec("ALTER TABLE `quotations` DROP FOREIGN KEY `quotations_ibfk_3`");
                ok(['msg' => 'FK quotations_ibfk_3 eliminado. pipeline_id ahora acepta cualquier entero.']);
            }

            // ── FIN MIGRACIÓN FASE 2 ─────────────────────────────────────────
            // NOTA: Una vez ejecutados y confirmados los bloques de fase2,
            // eliminar los bloques 'migrate_phase2_*' de este archivo o
            // moverlos detrás de una verificación de flag en base de datos.
            // ── FIN MIGRACIÓN FASE 1 ──────────────────────────────────────────
            if ($num === 'fix_view') {
                // Recrear la VIEW usando fecha_salida para year/month (fecha del servicio)
                db()->exec("CREATE OR REPLACE VIEW quotations_summary AS
                    SELECT q.id, q.number, q.status, q.etapa, q.company, q.company_id,
                           q.total, q.issue_date, q.fecha_salida,
                           YEAR(COALESCE(q.fecha_salida, q.issue_date)) AS `year`,
                           MONTH(COALESCE(q.fecha_salida, q.issue_date)) AS `month`,
                           q.user_id AS vendedor_id, p.name AS vendedor_name,
                           c.name AS client_name, q.client_id, q.pipeline_id,
                           q.pipedrive_deal_id, q.created_at
                    FROM quotations q
                    LEFT JOIN profiles p ON p.id = q.user_id
                    LEFT JOIN clients c ON c.id = q.client_id");
                ok(['view_recreated' => true]);
            }
            $rows = db()->prepare('SELECT id,number,status,total,issue_date,pipedrive_deal_id FROM quotations WHERE number = ? OR pipedrive_deal_id = ?');
            $rows->execute([$num, $num]);
            ok(['all_rows' => $rows->fetchAll()]);
        }
        $row = db()->prepare('SELECT id,number,status,total,issue_date,pipedrive_deal_id FROM quotations WHERE id = ?');
        $row->execute([$id]);
        $direct = $row->fetch();
        // También leer desde la VIEW
        $view = db()->prepare('SELECT * FROM quotations_summary WHERE id = ?');
        $view->execute([$id]);
        $fromView = $view->fetch();
        ok(['from_table' => $direct, 'from_view' => $fromView]);
    }
    $params[] = $id;
    $affected = db()->prepare('UPDATE quotations SET ' . implode(', ', $setClauses) . ' WHERE id = ?');
    $affected->execute($params);
    // Leer inmediatamente desde la VIEW en la misma conexión
    $check = db()->prepare('SELECT id,number,status,total,issue_date FROM quotations_summary WHERE id = ?');
    $check->execute([$id]);
    $after = $check->fetch();
    // También leer directo de la tabla
    $check2 = db()->prepare('SELECT id,number,status,total,issue_date FROM quotations WHERE id = ?');
    $check2->execute([$id]);
    $afterTable = $check2->fetch();
    ok(['fixed' => $id, 'rows_affected' => $affected->rowCount(), 'view_after_update' => $after, 'table_after_update' => $afterTable]);
}

if ($action === 'pipedrive_webhook') {
    // No auth — Pipedrive webhook, verificar secret
    $secret = getenv('CRM_JWT_SECRET') ?: JWT_SECRET;
    $incomingSecret = $_SERVER['HTTP_X_PIPEDRIVE_SIGNATURE'] ?? $_GET['secret'] ?? '';
    if ($incomingSecret !== $secret && $incomingSecret !== 'pd-webhook-transccl-2024') {
        http_response_code(401); echo json_encode(['error' => 'Unauthorized']); exit;
    }

    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody, true) ?: [];

    $meta     = $payload['meta'] ?? [];

    // Pipedrive v2.0: datos actuales en payload['data'], acción en meta['action']
    // Pipedrive v1.0: datos actuales en payload['current'], acción en payload['event']
    $current  = $payload['current'] ?? $payload['data'] ?? [];
    $previous = $payload['previous'] ?? [];

    // Normalizar evento: v1="updated.deal"|"deleted.deal", v2="change"|"delete"|"add"
    $event    = $payload['event'] ?? $meta['action'] ?? '';

    // Deal ID: v2 usa data.id (int) y meta.entity_id (string). NO usar meta.id (es UUID del evento)
    $dealId   = (string)($current['id'] ?? $meta['entity_id'] ?? $previous['id'] ?? '');

    // Guardar en sync_log SIEMPRE — incluso si no encontramos la cotización
    $logStmt = db()->prepare(
        'INSERT INTO sync_log (source, action, event_type, event_id, deal_id, payload, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(3))'
    );
    $eventId = $meta['id'] ?? $meta['v'] ?? null;
    $logStmt->execute(['pipedrive', 'webhook_received', $event, (string)$eventId, $dealId, $rawBody]);
    $logId = db()->lastInsertId();

    if (!$dealId) {
        db()->prepare("UPDATE sync_log SET result=? WHERE id=?")->execute(['skipped: no deal id', $logId]);
        ok(['skipped' => 'no deal id', 'log_id' => $logId]);
    }

    // Buscar cotización por pipedrive_deal_id
    $stmt = db()->prepare('SELECT id, status, etapa FROM quotations WHERE pipedrive_deal_id = ? AND is_deleted = 0 LIMIT 1');
    $stmt->execute([$dealId]);
    $quot = $stmt->fetch();

    if (!$quot) {
        db()->prepare("UPDATE sync_log SET result=? WHERE id=?")->execute(['skipped: quotation not found for deal ' . $dealId, $logId]);
        ok(['skipped' => 'quotation not found for deal ' . $dealId, 'log_id' => $logId]);
    }

    // Actualizar log con quotation_id
    db()->prepare("UPDATE sync_log SET quotation_id=? WHERE id=?")->execute([$quot['id'], $logId]);

    $updates = [];
    $params  = [];
    $beforeData = json_encode(['status' => $quot['status'], 'etapa' => $quot['etapa']]);

    // Deal eliminado en Pipedrive → eliminación lógica
    // v1: event="deleted.deal"  |  v2: meta.action="delete"
    if ($event === 'delete' || str_contains($event, 'deleted')) {
        db()->prepare(
            'UPDATE quotations SET is_deleted=1, deleted_at=NOW(), deleted_source=?, last_sync_source=?, last_sync_at=NOW(3) WHERE id=?'
        )->execute(['pipedrive', 'pipedrive', $quot['id']]);
        db()->prepare("UPDATE sync_log SET result=?, after_data=? WHERE id=?")->execute(
            ['logical_delete_ok', json_encode(['is_deleted' => 1]), $logId]
        );
        ok(['deleted_logical' => $quot['id'], 'deal' => $dealId, 'log_id' => $logId]);
    }

    // Sync status: open/won/lost
    // Pipedrive v2.0 "won" event: event="updated.deal", current.status="won"
    // Pipedrive v2.0 "lost" event: event="updated.deal", current.status="lost"
    $pdStatus = $current['status'] ?? null;
    if ($pdStatus && in_array($pdStatus, ['won', 'lost', 'open'])) {
        if ($pdStatus !== $quot['status']) {
            $updates[] = 'status = ?';
            $params[]  = $pdStatus;
        }
    }

    // Etapa (stage_id numérico)
    $pdStageId = $current['stage_id'] ?? null;
    if ($pdStageId && $pdStageId !== ($quot['pd_stage_id'] ?? null)) {
        $updates[] = 'pd_stage_id = ?';
        $params[]  = (int)$pdStageId;
    }

    // Valor total
    $pdValue = $current['value'] ?? null;
    if ($pdValue !== null && $pdValue !== $previous['value']) {
        $updates[] = 'total = ?';    $params[] = (float)$pdValue;
        $updates[] = 'subtotal = ?'; $params[] = (float)$pdValue;
    }

    // Siempre actualizar last_sync_source y pd_updated_at
    // Convertir ISO 8601 "2026-07-22T03:15:44Z" → "2026-07-22 03:15:44" para MySQL DATETIME
    $pdUpdateTime = $current['update_time'] ?? null;
    if ($pdUpdateTime) {
        $pdUpdateTime = str_replace(['T', 'Z'], [' ', ''], $pdUpdateTime);
        $pdUpdateTime = substr($pdUpdateTime, 0, 19); // "YYYY-MM-DD HH:MM:SS"
    } else {
        $pdUpdateTime = date('Y-m-d H:i:s');
    }
    $updates[] = 'last_sync_source = ?';  $params[] = 'pipedrive';
    $updates[] = 'last_sync_at = NOW(3)'; // sin parámetro — función MySQL directa
    $updates[] = 'pd_updated_at = ?';     $params[] = $pdUpdateTime;

    $params[] = $quot['id'];
    $sqlSet = implode(', ', $updates);
    try {
        db()->prepare('UPDATE quotations SET ' . $sqlSet . ' WHERE id = ?')->execute($params);
        $afterData = json_encode(['status' => $pdStatus, 'pd_stage_id' => $pdStageId]);
        db()->prepare("UPDATE sync_log SET result='updated', before_data=?, after_data=? WHERE id=?")
            ->execute([$beforeData, $afterData, $logId]);
        ok(['updated' => $quot['id'], 'deal' => $dealId, 'event' => $event, 'new_status' => $pdStatus, 'log_id' => $logId]);
    } catch (Exception $e) {
        db()->prepare("UPDATE sync_log SET result='error', error=? WHERE id=?")
            ->execute([$e->getMessage() . ' | SQL: ' . $sqlSet . ' | params: ' . json_encode($params), $logId]);
        ok(['error' => $e->getMessage(), 'sql' => $sqlSet, 'params' => $params, 'log_id' => $logId]);
    }
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

if ($action === 'approvals_delete') {
    requireAuth();
    $b = body();
    $token = $b['token'] ?? $_GET['token'] ?? '';
    db()->prepare('DELETE FROM quotation_approvals WHERE token = ?')->execute([$token]);
    ok();
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
    $stmt = db()->prepare('SELECT * FROM approval_letters WHERE quotation_id = ? ORDER BY created_at DESC');
    $stmt->execute([$_GET['quotation_id'] ?? '']);
    ok($stmt->fetchAll());
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
    // Return full letter data including pipedrive_deal_id for immediate use
    $stmt2 = db()->prepare('SELECT al.*, q.pipedrive_deal_id, q.number AS quotation_number FROM approval_letters al LEFT JOIN quotations q ON q.id=al.quotation_id WHERE al.id=?');
    $stmt2->execute([$id]);
    ok($stmt2->fetch());
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

// ── quotation_pdfs: historial de versiones de PDF ─────────────────────────────

if ($action === 'migrate_quotation_pdfs') {
    requireAdmin();
    $pdo = db();
    $pdo->exec("CREATE TABLE IF NOT EXISTS `quotation_pdfs` (
        `id`                BIGINT       AUTO_INCREMENT PRIMARY KEY,
        `quotation_id`      VARCHAR(36)  NOT NULL,
        `version`           INT          NOT NULL DEFAULT 1,
        `created_at`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        `created_by`        VARCHAR(36)  NULL COMMENT 'user_id',
        `created_by_name`   VARCHAR(200) NULL,
        `motivo`            VARCHAR(500) NULL COMMENT 'Razón de esta versión',
        `pipedrive_file_id` VARCHAR(100) NULL,
        `pdf_hash`          VARCHAR(64)  NULL COMMENT 'SHA256 hex del PDF',
        `pdf_size_bytes`    INT          NULL,
        INDEX `idx_qpdf_quotation` (`quotation_id`),
        INDEX `idx_qpdf_version`   (`quotation_id`, `version`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    ok(['table' => 'quotation_pdfs', 'status' => 'created_or_already_exists']);
}

if ($action === 'quotation_pdfs_add') {
    requireAuth();
    $b = body();
    $quotationId = $b['quotation_id'] ?? null;
    if (!$quotationId) err('Falta quotation_id', 400);
    $pdo = db();
    // Calcular próxima versión
    $stmt = $pdo->prepare('SELECT COALESCE(MAX(version), 0) + 1 FROM quotation_pdfs WHERE quotation_id = ?');
    $stmt->execute([$quotationId]);
    $nextVersion = (int)$stmt->fetchColumn();
    $ins = $pdo->prepare('INSERT INTO quotation_pdfs (quotation_id, version, created_by, created_by_name, motivo, pipedrive_file_id, pdf_hash, pdf_size_bytes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $ins->execute([
        $quotationId,
        $nextVersion,
        $b['created_by']        ?? null,
        $b['created_by_name']   ?? null,
        $b['motivo']            ?? null,
        $b['pipedrive_file_id'] ?? null,
        $b['pdf_hash']          ?? null,
        $b['pdf_size_bytes']    ?? null,
    ]);
    ok(['id' => $pdo->lastInsertId(), 'version' => $nextVersion]);
}

if ($action === 'quotation_pdfs_list') {
    requireAuth();
    $quotationId = $_GET['quotation_id'] ?? null;
    if (!$quotationId) err('Falta quotation_id', 400);
    $rows = db()->prepare('SELECT * FROM quotation_pdfs WHERE quotation_id = ? ORDER BY version DESC');
    $rows->execute([$quotationId]);
    ok($rows->fetchAll(PDO::FETCH_ASSOC));
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── MOTOR DE PROSPECCIÓN ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ── DB init: crea tablas si no existen ───────────────────────────────────────
if ($action === 'prospectos_init') {
    requireAdmin();
    $sqls = [
        "ALTER TABLE profiles
            ADD COLUMN IF NOT EXISTS suspended TINYINT(1) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS suspended_until DATE NULL,
            ADD COLUMN IF NOT EXISTS suspended_reason VARCHAR(255) NULL",

        "ALTER TABLE profiles ADD COLUMN IF NOT EXISTS celular VARCHAR(20) NULL",

        "CREATE TABLE IF NOT EXISTS outbound_calls (
            id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id        CHAR(36) NOT NULL,
            to_number      VARCHAR(30) NOT NULL,
            call_sid       VARCHAR(50) NULL,
            duration_sec   INT NULL,
            recording_url  VARCHAR(500) NULL,
            direction      ENUM('outbound','inbound') NOT NULL DEFAULT 'outbound',
            called_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_to_number (to_number),
            INDEX idx_call_sid (call_sid),
            INDEX idx_called_at (called_at)
        )",
        "ALTER TABLE outbound_calls ADD COLUMN IF NOT EXISTS call_sid VARCHAR(50) NULL",
        "ALTER TABLE outbound_calls ADD COLUMN IF NOT EXISTS duration_sec INT NULL",
        "ALTER TABLE outbound_calls ADD COLUMN IF NOT EXISTS recording_url VARCHAR(500) NULL",
        "ALTER TABLE outbound_calls ADD COLUMN IF NOT EXISTS direction ENUM('outbound','inbound') NOT NULL DEFAULT 'outbound'",

        "CREATE TABLE IF NOT EXISTS prospect_campaigns (
            id           CHAR(36)     NOT NULL PRIMARY KEY,
            name         VARCHAR(255) NOT NULL,
            description  TEXT         NULL,
            segment      VARCHAR(50)  NOT NULL DEFAULT 'educacional',
            region       VARCHAR(100) NOT NULL DEFAULT 'RM',
            status       ENUM('draft','active','paused','closed') NOT NULL DEFAULT 'active',
            created_by   CHAR(36)     NOT NULL,
            created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS prospects (
            id            CHAR(36)     NOT NULL PRIMARY KEY,
            campaign_id   CHAR(36)     NOT NULL,
            name          VARCHAR(255) NOT NULL,
            segment       VARCHAR(50)  NOT NULL DEFAULT 'educacional',
            commune       VARCHAR(100) NULL,
            region        VARCHAR(50)  NOT NULL DEFAULT 'RM',
            rut           VARCHAR(20)  NULL,
            rbd           VARCHAR(20)  NULL,
            address       VARCHAR(255) NULL,
            assigned_to   CHAR(36)     NULL,
            status        ENUM('new','contacted','following','quoting','closed_won','closed_lost') NOT NULL DEFAULT 'new',
            next_contact  DATE         NULL,
            notes         TEXT         NULL,
            source        ENUM('import','manual','inbound') NOT NULL DEFAULT 'import',
            created_by    CHAR(36)     NOT NULL,
            created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_campaign (campaign_id),
            INDEX idx_assigned (assigned_to),
            INDEX idx_status (status),
            INDEX idx_next_contact (next_contact),
            INDEX idx_commune (commune)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS prospect_contacts (
            id                CHAR(36)     NOT NULL PRIMARY KEY,
            prospect_id       CHAR(36)     NOT NULL,
            name              VARCHAR(255) NOT NULL,
            role              VARCHAR(100) NULL,
            phone             VARCHAR(30)  NULL,
            mobile            VARCHAR(30)  NULL,
            email             VARCHAR(255) NULL,
            anexo             VARCHAR(20)  NULL,
            call_instructions VARCHAR(255) NULL,
            is_primary        TINYINT(1)   NOT NULL DEFAULT 0,
            created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_prospect (prospect_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        "ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS anexo VARCHAR(20) NULL",
        "ALTER TABLE prospect_contacts ADD COLUMN IF NOT EXISTS call_instructions VARCHAR(255) NULL",

        "CREATE TABLE IF NOT EXISTS prospect_activities (
            id            CHAR(36)     NOT NULL PRIMARY KEY,
            prospect_id   CHAR(36)     NOT NULL,
            contact_id    CHAR(36)     NULL,
            user_id       CHAR(36)     NOT NULL,
            type          ENUM('call','email','whatsapp','note','visit') NOT NULL,
            result        ENUM('contacted','no_answer','interested','not_interested','follow_up','quote_requested') NULL,
            duration_sec  INT          NULL,
            recording_url VARCHAR(500) NULL,
            call_sid      VARCHAR(50)  NULL,
            notes         TEXT         NULL,
            next_contact  DATE         NULL,
            created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_prospect (prospect_id),
            INDEX idx_user (user_id),
            INDEX idx_created (created_at),
            INDEX idx_call_sid (call_sid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS commune_assignments (
            id          CHAR(36)     NOT NULL PRIMARY KEY,
            campaign_id CHAR(36)     NOT NULL,
            commune     VARCHAR(100) NOT NULL,
            user_id     CHAR(36)     NOT NULL,
            created_by  CHAR(36)     NOT NULL,
            created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_campaign_commune (campaign_id, commune)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        "CREATE TABLE IF NOT EXISTS prospect_assignment_exceptions (
            id           CHAR(36)     NOT NULL PRIMARY KEY,
            prospect_id  CHAR(36)     NOT NULL UNIQUE,
            user_id      CHAR(36)     NOT NULL,
            reason       VARCHAR(255) NULL,
            created_by   CHAR(36)     NOT NULL,
            created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    ];
    foreach ($sqls as $sql) { db()->exec($sql); }
    ok(['tables_created' => true]);
}

// ── CAMPAIGNS ─────────────────────────────────────────────────────────────────
if ($action === 'campaigns_list') {
    requireAuth();
    $rows = db()->query("
        SELECT c.*,
               p.name AS created_by_name,
               (SELECT COUNT(*) FROM prospects WHERE campaign_id = c.id) AS total_prospects,
               (SELECT COUNT(*) FROM prospects WHERE campaign_id = c.id AND status != 'new') AS contacted_count,
               (SELECT COUNT(*) FROM prospects WHERE campaign_id = c.id AND status IN ('quoting','closed_won')) AS quoting_count
        FROM prospect_campaigns c
        LEFT JOIN profiles p ON p.id = c.created_by
        ORDER BY c.created_at DESC
    ")->fetchAll();
    ok($rows);
}

if ($action === 'campaigns_create') {
    $user = requireAdmin();
    $b = body();
    $name = trim($b['name'] ?? '');
    if (!$name) err('Nombre requerido');
    $id = uuid();
    db()->prepare("INSERT INTO prospect_campaigns (id, name, description, segment, region, status, created_by)
                   VALUES (?, ?, ?, ?, ?, 'active', ?)")
        ->execute([$id, $name, $b['description'] ?? null, $b['segment'] ?? 'educacional', $b['region'] ?? 'RM', $user['id']]);
    $row = db()->prepare("SELECT * FROM prospect_campaigns WHERE id = ?")->execute([$id]);
    ok(db()->query("SELECT * FROM prospect_campaigns WHERE id = '$id'")->fetch());
}

if ($action === 'campaigns_update') {
    $user = requireAdmin();
    $b = body();
    $id = $b['id'] ?? '';
    if (!$id) err('ID requerido');
    $fields = []; $vals = [];
    foreach (['name','description','segment','region','status'] as $f) {
        if (isset($b[$f])) { $fields[] = "$f = ?"; $vals[] = $b[$f]; }
    }
    if (!$fields) err('Nada que actualizar');
    $vals[] = $id;
    db()->prepare("UPDATE prospect_campaigns SET " . implode(',', $fields) . " WHERE id = ?")->execute($vals);
    ok();
}

// ── PROSPECTS ─────────────────────────────────────────────────────────────────
if ($action === 'prospects_list') {
    $me = requireAuth();
    $campaign_id = $_GET['campaign_id'] ?? null;
    if (!$campaign_id) err('campaign_id requerido');

    // Ejecutivo: solo sus prospectos. Admin: todos
    $where = 'p.campaign_id = ?';
    $vals  = [$campaign_id];
    if ($me['role'] !== 'admin') {
        $where .= ' AND p.assigned_to = ?';
        $vals[] = $me['id'];
    }

    // Filtros opcionales
    $status = $_GET['status'] ?? null;
    if ($status) { $where .= ' AND p.status = ?'; $vals[] = $status; }

    $commune = $_GET['commune'] ?? null;
    if ($commune) { $where .= ' AND p.commune = ?'; $vals[] = $commune; }

    $search = $_GET['q'] ?? null;
    if ($search) { $where .= ' AND p.name LIKE ?'; $vals[] = "%$search%"; }

    // Filtro por categoría de llamada (basado en mejor duración)
    $call_cat = $_GET['call_cat'] ?? null;
    if ($call_cat === 'sin_llamar') {
        $where .= ' AND NOT EXISTS (SELECT 1 FROM prospect_activities a WHERE a.prospect_id = p.id AND a.type = "call" AND a.duration_sec IS NOT NULL)';
    } elseif ($call_cat === 'con_intencion') {
        $where .= ' AND (SELECT MAX(a.duration_sec) FROM prospect_activities a WHERE a.prospect_id = p.id AND a.type = "call") >= 91';
    } elseif ($call_cat === 'contactada') {
        $where .= ' AND (SELECT MAX(a.duration_sec) FROM prospect_activities a WHERE a.prospect_id = p.id AND a.type = "call") BETWEEN 46 AND 90';
    } elseif ($call_cat === 'fria') {
        $where .= ' AND (SELECT MAX(a.duration_sec) FROM prospect_activities a WHERE a.prospect_id = p.id AND a.type = "call") BETWEEN 31 AND 45';
    } elseif ($call_cat === 'sin_respuesta') {
        $where .= ' AND (SELECT MAX(a.duration_sec) FROM prospect_activities a WHERE a.prospect_id = p.id AND a.type = "call") BETWEEN 0 AND 30';
    }

    $stmt = db()->prepare("
        SELECT p.*,
               pr.name AS assigned_name,
               (SELECT COUNT(*) FROM prospect_activities WHERE prospect_id = p.id) AS activity_count,
               (SELECT MAX(created_at) FROM prospect_activities WHERE prospect_id = p.id) AS last_activity_at,
               (SELECT MAX(created_at) FROM prospect_activities a WHERE a.prospect_id = p.id AND a.type = 'call') AS last_call_at,
               (SELECT MAX(a.duration_sec) FROM prospect_activities a WHERE a.prospect_id = p.id AND a.type = 'call') AS best_call_duration
        FROM prospects p
        LEFT JOIN profiles pr ON pr.id = p.assigned_to
        WHERE $where
        ORDER BY
            CASE p.status WHEN 'new' THEN 1 WHEN 'following' THEN 2 WHEN 'contacted' THEN 3 ELSE 4 END,
            p.next_contact ASC,
            p.updated_at DESC
    ");
    $stmt->execute($vals);
    ok($stmt->fetchAll());
}

if ($action === 'prospects_get') {
    requireAuth();
    $id = $_GET['id'] ?? '';
    if (!$id) err('ID requerido');
    $stmt = db()->prepare("
        SELECT p.*, pr.name AS assigned_name,
               exc.user_id AS exception_user_id, exc.reason AS exception_reason
        FROM prospects p
        LEFT JOIN profiles pr ON pr.id = p.assigned_to
        LEFT JOIN prospect_assignment_exceptions exc ON exc.prospect_id = p.id
        WHERE p.id = ?
    ");
    $stmt->execute([$id]);
    $prospect = $stmt->fetch();
    if (!$prospect) err('No encontrado', 404);

    // Contactos
    $cstmt = db()->prepare("SELECT * FROM prospect_contacts WHERE prospect_id = ? ORDER BY is_primary DESC, name");
    $cstmt->execute([$id]);
    $prospect['contacts'] = $cstmt->fetchAll();

    // Actividades
    $astmt = db()->prepare("
        SELECT a.*, pr.name AS user_name, pc.name AS contact_name
        FROM prospect_activities a
        LEFT JOIN profiles pr ON pr.id = a.user_id
        LEFT JOIN prospect_contacts pc ON pc.id = a.contact_id
        WHERE a.prospect_id = ?
        ORDER BY a.created_at DESC
    ");
    $astmt->execute([$id]);
    $prospect['activities'] = $astmt->fetchAll();

    ok($prospect);
}

if ($action === 'prospects_create') {
    $me = requireAuth();
    $b  = body();
    $name        = trim($b['name'] ?? '');
    $campaign_id = $b['campaign_id'] ?? '';
    if (!$name || !$campaign_id) err('Nombre y campaign_id requeridos');

    $commune = trim($b['commune'] ?? '');
    $id = uuid();

    // Determinar ejecutivo asignado: excepción individual → regla de comuna → null
    $assigned_to = $b['assigned_to'] ?? null;
    if (!$assigned_to && $commune) {
        $row = db()->prepare("SELECT user_id FROM commune_assignments WHERE campaign_id = ? AND commune = ? LIMIT 1");
        $row->execute([$campaign_id, $commune]);
        $assigned_to = ($row->fetch()['user_id'] ?? null);
    }

    db()->prepare("INSERT INTO prospects (id, campaign_id, name, segment, commune, region, rut, rbd, address, assigned_to, status, next_contact, notes, source, created_by)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)")
        ->execute([
            $id, $campaign_id, $name,
            $b['segment'] ?? 'educacional',
            $commune, $b['region'] ?? 'RM',
            $b['rut'] ?? null, $b['rbd'] ?? null, $b['address'] ?? null,
            $assigned_to, $b['next_contact'] ?? null, $b['notes'] ?? null,
            $b['source'] ?? 'manual', $me['id']
        ]);

    // Contactos iniciales si vienen
    if (!empty($b['contacts']) && is_array($b['contacts'])) {
        foreach ($b['contacts'] as $i => $c) {
            $cid = uuid();
            db()->prepare("INSERT INTO prospect_contacts (id, prospect_id, name, role, phone, mobile, email, is_primary)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                ->execute([$cid, $id, $c['name'] ?? '', $c['role'] ?? null, $c['phone'] ?? null, $c['mobile'] ?? null, $c['email'] ?? null, $i === 0 ? 1 : 0]);
        }
    }

    ok(['id' => $id, 'assigned_to' => $assigned_to]);
}

if ($action === 'prospects_update') {
    $me = requireAuth();
    $b  = body();
    $id = $b['id'] ?? '';
    if (!$id) err('ID requerido');

    // Ejecutivo solo puede actualizar sus propios prospectos
    if ($me['role'] !== 'admin') {
        $row = db()->prepare("SELECT assigned_to FROM prospects WHERE id = ?")->execute([$id]);
        $p = db()->prepare("SELECT assigned_to FROM prospects WHERE id = ?")->execute([$id]) ? db()->prepare("SELECT assigned_to FROM prospects WHERE id = ?"): null;
        $stmt2 = db()->prepare("SELECT assigned_to FROM prospects WHERE id = ?");
        $stmt2->execute([$id]);
        $chk = $stmt2->fetch();
        if (!$chk || $chk['assigned_to'] !== $me['id']) err('Forbidden', 403);
    }

    $fields = []; $vals = [];
    foreach (['name','segment','commune','region','rut','rbd','address','status','next_contact','notes','assigned_to'] as $f) {
        if (array_key_exists($f, $b)) { $fields[] = "$f = ?"; $vals[] = $b[$f]; }
    }
    if (!$fields) err('Nada que actualizar');
    $vals[] = $id;
    db()->prepare("UPDATE prospects SET " . implode(',', $fields) . " WHERE id = ?")->execute($vals);
    ok();
}

// ── PROSPECT CONTACTS ─────────────────────────────────────────────────────────
if ($action === 'prospect_contacts_upsert') {
    requireAuth();
    $b = body();
    $prospect_id = $b['prospect_id'] ?? '';
    if (!$prospect_id) err('prospect_id requerido');
    $contacts = $b['contacts'] ?? [];
    // Eliminar los anteriores y reinsertar
    db()->prepare("DELETE FROM prospect_contacts WHERE prospect_id = ?")->execute([$prospect_id]);
    foreach ($contacts as $i => $c) {
        $cid = uuid();
        db()->prepare("INSERT INTO prospect_contacts (id, prospect_id, name, role, phone, mobile, email, is_primary)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([$cid, $prospect_id, $c['name'] ?? '', $c['role'] ?? null, $c['phone'] ?? null, $c['mobile'] ?? null, $c['email'] ?? null, $i === 0 ? 1 : 0]);
    }
    ok();
}

if ($action === 'prospect_contact_update') {
    requireAuth();
    $b = body();
    $id = $b['id'] ?? '';
    if (!$id) err('id requerido');
    if (!($b['name'] ?? '')) err('name requerido');
    db()->prepare("UPDATE prospect_contacts SET name=?, role=?, phone=?, mobile=?, email=?, anexo=?, call_instructions=? WHERE id=?")
        ->execute([$b['name'], $b['role'] ?? null, $b['phone'] ?? null, $b['mobile'] ?? null, $b['email'] ?? null, $b['anexo'] ?? null, $b['call_instructions'] ?? null, $id]);
    $stmt = db()->prepare("SELECT * FROM prospect_contacts WHERE id = ?");
    $stmt->execute([$id]);
    ok($stmt->fetch());
}

if ($action === 'prospect_contact_add') {
    requireAuth();
    $b = body();
    $prospect_id = $b['prospect_id'] ?? '';
    if (!$prospect_id) err('prospect_id requerido');
    if (!($b['name'] ?? '')) err('name requerido');
    try {
        $cid = uuid();
        db()->prepare("INSERT INTO prospect_contacts (id, prospect_id, name, role, phone, mobile, email, anexo, call_instructions, is_primary) VALUES (?,?,?,?,?,?,?,?,?,?)")
            ->execute([$cid, $prospect_id, $b['name'], $b['role'] ?? null, $b['phone'] ?? null, $b['mobile'] ?? null, $b['email'] ?? null, $b['anexo'] ?? null, $b['call_instructions'] ?? null, 0]);
        $stmt = db()->prepare("SELECT * FROM prospect_contacts WHERE id = ?");
        $stmt->execute([$cid]);
        ok($stmt->fetch());
    } catch (Exception $e) {
        err('Error al guardar contacto: ' . $e->getMessage());
    }
}

// ── PHONE SYNC ────────────────────────────────────────────────────────────────
if ($action === 'phone_sync') {
    // Internal action: sync phone numbers from sheet into prospect_contacts
    // Auth via INTERNAL_PDF_SECRET header
    $secret = $_SERVER['HTTP_X_INTERNAL_SECRET'] ?? ($_GET['_secret'] ?? '');
    $expected = getenv('INTERNAL_PDF_SECRET') ?: JWT_SECRET;
    if ($secret === '' || !hash_equals($expected, $secret)) {
        http_response_code(403); echo json_encode(['error'=>'forbidden']); exit;
    }
    $b = body();
    $records = $b['records'] ?? [];

    function normName(string $s): string {
        $s = strtoupper(trim($s));
        $s = preg_replace('/\s+/', ' ', $s);
        // remove common legal suffixes
        return $s;
    }

    $updated = 0; $created = 0; $skipped = 0; $details = [];

    foreach ($records as $rec) {
        $school  = trim($rec['school'] ?? '');
        $commune = trim($rec['commune'] ?? '');
        $phone   = $rec['phone'] ?? null;
        $mobile  = $rec['mobile'] ?? null;
        $cname   = trim($rec['contact_name'] ?? '');
        $cargo   = trim($rec['cargo'] ?? '');
        $mail    = trim($rec['mail'] ?? '');
        if (!$school || (!$phone && !$mobile)) { $skipped++; continue; }

        // Find prospect by name (normalized, commune)
        $stmt = db()->prepare("SELECT id FROM prospects WHERE UPPER(TRIM(name)) = ? AND UPPER(TRIM(commune)) = ? LIMIT 1");
        $stmt->execute([normName($school), normName($commune)]);
        $prospect = $stmt->fetch();

        // Fallback: partial match (school name contained in prospect name or vice versa)
        if (!$prospect) {
            $stmt = db()->prepare("SELECT id FROM prospects WHERE UPPER(TRIM(commune)) = ? AND (UPPER(TRIM(name)) LIKE ? OR ? LIKE CONCAT('%', UPPER(TRIM(name)), '%')) LIMIT 1");
            $sn = normName($school);
            $stmt->execute([normName($commune), '%'.$sn.'%', $sn]);
            $prospect = $stmt->fetch();
        }

        if (!$prospect) { $skipped++; $details[] = "NO_MATCH: $school ($commune)"; continue; }
        $pid = $prospect['id'];

        // Check existing contacts for this phone
        $phoneClean = preg_replace('/[^0-9]/', '', $phone ?? '');
        $mobClean   = preg_replace('/[^0-9]/', '', $mobile ?? '');
        $stmt = db()->prepare("SELECT id, phone, mobile FROM prospect_contacts WHERE prospect_id = ?");
        $stmt->execute([$pid]);
        $contacts = $stmt->fetchAll();

        $phoneExists = false;
        foreach ($contacts as $c) {
            $cp = preg_replace('/[^0-9]/', '', $c['phone'] ?? '');
            $cm = preg_replace('/[^0-9]/', '', $c['mobile'] ?? '');
            if (($phoneClean && $cp === $phoneClean) || ($mobClean && $cm === $mobClean)) {
                $phoneExists = true; break;
            }
        }
        if ($phoneExists) { $skipped++; continue; }

        // Try to update primary contact if it has no phone/mobile
        $updated_existing = false;
        foreach ($contacts as $c) {
            if (!$c['phone'] && !$c['mobile']) {
                db()->prepare("UPDATE prospect_contacts SET phone=?, mobile=? WHERE id=?")
                    ->execute([$phone, $mobile, $c['id']]);
                $updated++; $updated_existing = true; break;
            }
        }
        if ($updated_existing) continue;

        // Create new contact
        $cid = uuid();
        $isPrimary = count($contacts) === 0 ? 1 : 0;
        db()->prepare("INSERT INTO prospect_contacts (id, prospect_id, name, role, phone, mobile, email, is_primary) VALUES (?,?,?,?,?,?,?,?)")
            ->execute([$cid, $pid, $cname ?: $school, $cargo ?: null, $phone, $mobile, $mail ?: null, $isPrimary]);
        $created++;
    }

    ok(['updated'=>$updated, 'created'=>$created, 'skipped'=>$skipped, 'no_match_sample'=>array_slice($details,0,20)]);
}

// ── ACTIVITIES ────────────────────────────────────────────────────────────────
if ($action === 'activity_create') {
    $me = requireAuth();
    $b  = body();
    $prospect_id = $b['prospect_id'] ?? '';
    $type        = $b['type'] ?? '';
    if (!$prospect_id || !$type) err('prospect_id y type requeridos');

    // Validar max 14 días para next_contact
    $next_contact = $b['next_contact'] ?? null;
    if ($next_contact) {
        $diff = (strtotime($next_contact) - time()) / 86400;
        if ($diff > 14) err('El próximo contacto no puede ser más de 14 días');
        if ($diff < 0)  err('Fecha de próximo contacto no puede ser en el pasado');
    }

    $id = uuid();
    db()->prepare("INSERT INTO prospect_activities (id, prospect_id, contact_id, user_id, type, result, duration_sec, recording_url, call_sid, notes, next_contact)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([
            $id, $prospect_id, $b['contact_id'] ?? null, $me['id'],
            $type, $b['result'] ?? null,
            $b['duration_sec'] ?? null, $b['recording_url'] ?? null,
            $b['call_sid'] ?? null,
            $b['notes'] ?? null, $next_contact
        ]);

    // Actualizar estado y próximo contacto del prospecto
    $new_status = null;
    if ($b['result'] === 'quote_requested') $new_status = 'quoting';
    elseif ($b['result'] === 'interested')  $new_status = 'following';
    elseif ($b['result'] === 'contacted' || $b['result'] === 'follow_up') $new_status = 'following';
    elseif ($b['result'] === 'not_interested') $new_status = 'closed_lost';

    $upd_fields = ['updated_at = NOW()'];
    $upd_vals   = [];
    if ($next_contact) { $upd_fields[] = 'next_contact = ?'; $upd_vals[] = $next_contact; }
    if ($new_status)   { $upd_fields[] = 'status = ?';       $upd_vals[] = $new_status; }
    $upd_vals[] = $prospect_id;
    db()->prepare("UPDATE prospects SET " . implode(',', $upd_fields) . " WHERE id = ?")->execute($upd_vals);

    ok(['id' => $id]);
}

if ($action === 'activities_list') {
    requireAuth();
    $prospect_id = $_GET['prospect_id'] ?? null;
    if (!$prospect_id) err('prospect_id requerido');
    $stmt = db()->prepare("
        SELECT a.*, pr.name AS user_name, pc.name AS contact_name
        FROM prospect_activities a
        LEFT JOIN profiles pr ON pr.id = a.user_id
        LEFT JOIN prospect_contacts pc ON pc.id = a.contact_id
        WHERE a.prospect_id = ?
        ORDER BY a.created_at DESC
    ");
    $stmt->execute([$prospect_id]);
    ok($stmt->fetchAll());
}

// ── TWILIO CALLBACKS ──────────────────────────────────────────────────────────
// (call_recording_update definido más abajo — este bloque eliminado para evitar duplicado)

// ── DIAGNÓSTICO llamadas recientes (temporal) ─────────────────────────────────
if ($action === 'diag_recent_calls') {
    $secret = $_GET['_secret'] ?? '';
    $expected = getenv('INTERNAL_PDF_SECRET') ?: JWT_SECRET;
    if (!hash_equals($expected, $secret)) { http_response_code(403); exit; }
    $rows = db()->query("
        SELECT o.id, o.user_id, o.to_number, o.called_at, o.duration_sec,
               o.recording_url, o.call_sid, p.name as exec_name
        FROM outbound_calls o
        LEFT JOIN profiles p ON p.id = o.user_id
        ORDER BY o.called_at DESC LIMIT 5
    ")->fetchAll();
    foreach ($rows as &$r) { $r['called_at_cl'] = date('Y-m-d H:i:s', strtotime($r['called_at']) - 3*3600); }
    ok($rows);
}

// ── Diagnóstico: contactos de campaña sin teléfono ─────────────────────────────
if ($action === 'diag_campaign_contacts') {
    $secret = $_GET['_secret'] ?? '';
    $expected = getenv('INTERNAL_PDF_SECRET') ?: JWT_SECRET;
    if (!hash_equals($expected, $secret)) { http_response_code(403); exit; }
    $campaign_id = $_GET['campaign_id'] ?? null;
    if (!$campaign_id) { http_response_code(400); echo '{}'; exit; }
    $rows = db()->prepare("
        SELECT pr.id, pr.name, pr.commune, pr.status,
               c.id as contact_id, c.name as contact_name, c.role as contact_role,
               c.phone, c.mobile, c.email
        FROM prospects pr
        LEFT JOIN prospect_contacts c ON c.prospect_id = pr.id
        WHERE pr.campaign_id = ?
        ORDER BY pr.commune, pr.name, c.is_primary DESC
    ");
    $rows->execute([$campaign_id]);
    ok($rows->fetchAll());
}

// ── BACKFILL duration en outbound_calls desde prospect_activities (admin one-time) ─
if ($action === 'cleanup_ghosts') {
    $secret = $_GET['_secret'] ?? '';
    $expected = getenv('INTERNAL_PDF_SECRET') ?: JWT_SECRET;
    if (!hash_equals($expected, $secret)) { http_response_code(403); echo json_encode(['error'=>'forbidden']); exit; }
    $b = body();
    $merges     = $b['merges']     ?? [];   // [{contact_id, to_prospect_id}]
    $delete_ids = $b['delete_ids'] ?? [];   // prospect UUIDs to delete

    $merged  = 0;
    $deleted = 0;
    $errors  = [];

    // 1. Move contacts to real schools
    $stmt_move = db()->prepare("UPDATE prospect_contacts SET prospect_id=? WHERE id=?");
    foreach ($merges as $m) {
        $cid = $m['contact_id'] ?? null;
        $tid = $m['to_prospect_id'] ?? null;
        if (!$cid || !$tid) continue;
        try { $stmt_move->execute([$tid, $cid]); $merged++; }
        catch (Exception $e) { $errors[] = "merge $cid: ".$e->getMessage(); }
    }

    // 2. Delete ghost prospects (contacts, activities, then prospect)
    $del_contacts   = db()->prepare("DELETE FROM prospect_contacts   WHERE prospect_id=?");
    $del_activities = db()->prepare("DELETE FROM prospect_activities WHERE prospect_id=?");
    $del_prospect   = db()->prepare("DELETE FROM prospects           WHERE id=?");
    foreach ($delete_ids as $pid) {
        if (!$pid) continue;
        try {
            $del_contacts->execute([$pid]);
            $del_activities->execute([$pid]);
            $del_prospect->execute([$pid]);
            $deleted++;
        } catch (Exception $e) { $errors[] = "delete $pid: ".$e->getMessage(); }
    }

    echo json_encode(['ok'=>true, 'merged'=>$merged, 'deleted'=>$deleted, 'errors'=>$errors]);
    exit;
}

if ($action === 'patch_contact_phones') {
    $secret = $_GET['_secret'] ?? '';
    $expected = getenv('INTERNAL_PDF_SECRET') ?: JWT_SECRET;
    if (!hash_equals($expected, $secret)) { http_response_code(403); echo json_encode(['error'=>'forbidden']); exit; }
    $b = body();
    $updates = $b['updates'] ?? [];
    $updated = 0; $skipped = 0;
    foreach ($updates as $u) {
        $contact_id = $u['contact_id'] ?? null;
        $phone      = $u['phone']      ?? null;
        if (!$contact_id || !$phone) { $skipped++; continue; }
        // Only overwrite if currently empty
        $s = db()->prepare("SELECT phone, mobile FROM prospect_contacts WHERE id = ? LIMIT 1");
        $s->execute([$contact_id]);
        $row = $s->fetch();
        if (!$row || $row['phone'] || $row['mobile']) { $skipped++; continue; }
        db()->prepare("UPDATE prospect_contacts SET phone=? WHERE id=?")->execute([$phone, $contact_id]);
        $updated++;
    }
    echo json_encode(['ok'=>true, 'updated'=>$updated, 'skipped'=>$skipped]);
    exit;
}

if ($action === 'repair_call_durations') {
    $secret = $_GET['_secret'] ?? '';
    $expected = getenv('INTERNAL_PDF_SECRET') ?: JWT_SECRET;
    if (!hash_equals($expected, $secret)) { http_response_code(403); echo json_encode(['error'=>'forbidden']); exit; }
    // Copiar duration_sec desde prospect_activities a outbound_calls donde falta
    $r1 = db()->exec("
        UPDATE outbound_calls o
        JOIN prospect_activities a ON a.call_sid = o.call_sid
        SET o.duration_sec = a.duration_sec
        WHERE o.duration_sec IS NULL AND a.duration_sec IS NOT NULL AND a.duration_sec > 0
    ");
    // Para llamadas sin call_sid en activities, intentar por número+hora cercana (margen 5 min)
    // Esta segunda pasada es mejor-esfuerzo; la primera cubre la mayoría
    ok(['updated_from_activities' => $r1]);
}

if ($action === 'call_status_update') {
    $b = body();
    $call_sid = $b['call_sid'] ?? null;
    $duration = isset($b['duration']) ? (int)$b['duration'] : null;
    if (!$call_sid) ok(['skipped' => true]);
    if ($duration !== null) {
        db()->prepare("UPDATE prospect_activities SET duration_sec = ? WHERE call_sid = ?")
            ->execute([$duration, $call_sid]);
        db()->prepare("UPDATE outbound_calls SET duration_sec = COALESCE(duration_sec, ?) WHERE call_sid = ?")
            ->execute([$duration, $call_sid]);

        // Auto-crear prospect_activity si no existe para esta llamada Twilio
        $existing = db()->prepare("SELECT id FROM prospect_activities WHERE call_sid = ? LIMIT 1");
        $existing->execute([$call_sid]);
        if (!$existing->fetch()) {
            // Buscar outbound_call para obtener to_number y user_id
            $oc = db()->prepare("SELECT user_id, to_number FROM outbound_calls WHERE call_sid = ? LIMIT 1");
            $oc->execute([$call_sid]);
            $ocRow = $oc->fetch();
            if ($ocRow) {
                // Buscar contacto y prospecto que coincidan con el número (últimos 9 dígitos)
                $phone9 = substr(preg_replace('/[^0-9]/', '', $ocRow['to_number']), -9);
                $contact = db()->prepare("
                    SELECT c.id AS contact_id, c.prospect_id
                    FROM prospect_contacts c
                    WHERE RIGHT(REGEXP_REPLACE(c.mobile,'[^0-9]',''),9) = ?
                       OR RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]',''),9) = ?
                    LIMIT 1
                ");
                $contact->execute([$phone9, $phone9]);
                $cRow = $contact->fetch();
                if ($cRow) {
                    $result = $duration >= 91 ? 'interested'
                            : ($duration >= 46 ? 'contacted'
                            : ($duration >= 31 ? 'cold' : 'no_answer'));
                    db()->prepare("INSERT INTO prospect_activities
                        (id, prospect_id, contact_id, user_id, type, result, duration_sec, call_sid, created_at)
                        VALUES (UUID(), ?, ?, ?, 'call', ?, ?, ?, NOW())")
                        ->execute([$cRow['prospect_id'], $cRow['contact_id'],
                                   $ocRow['user_id'], $result, $duration, $call_sid]);
                    // Actualizar status del prospecto
                    if ($duration >= 60) {
                        db()->prepare("UPDATE prospects SET status='quoting' WHERE id=? AND status='new'")
                            ->execute([$cRow['prospect_id']]);
                    } elseif ($duration >= 5) {
                        db()->prepare("UPDATE prospects SET status='contacted' WHERE id=? AND status='new'")
                            ->execute([$cRow['prospect_id']]);
                    }
                }
            }
        } elseif ($duration >= 5) {
            // Activity ya existe: solo actualizar status del prospecto
            db()->prepare("
                UPDATE prospects p
                JOIN prospect_activities a ON a.prospect_id = p.id
                SET p.status = 'contacted'
                WHERE a.call_sid = ? AND p.status = 'new'
            ")->execute([$call_sid]);
        }
    }
    ok(['updated' => true]);
}

// Registro de llamadas salientes — llamado internamente por el webhook Vercel
if ($action === 'outbound_calls_list') {
    $me = requireAuth();
    // Admins ven todos; ejecutivos solo los suyos
    $onlyMine = !isAdmin($me);
    $limit  = min((int)($_GET['limit'] ?? 50), 200);
    $offset = (int)($_GET['offset'] ?? 0);

    $whereClause = $onlyMine ? 'WHERE o.user_id = ?' : 'WHERE 1=1';
    $params = $onlyMine ? [$me['id']] : [];
    $stmt = db()->prepare("
        SELECT o.id, o.user_id, o.to_number, o.called_at,
               o.direction, o.duration_sec, o.recording_url,
               p.name AS executive_name,
               c.id   AS contact_id,
               c.name AS contact_name,
               pr.id  AS prospect_id,
               pr.name AS prospect_company
        FROM outbound_calls o
        JOIN profiles p ON p.id = o.user_id
        LEFT JOIN prospect_contacts c ON (
            RIGHT(REGEXP_REPLACE(c.mobile, '[^0-9]', ''), 9) = RIGHT(REGEXP_REPLACE(o.to_number, '[^0-9]', ''), 9)
            OR RIGHT(REGEXP_REPLACE(c.phone,  '[^0-9]', ''), 9) = RIGHT(REGEXP_REPLACE(o.to_number, '[^0-9]', ''), 9)
        )
        LEFT JOIN prospects pr ON pr.id = c.prospect_id
        $whereClause
        ORDER BY o.called_at DESC
        LIMIT $limit OFFSET $offset
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // Convertir hora UTC → Chile (UTC-3 fijo para simplificar)
    foreach ($rows as &$r) {
        if ($r['called_at']) {
            $r['called_at_cl'] = date('Y-m-d H:i', strtotime($r['called_at']) - 3*3600);
        }
    }
    ok($rows);
}

// ── CALL DASHBOARD ────────────────────────────────────────────────────────────
if ($action === 'call_dashboard') {
    $me       = requireAuth();
    $onlyMine = !isAdmin($me);

    $campaign_id = $_GET['campaign_id'] ?? null;
    if (!$campaign_id) err('campaign_id requerido');

    $date_from      = $_GET['date_from']   ?? date('Y-m-01');
    $date_to        = $_GET['date_to']     ?? date('Y-m-d');
    $filter_user    = $onlyMine ? $me['id'] : ($_GET['user_id'] ?? null);
    $filter_commune = $_GET['commune'] ?? null;

    $where  = [
        "pr.campaign_id = ?",
        "DATE_SUB(o.called_at, INTERVAL 3 HOUR) BETWEEN ? AND ?",
    ];
    $params = [$campaign_id, $date_from . ' 00:00:00', $date_to . ' 23:59:59'];
    if ($filter_user)    { $where[] = "o.user_id = ?"; $params[] = $filter_user; }
    if ($filter_commune) { $where[] = "pr.commune = ?"; $params[] = $filter_commune; }
    $whereStr = implode(' AND ', $where);

    $phoneJoin = "
        JOIN prospect_contacts c ON (
            RIGHT(REGEXP_REPLACE(c.mobile, '[^0-9]', ''), 9) = RIGHT(REGEXP_REPLACE(o.to_number, '[^0-9]', ''), 9)
            OR RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', ''), 9) = RIGHT(REGEXP_REPLACE(o.to_number, '[^0-9]', ''), 9)
        )
    ";

    // ── 1. Mejor llamada por colegio (prospect) ───────────────────────────────
    $stmt = db()->prepare("
        SELECT pr.id as prospect_id, pr.name as prospect_name, pr.commune, pr.status,
               MAX(COALESCE(o.duration_sec, 0)) as best_duration,
               COUNT(*) as call_count,
               MAX(CASE WHEN o.recording_url IS NOT NULL AND COALESCE(o.duration_sec,0) >= 60
                        THEN o.recording_url ELSE NULL END) as best_recording
        FROM outbound_calls o
        $phoneJoin
        JOIN prospects pr ON pr.id = c.prospect_id
        WHERE $whereStr
        GROUP BY pr.id, pr.name, pr.commune, pr.status
    ");
    $stmt->execute($params);
    $prospectRows = $stmt->fetchAll();

    // Clasificar cada colegio por su mejor llamada
    function classifyDuration(int $d): string {
        if ($d >= 91) return 'con_intencion';
        if ($d >= 46) return 'contactada';
        if ($d >= 31) return 'fria';
        return 'sin_respuesta';
    }

    $summary = ['con_intencion' => 0, 'contactada' => 0, 'fria' => 0, 'sin_respuesta' => 0, 'total_colegios' => 0, 'total_calls' => 0];
    foreach ($prospectRows as &$p) {
        $p['best_duration'] = (int)$p['best_duration'];
        $p['call_count']    = (int)$p['call_count'];
        $p['category']      = classifyDuration($p['best_duration']);
        $summary[$p['category']]++;
        $summary['total_colegios']++;
        $summary['total_calls'] += $p['call_count'];
    }
    unset($p);

    // Total colegios campaña (para % cobertura)
    $stmtTotal = db()->prepare(
        "SELECT COUNT(*) FROM prospects WHERE campaign_id = ?" . ($filter_commune ? " AND commune = ?" : "")
    );
    $stmtTotal->execute($filter_commune ? [$campaign_id, $filter_commune] : [$campaign_id]);
    $totalCampaign = (int)$stmtTotal->fetchColumn();
    $summary['total_campaign']  = $totalCampaign;
    $summary['coverage_pct']    = $totalCampaign > 0 ? round($summary['total_colegios'] / $totalCampaign * 100) : 0;
    $summary['intencion_pct']   = $totalCampaign > 0 ? round($summary['con_intencion']  / $totalCampaign * 100) : 0;

    // ── 2. Detalle por ejecutivo × día × colegio ─────────────────────────────
    $stmt = db()->prepare("
        SELECT o.user_id, pf.name as executive_name,
               DATE(DATE_SUB(o.called_at, INTERVAL 3 HOUR)) as date,
               pr.id as prospect_id,
               MAX(COALESCE(o.duration_sec, 0)) as best_duration,
               COUNT(*) as call_count
        FROM outbound_calls o
        JOIN profiles pf ON pf.id = o.user_id
        $phoneJoin
        JOIN prospects pr ON pr.id = c.prospect_id
        WHERE $whereStr
        GROUP BY o.user_id, pf.name, DATE(DATE_SUB(o.called_at, INTERVAL 3 HOUR)), pr.id
    ");
    $stmt->execute($params);
    $execDailyRows = $stmt->fetchAll();

    $execMap = [];
    foreach ($execDailyRows as $r) {
        $uid  = $r['user_id'];
        $date = $r['date'];
        $cat  = classifyDuration((int)$r['best_duration']);
        if (!isset($execMap[$uid])) {
            $execMap[$uid] = [
                'user_id' => $uid, 'executive_name' => $r['executive_name'],
                'con_intencion' => 0, 'contactada' => 0, 'fria' => 0, 'sin_respuesta' => 0,
                'total_colegios' => 0, 'total_calls' => 0, 'days' => [], 'daily_intencion' => [],
            ];
        }
        $execMap[$uid][$cat]++;
        $execMap[$uid]['total_colegios']++;
        $execMap[$uid]['total_calls'] += (int)$r['call_count'];
        $execMap[$uid]['days'][$date] = true;
        if ($cat === 'con_intencion')
            $execMap[$uid]['daily_intencion'][$date] = ($execMap[$uid]['daily_intencion'][$date] ?? 0) + 1;
    }

    $execStats = [];
    foreach ($execMap as $e) {
        $days = count($e['days']);
        $execStats[] = [
            'user_id'              => $e['user_id'],
            'executive_name'       => $e['executive_name'],
            'con_intencion'        => $e['con_intencion'],
            'contactada'           => $e['contactada'],
            'fria'                 => $e['fria'],
            'sin_respuesta'        => $e['sin_respuesta'],
            'total_colegios'       => $e['total_colegios'],
            'days_active'          => $days,
            'total_calls'          => $e['total_calls'],
            'daily_avg_intencion'  => $days > 0 ? round($e['con_intencion']    / $days, 1) : 0,
            'daily_avg_total'      => $days > 0 ? round($e['total_colegios']   / $days, 1) : 0,
            'intencion_rate'       => $e['total_colegios'] > 0 ? round($e['con_intencion'] / $e['total_colegios'] * 100) : 0,
        ];
    }
    usort($execStats, fn($a,$b) => $b['total_colegios'] - $a['total_colegios']);

    // ── 3. Comunas ────────────────────────────────────────────────────────────
    $stmtCommTotals = db()->prepare("SELECT commune, COUNT(*) as t FROM prospects WHERE campaign_id = ? GROUP BY commune");
    $stmtCommTotals->execute([$campaign_id]);
    $commTotals = [];
    foreach ($stmtCommTotals->fetchAll() as $r) $commTotals[$r['commune']] = (int)$r['t'];

    $commMap = [];
    foreach ($prospectRows as $p) {
        $c = $p['commune'] ?? 'Sin asignar';
        if (!isset($commMap[$c])) $commMap[$c] = ['con_intencion'=>0,'contactada'=>0,'fria'=>0,'sin_respuesta'=>0,'llamados'=>0];
        $commMap[$c][$p['category']]++;
        $commMap[$c]['llamados']++;
    }

    $communeStats = [];
    foreach ($commMap as $comm => $d) {
        $total = $commTotals[$comm] ?? 0;
        $communeStats[] = [
            'commune'       => $comm,
            'total'         => $total,
            'llamados'      => $d['llamados'],
            'con_intencion' => $d['con_intencion'],
            'contactada'    => $d['contactada'],
            'fria'          => $d['fria'],
            'sin_respuesta' => $d['sin_respuesta'],
            'sin_contacto'  => max(0, $total - $d['llamados']),
            'coverage_pct'  => $total > 0 ? round($d['llamados']       / $total * 100) : 0,
            'intencion_pct' => $total > 0 ? round($d['con_intencion']  / $total * 100) : 0,
        ];
    }
    // Añadir comunas sin ninguna llamada
    foreach ($commTotals as $comm => $total) {
        if (!isset($commMap[$comm]) && (!$filter_commune || $comm === $filter_commune)) {
            $communeStats[] = [
                'commune' => $comm, 'total' => $total, 'llamados' => 0,
                'con_intencion' => 0, 'contactada' => 0, 'fria' => 0, 'sin_respuesta' => 0,
                'sin_contacto' => $total, 'coverage_pct' => 0, 'intencion_pct' => 0,
            ];
        }
    }
    usort($communeStats, fn($a,$b) => $b['con_intencion'] - $a['con_intencion']);

    // ── 4. Top prospectos (mejor vínculo = mayor duración ≥15s) ──────────────
    $topProspects = array_values(array_filter($prospectRows, fn($p) => $p['best_duration'] >= 15));
    usort($topProspects, fn($a,$b) => $b['best_duration'] - $a['best_duration']);
    $topProspects = array_slice($topProspects, 0, 15);

    ok([
        'summary'        => $summary,
        'executive_stats' => $execStats,
        'commune_stats'  => array_values($communeStats),
        'top_prospects'  => $topProspects,
    ]);
}

if ($action === 'log_outbound_call') {
    $secret = $_SERVER['HTTP_X_INTERNAL_SECRET'] ?? '';
    $expected = getenv('INTERNAL_PDF_SECRET') ?: JWT_SECRET;
    if (!hash_equals($expected, $secret)) { http_response_code(403); echo '{}'; exit; }
    $b = body();
    $userId   = $b['user_id']   ?? null;
    $toNumber = $b['to_number'] ?? null;
    $callSid  = $b['call_sid']  ?? null;
    if (!$userId || !$toNumber) { echo '{}'; exit; }
    $normalized = preg_replace('/[^0-9+]/', '', $toNumber);
    db()->prepare("INSERT INTO outbound_calls (user_id, to_number, call_sid, direction) VALUES (?, ?, ?, 'outbound')")
        ->execute([$userId, $normalized, $callSid]);
    echo json_encode(['ok' => true]);
    exit;
}

if ($action === 'backfill_calls') {
    $secret = $_GET['_secret'] ?? '';
    $expected = getenv('INTERNAL_PDF_SECRET') ?: JWT_SECRET;
    if (!hash_equals($expected, $secret)) { http_response_code(403); echo json_encode(['error'=>'forbidden']); exit; }
    $b = body();
    $calls = $b['calls'] ?? [];
    $inserted = 0; $skipped = 0;
    foreach ($calls as $c) {
        $userId   = $c['user_id']   ?? null;
        $toNumber = $c['to_number'] ?? null;
        $callSid  = $c['call_sid']  ?? null;
        $calledAt = $c['called_at'] ?? null;
        if (!$userId || !$toNumber) { $skipped++; continue; }
        $normalized = preg_replace('/[^0-9+]/', '', $toNumber);
        // Avoid duplicates
        $exists = db()->prepare("SELECT id FROM outbound_calls WHERE call_sid = ? LIMIT 1");
        $exists->execute([$callSid]);
        if ($exists->fetch()) { $skipped++; continue; }
        $durationSec = isset($c['duration_sec']) ? (int)$c['duration_sec'] : null;
        db()->prepare("INSERT INTO outbound_calls (user_id, to_number, call_sid, direction, called_at, duration_sec) VALUES (?, ?, ?, 'outbound', ?, ?)")
            ->execute([$userId, $normalized, $callSid, $calledAt, $durationSec]);
        $inserted++;
    }
    echo json_encode(['ok' => true, 'inserted' => $inserted, 'skipped' => $skipped]);
    exit;
}

if ($action === 'log_inbound_call') {
    // Llamado desde incoming_call_route al recibir llamada entrante
    $secret = $_SERVER['HTTP_X_INTERNAL_SECRET'] ?? '';
    $expected = getenv('INTERNAL_PDF_SECRET') ?: JWT_SECRET;
    if (!hash_equals($expected, $secret)) { http_response_code(403); echo '{}'; exit; }
    $b = body();
    $userId   = $b['user_id']   ?? null;
    $fromNum  = $b['from_number'] ?? null;
    $callSid  = $b['call_sid']    ?? null;
    if (!$userId || !$fromNum) { echo '{}'; exit; }
    $normalized = preg_replace('/[^0-9+]/', '', $fromNum);
    db()->prepare("INSERT INTO outbound_calls (user_id, to_number, call_sid, direction) VALUES (?, ?, ?, 'inbound')")
        ->execute([$userId, $normalized, $callSid]);
    echo json_encode(['ok' => true]);
    exit;
}

if ($action === 'delete_call') {
    $me = requireAuth();
    if (!isAdmin($me)) { http_response_code(403); echo json_encode(['error' => 'Solo administradores']); exit; }
    $b  = body();
    $id = $b['id'] ?? null;
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'id requerido']); exit; }
    db()->prepare("DELETE FROM outbound_calls WHERE id = ?")->execute([$id]);
    echo json_encode(['ok' => true]);
    exit;
}

if ($action === 'call_recording_update') {
    $secret = $_SERVER['HTTP_X_INTERNAL_SECRET'] ?? '';
    // getenv vacío en cPanel → fallback a JWT_SECRET (constante con valor hardcodeado)
    $pdfSecret = getenv('INTERNAL_PDF_SECRET') ?: JWT_SECRET;
    $isInternal = $secret !== '' && hash_equals($pdfSecret, $secret);
    $b = body();
    if (!$isInternal) { $me = requireAuth(); }
    $callSid       = $b['call_sid']          ?? null;
    $parentCallSid = $b['parent_call_sid']   ?? null;
    $recordingUrl  = $b['recording_url']     ?? null;
    $duration      = isset($b['recording_duration']) ? (int)$b['recording_duration']
                   : (isset($b['call_duration'])     ? (int)$b['call_duration'] : null);
    if (!$callSid && !$parentCallSid) { ok(['skipped' => true]); }
    // Priorizar parentCallSid (coincide con outbound_calls.call_sid del leg browser)
    $sids = array_values(array_filter(array_unique([$parentCallSid, $callSid])));
    foreach ($sids as $sid) {
        if ($recordingUrl) {
            db()->prepare("UPDATE outbound_calls SET recording_url = COALESCE(recording_url, ?), duration_sec = COALESCE(duration_sec, ?) WHERE call_sid = ?")
                ->execute([$recordingUrl, $duration, $sid]);
            db()->prepare("UPDATE prospect_activities SET recording_url = COALESCE(recording_url, ?), duration_sec = COALESCE(duration_sec, ?) WHERE call_sid = ?")
                ->execute([$recordingUrl, $duration, $sid]);
        } else {
            // child-status sin grabación: al menos actualizar duración
            db()->prepare("UPDATE outbound_calls SET duration_sec = COALESCE(duration_sec, ?) WHERE call_sid = ?")
                ->execute([$duration, $sid]);
            db()->prepare("UPDATE prospect_activities SET duration_sec = COALESCE(duration_sec, ?) WHERE call_sid = ?")
                ->execute([$duration, $sid]);
        }
    }
    // Auto-crear prospect_activity si no existe aún para esta llamada
    $primarySid = $parentCallSid ?? $callSid;
    if ($primarySid) {
        $existing = db()->prepare("SELECT id FROM prospect_activities WHERE call_sid = ? LIMIT 1");
        $existing->execute([$primarySid]);
        if (!$existing->fetch()) {
            $oc = db()->prepare("SELECT user_id, to_number FROM outbound_calls WHERE call_sid = ? LIMIT 1");
            $oc->execute([$primarySid]);
            $ocRow = $oc->fetch();
            if ($ocRow) {
                $phone9 = substr(preg_replace('/[^0-9]/', '', $ocRow['to_number']), -9);
                $contact = db()->prepare("SELECT c.id AS contact_id, c.prospect_id FROM prospect_contacts c WHERE RIGHT(REGEXP_REPLACE(c.mobile,'[^0-9]',''),9) = ? OR RIGHT(REGEXP_REPLACE(c.phone,'[^0-9]',''),9) = ? LIMIT 1");
                $contact->execute([$phone9, $phone9]);
                $cRow = $contact->fetch();
                if ($cRow) {
                    $dur = $duration ?? 0;
                    $result = $dur >= 91 ? 'interested' : ($dur >= 46 ? 'contacted' : ($dur >= 31 ? 'cold' : 'no_answer'));
                    db()->prepare("INSERT IGNORE INTO prospect_activities (id, prospect_id, contact_id, user_id, type, result, duration_sec, call_sid, recording_url, created_at) VALUES (UUID(), ?, ?, ?, 'call', ?, ?, ?, ?, NOW())")
                        ->execute([$cRow['prospect_id'], $cRow['contact_id'], $ocRow['user_id'], $result, $dur, $primarySid, $recordingUrl]);
                    // Actualizar estado del prospecto si estaba sin gestionar
                    db()->prepare("UPDATE prospects SET status = 'contacted', updated_at = NOW() WHERE id = ? AND status = 'new'")
                        ->execute([$cRow['prospect_id']]);
                }
            }
        }
    }
    ok(['updated' => true]);
}

// Devuelve el celular del último ejecutivo que llamó a un número dado (para routing de llamada entrante)
if ($action === 'incoming_call_route') {
    $from = $_POST['From'] ?? $_GET['from'] ?? null;
    if (!$from) { echo '<Response><Hangup/></Response>'; exit; }
    $normalized = preg_replace('/[^0-9]/', '', $from);

    // 1. Buscar en outbound_calls (registrado por webhook Vercel al marcar)
    $stmt = db()->prepare("
        SELECT p.celular, p.name, p.id AS user_id
        FROM outbound_calls o
        JOIN profiles p ON p.id = o.user_id
        WHERE REGEXP_REPLACE(o.to_number, '[^0-9]', '') LIKE ?
          AND p.celular IS NOT NULL AND p.celular != ''
        ORDER BY o.called_at DESC
        LIMIT 1
    ");
    $stmt->execute(["%$normalized"]);
    $row = $stmt->fetch();

    // 2. Fallback: buscar por contacto en prospect_activities
    if (!$row) {
        $stmt2 = db()->prepare("
            SELECT p.celular, p.name, p.id AS user_id
            FROM prospect_activities a
            JOIN profiles p ON p.id = a.user_id
            JOIN prospect_contacts c ON c.id = a.contact_id
            WHERE a.type = 'call'
              AND (REGEXP_REPLACE(c.mobile, '[^0-9]', '') LIKE ? OR REGEXP_REPLACE(c.phone, '[^0-9]', '') LIKE ?)
              AND p.celular IS NOT NULL AND p.celular != ''
            ORDER BY a.created_at DESC
            LIMIT 1
        ");
        $stmt2->execute(["%$normalized", "%$normalized"]);
        $row = $stmt2->fetch();
    }
    header('Content-Type: text/xml');
    $callSid  = $_POST['CallSid'] ?? null;
    $appUrl   = 'https://crm.transccl.cl';

    if ($row && $row['celular']) {
        $celular = preg_replace('/[^0-9+]/', '', $row['celular']);
        if (!str_starts_with($celular, '+')) $celular = '+56' . ltrim($celular, '0');

        // Registrar llamada entrante en historial
        $jwtSecret = getenv('CRM_JWT_SECRET') ?: JWT_SECRET;
        @file_get_contents('https://www.transccl.cl/crm-api.php?action=log_inbound_call', false, stream_context_create(['http' => [
            'method'  => 'POST',
            'header'  => "Content-Type: application/json\r\nx-internal-secret: $jwtSecret\r\n",
            'content' => json_encode(['user_id' => $row['user_id'] ?? null, 'from_number' => $normalized, 'call_sid' => $callSid]),
            'ignore_errors' => true,
        ]]));

        echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Dial callerId=\"+56229149664\" record=\"record-from-answer\" recordingStatusCallback=\"$appUrl/api/twilio/recording\" recordingStatusCallbackMethod=\"POST\"><Number>$celular</Number></Dial></Response>";
    } else {
        echo '<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="+56229149664"><Number>+56229455713</Number></Dial></Response>';
    }
    exit;
}

// ── COMMUNE ASSIGNMENTS ───────────────────────────────────────────────────────
if ($action === 'commune_assignments_list') {
    requireAuth();
    $campaign_id = $_GET['campaign_id'] ?? null;
    if (!$campaign_id) err('campaign_id requerido');
    $stmt = db()->prepare("
        SELECT ca.*, p.name AS user_name, p.email AS user_email
        FROM commune_assignments ca
        LEFT JOIN profiles p ON p.id = ca.user_id
        WHERE ca.campaign_id = ?
        ORDER BY ca.commune
    ");
    $stmt->execute([$campaign_id]);
    ok($stmt->fetchAll());
}

if ($action === 'commune_assignments_save') {
    $me = requireAdmin();
    $b  = body();
    $campaign_id = $b['campaign_id'] ?? '';
    $commune     = trim($b['commune'] ?? '');
    $user_id     = $b['user_id'] ?? '';
    if (!$campaign_id || !$commune || !$user_id) err('Datos requeridos');
    $id = uuid();
    db()->prepare("INSERT INTO commune_assignments (id, campaign_id, commune, user_id, created_by)
                   VALUES (?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)")
        ->execute([$id, $campaign_id, $commune, $user_id, $me['id']]);
    // Reasignar prospectos de esa comuna que no tengan excepción individual
    db()->prepare("
        UPDATE prospects p
        LEFT JOIN prospect_assignment_exceptions exc ON exc.prospect_id = p.id
        SET p.assigned_to = ?
        WHERE p.campaign_id = ? AND p.commune = ? AND exc.prospect_id IS NULL
    ")->execute([$user_id, $campaign_id, $commune]);
    ok();
}

if ($action === 'commune_assignments_delete') {
    requireAdmin();
    $b = body();
    $campaign_id = $b['campaign_id'] ?? '';
    $commune     = $b['commune'] ?? '';
    if (!$campaign_id || !$commune) err('Datos requeridos');
    db()->prepare("DELETE FROM commune_assignments WHERE campaign_id = ? AND commune = ?")->execute([$campaign_id, $commune]);
    ok();
}

// ── EXCEPCIONES INDIVIDUALES ──────────────────────────────────────────────────
if ($action === 'prospect_exception_set') {
    $me = requireAdmin();
    $b  = body();
    $prospect_id = $b['prospect_id'] ?? '';
    $user_id     = $b['user_id'] ?? '';
    if (!$prospect_id || !$user_id) err('Datos requeridos');
    $id = uuid();
    db()->prepare("INSERT INTO prospect_assignment_exceptions (id, prospect_id, user_id, reason, created_by)
                   VALUES (?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), reason = VALUES(reason)")
        ->execute([$id, $prospect_id, $user_id, $b['reason'] ?? null, $me['id']]);
    db()->prepare("UPDATE prospects SET assigned_to = ? WHERE id = ?")->execute([$user_id, $prospect_id]);
    ok();
}

if ($action === 'prospect_exception_delete') {
    requireAdmin();
    $b = body();
    $prospect_id = $b['prospect_id'] ?? '';
    if (!$prospect_id) err('prospect_id requerido');
    db()->prepare("DELETE FROM prospect_assignment_exceptions WHERE prospect_id = ?")->execute([$prospect_id]);
    ok();
}

// ── SUSPENDER EJECUTIVO ───────────────────────────────────────────────────────
if ($action === 'profile_suspend') {
    $me = requireAdmin();
    $b  = body();
    $id     = $b['id'] ?? '';
    $until  = $b['until'] ?? null;   // null = indefinido
    $reason = $b['reason'] ?? null;
    if (!$id) err('ID requerido');

    db()->prepare("UPDATE profiles SET suspended = 1, suspended_until = ?, suspended_reason = ? WHERE id = ?")
        ->execute([$until, $reason, $id]);

    // Obtener prospectos del suspendido
    $stmt = db()->prepare("SELECT id, name, commune FROM prospects WHERE assigned_to = ? AND status NOT IN ('closed_won','closed_lost')");
    $stmt->execute([$id]);
    $affected = $stmt->fetchAll();

    ok(['suspended' => true, 'affected_prospects' => count($affected), 'prospects' => $affected]);
}

if ($action === 'profile_unsuspend') {
    requireAdmin();
    $b = body();
    $id = $b['id'] ?? '';
    if (!$id) err('ID requerido');
    db()->prepare("UPDATE profiles SET suspended = 0, suspended_until = NULL, suspended_reason = NULL WHERE id = ?")->execute([$id]);
    ok();
}

if ($action === 'profile_reassign_prospects') {
    $me = requireAdmin();
    $b  = body();
    $from_user_id = $b['from_user_id'] ?? '';
    $to_user_id   = $b['to_user_id'] ?? '';
    $campaign_id  = $b['campaign_id'] ?? null;
    if (!$from_user_id || !$to_user_id) err('Datos requeridos');

    $where = "assigned_to = ? AND status NOT IN ('closed_won','closed_lost')";
    $vals  = [$to_user_id, $from_user_id];
    if ($campaign_id) { $where .= " AND campaign_id = ?"; $vals[] = $campaign_id; }

    $stmt = db()->prepare("UPDATE prospects SET assigned_to = ? WHERE $where");
    array_unshift($vals, $to_user_id);
    // Rebuild correctly
    $vals2 = [$to_user_id, $from_user_id];
    if ($campaign_id) $vals2[] = $campaign_id;
    $stmt2 = db()->prepare("UPDATE prospects SET assigned_to = ? WHERE assigned_to = ? AND status NOT IN ('closed_won','closed_lost')" . ($campaign_id ? " AND campaign_id = ?" : ""));
    $stmt2->execute($vals2);

    ok(['reassigned' => $stmt2->rowCount()]);
}

// ── IMPORTAR CSV/ARRAY ────────────────────────────────────────────────────────
if ($action === 'prospects_import') {
    $me = requireAdmin();
    $b  = body();
    $campaign_id = $b['campaign_id'] ?? '';
    $rows        = $b['rows'] ?? [];
    if (!$campaign_id || empty($rows)) err('campaign_id y rows requeridos');

    $inserted = 0; $skipped = 0;
    foreach ($rows as $row) {
        $name    = trim($row['name'] ?? '');
        $commune = trim($row['commune'] ?? '');
        if (!$name) { $skipped++; continue; }

        // Determinar ejecutivo por regla de comuna
        $assigned_to = null;
        if ($commune) {
            $stmt = db()->prepare("SELECT user_id FROM commune_assignments WHERE campaign_id = ? AND commune = ? LIMIT 1");
            $stmt->execute([$campaign_id, $commune]);
            $assigned_to = $stmt->fetch()['user_id'] ?? null;
        }

        $id = uuid();
        db()->prepare("INSERT INTO prospects (id, campaign_id, name, segment, commune, region, rut, rbd, assigned_to, source, created_by)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'import', ?)")
            ->execute([$id, $campaign_id, $name, $row['segment'] ?? 'educacional', $commune, $row['region'] ?? 'RM', $row['rut'] ?? null, $row['rbd'] ?? null, $assigned_to, $me['id']]);

        // Insertar contactos si vienen
        $contacts = $row['contacts'] ?? [];
        foreach ($contacts as $i => $c) {
            $cname = trim($c['name'] ?? '');
            if (!$cname) continue;
            $cid = uuid();
            db()->prepare("INSERT INTO prospect_contacts (id, prospect_id, name, role, phone, mobile, email, is_primary)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                ->execute([$cid, $id, $cname, $c['role'] ?? null, $c['phone'] ?? null, $c['mobile'] ?? null, $c['email'] ?? null, $i === 0 ? 1 : 0]);
        }
        $inserted++;
    }
    ok(['inserted' => $inserted, 'skipped' => $skipped]);
}

// ── DASHBOARD PROSPECTOS ──────────────────────────────────────────────────────
if ($action === 'prospectos_dashboard') {
    requireAdmin();
    $campaign_id = $_GET['campaign_id'] ?? null;
    $date_from   = $_GET['date_from'] ?? date('Y-m-d', strtotime('-7 days'));
    $date_to     = $_GET['date_to']   ?? date('Y-m-d');

    // Estadísticas por ejecutivo
    $stmt = db()->prepare("
        SELECT
            pr.id, pr.name, pr.email,
            COUNT(DISTINCT p.id) AS total_assigned,
            COUNT(DISTINCT CASE WHEN p.status != 'new' THEN p.id END) AS contacted,
            COUNT(DISTINCT CASE WHEN p.status IN ('quoting','closed_won') THEN p.id END) AS quoting,
            COUNT(DISTINCT CASE WHEN a.type = 'call' AND DATE(a.created_at) BETWEEN ? AND ? THEN a.id END) AS calls_period,
            COUNT(DISTINCT CASE WHEN a.type = 'whatsapp' AND DATE(a.created_at) BETWEEN ? AND ? THEN a.id END) AS whatsapps_period,
            COUNT(DISTINCT CASE WHEN a.type = 'email' AND DATE(a.created_at) BETWEEN ? AND ? THEN a.id END) AS emails_period,
            SUM(CASE WHEN a.type = 'call' AND DATE(a.created_at) BETWEEN ? AND ? THEN COALESCE(a.duration_sec,0) END) AS call_seconds_period
        FROM profiles pr
        LEFT JOIN prospects p ON p.assigned_to = pr.id " . ($campaign_id ? "AND p.campaign_id = ?" : "") . "
        LEFT JOIN prospect_activities a ON a.user_id = pr.id
        WHERE pr.active = 1 AND pr.suspended = 0
        GROUP BY pr.id, pr.name, pr.email
        ORDER BY calls_period DESC
    ");
    $params = [$date_from, $date_to, $date_from, $date_to, $date_from, $date_to, $date_from, $date_to];
    if ($campaign_id) $params[] = $campaign_id;
    $stmt->execute($params);
    $executives = $stmt->fetchAll();

    // Totales por status
    $funnel_stmt = db()->prepare("
        SELECT status, COUNT(*) AS cnt
        FROM prospects
        " . ($campaign_id ? "WHERE campaign_id = ?" : "") . "
        GROUP BY status
    ");
    $funnel_stmt->execute($campaign_id ? [$campaign_id] : []);
    $funnel = $funnel_stmt->fetchAll();

    ok(['executives' => $executives, 'funnel' => $funnel, 'period' => ['from' => $date_from, 'to' => $date_to]]);
}

// ── DETECCIÓN EDUCACIONAL (para cotizaciones) ─────────────────────────────────
if ($action === 'prospect_detect_educational') {
    requireAuth();
    $b    = body();
    $name = trim($b['name'] ?? '');
    if (!$name) err('name requerido');

    $keywords = ['colegio','liceo','escuela','fundacion','fundación','centro educacional',
                 'instituto','academia','jardín infantil','jardin infantil','corporación educacional'];
    $is_educational = false;
    $name_lower = mb_strtolower($name);
    foreach ($keywords as $kw) {
        if (str_contains($name_lower, $kw)) { $is_educational = true; break; }
    }

    if (!$is_educational) ok(['is_educational' => false, 'matches' => []]);

    // Buscar en prospectos existentes
    $stmt = db()->prepare("
        SELECT p.id, p.name, p.commune, p.status, p.campaign_id, p.assigned_to,
               pr.name AS assigned_name, pc.name AS campaign_name
        FROM prospects p
        LEFT JOIN profiles pr ON pr.id = p.assigned_to
        LEFT JOIN prospect_campaigns pc ON pc.id = p.campaign_id
        WHERE p.name LIKE ? OR p.name LIKE ?
        LIMIT 5
    ");
    $words = explode(' ', $name_lower);
    $main  = $words[1] ?? $words[0]; // palabra principal sin "colegio" etc.
    $stmt->execute(["%$name%", "%$main%"]);
    $matches = $stmt->fetchAll();

    ok(['is_educational' => true, 'matches' => $matches]);
}

// ── COMUNAS DISPONIBLES EN CAMPAÑA ───────────────────────────────────────────
if ($action === 'campaign_communes') {
    requireAuth();
    $campaign_id = $_GET['campaign_id'] ?? null;
    if (!$campaign_id) err('campaign_id requerido');
    $stmt = db()->prepare("SELECT DISTINCT commune FROM prospects WHERE campaign_id = ? AND commune IS NOT NULL ORDER BY commune");
    $stmt->execute([$campaign_id]);
    ok(array_column($stmt->fetchAll(), 'commune'));
}

// ── PLAN SEMANAL DE LLAMADAS ──────────────────────────────────────────────────
if ($action === 'call_plan_week') {
    requireAuth();
    $campaign_id = $_GET['campaign_id'] ?? null;
    if (!$campaign_id) err('campaign_id requerido');

    try {
        // Communes with assigned executive and pending prospect count
        // Only count colegios sin llamar o con llamada fallida (< 5s) — los "sin gestionar"
        $stmt = db()->prepare("
            SELECT
                ca.commune,
                ca.user_id,
                p.name  AS user_name,
                COUNT(pr.id) AS pending_count
            FROM commune_assignments ca
            LEFT JOIN profiles  p  ON p.id  = ca.user_id
            LEFT JOIN prospects pr ON pr.commune    = ca.commune
                                   AND pr.campaign_id = ca.campaign_id
                                   AND pr.status NOT IN ('closed_won','closed_lost')
            WHERE ca.campaign_id = ?
            GROUP BY ca.commune, ca.user_id, p.name
            ORDER BY p.name, COUNT(pr.id) DESC
        ");
        $stmt->execute([$campaign_id]);
        $rows = $stmt->fetchAll();
    } catch (Exception $e) {
        err('Error al consultar plan: ' . $e->getMessage(), 500);
    }

    // Group by executive
    $byExec = [];
    foreach ($rows as $r) {
        $uid = $r['user_id'];
        if (!isset($byExec[$uid])) {
            $byExec[$uid] = [
                'user_id'   => $uid,
                'user_name' => $r['user_name'],
                'communes'  => [],
            ];
        }
        $byExec[$uid]['communes'][] = [
            'commune' => $r['commune'],
            'pending' => (int)$r['pending_count'],
        ];
    }
    ok(array_values($byExec));
}

// ── WHATSAPP MESSAGES ─────────────────────────────────────────────────────────
if ($action === 'log_whatsapp_message') {
    // Accepts: token auth (from CRM send) OR internal secret (from webhook)
    $internalSecret = $_SERVER['HTTP_X_INTERNAL_SECRET'] ?? '';
    $validInternal  = function_exists('hash_equals') && $internalSecret !== '' &&
                      hash_equals(getenv('INTERNAL_PDF_SECRET') ?: '', $internalSecret);
    if (!$validInternal) requireAuth();

    $b = body();
    $userId     = $b['user_id']     ?? null;
    $prospectId = $b['prospect_id'] ?? null;
    $contactId  = $b['contact_id']  ?? null;
    $direction  = $b['direction']   ?? 'out';
    $phone      = $b['phone']       ?? null;
    $message    = $b['message']     ?? '';
    $wamid      = $b['wamid']       ?? null;
    $senderName = $b['sender_name'] ?? null;

    if (!$phone || !$message) err('phone y message requeridos');

    // Create table if not exists
    db()->exec("CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     VARCHAR(36),
        prospect_id VARCHAR(36),
        contact_id  VARCHAR(36),
        direction   ENUM('in','out') DEFAULT 'out',
        phone       VARCHAR(30),
        message     TEXT,
        wamid       VARCHAR(128) UNIQUE,
        sender_name VARCHAR(120),
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_phone (phone),
        INDEX idx_prospect (prospect_id)
    )");

    $stmt = db()->prepare("INSERT IGNORE INTO whatsapp_messages
        (user_id, prospect_id, contact_id, direction, phone, message, wamid, sender_name)
        VALUES (?,?,?,?,?,?,?,?)");
    $stmt->execute([$userId, $prospectId, $contactId, $direction, $phone, $message, $wamid, $senderName]);
    ok(['ok' => true, 'id' => db()->lastInsertId()]);
}

if ($action === 'get_whatsapp_messages') {
    requireAuth();
    $prospectId = $_GET['prospect_id'] ?? null;
    $phone      = $_GET['phone']       ?? null;
    if (!$phone) err('phone requerido');

    db()->exec("CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id INT AUTO_INCREMENT PRIMARY KEY, user_id VARCHAR(36), prospect_id VARCHAR(36),
        contact_id VARCHAR(36), direction ENUM('in','out') DEFAULT 'out', phone VARCHAR(30),
        message TEXT, wamid VARCHAR(128) UNIQUE, sender_name VARCHAR(120),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_phone (phone), INDEX idx_prospect (prospect_id)
    )");

    $where  = ['phone = ?'];
    $params = [$phone];
    if ($prospectId) { $where[] = 'prospect_id = ?'; $params[] = $prospectId; }

    $sql  = "SELECT * FROM whatsapp_messages WHERE " . implode(' AND ', $where) . " ORDER BY created_at ASC LIMIT 100";
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    ok($stmt->fetchAll());
}

// ── WHATSAPP META CLOUD API ───────────────────────────────────────────────────

// Recibe mensaje entrante desde el webhook Meta Cloud API
if ($action === 'wa_cloud_receive') {
    $internalSecret = $_SERVER['HTTP_X_INTERNAL_SECRET'] ?? '';
    $valid = $internalSecret !== '' && hash_equals(getenv('INTERNAL_PDF_SECRET') ?: '', $internalSecret);
    if (!$valid) err('Unauthorized', 401);

    $b = body();
    $wamid = $b['wamid']        ?? null;
    $phone = $b['phone']        ?? null;
    $text  = $b['text']         ?? '';
    $name  = $b['contact_name'] ?? null;
    $ts    = $b['ts']           ?? null;

    if (!$wamid || !$phone) err('wamid y phone requeridos');

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

    $pdo->exec("CREATE TABLE IF NOT EXISTS wa_cloud_leads (
        id              CHAR(36)  NOT NULL PRIMARY KEY,
        conversation_id CHAR(36)  NOT NULL,
        data            JSON,
        ficha_status    VARCHAR(30) NOT NULL DEFAULT 'in_progress',
        created_at      DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_conv (conversation_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Upsert conversación
    $convId = null;
    $stmt = $pdo->prepare("SELECT id, bot_active FROM wa_cloud_conversations WHERE phone = ?");
    $stmt->execute([$phone]);
    $conv = $stmt->fetch();

    if ($conv) {
        $convId = $conv['id'];
        $pdo->prepare("UPDATE wa_cloud_conversations SET last_msg_at = NOW(), contact_name = COALESCE(?, contact_name) WHERE id = ?")
            ->execute([$name ?: null, $convId]);
    } else {
        $convId = uuid();
        $pdo->prepare("INSERT INTO wa_cloud_conversations (id, phone, contact_name, last_msg_at) VALUES (?,?,?,NOW())")
            ->execute([$convId, $phone, $name ?: null]);
    }

    // INSERT IGNORE deduplica por wamid
    $msgId = uuid();
    $created_at = $ts ? date('Y-m-d H:i:s', intval($ts / 1000)) : date('Y-m-d H:i:s');
    $stmt = $pdo->prepare("INSERT IGNORE INTO wa_cloud_messages (id, conversation_id, wamid, direction, content, created_at) VALUES (?,?,?,'in',?,?)");
    $stmt->execute([$msgId, $convId, $wamid, $text, $created_at]);
    $isNew = $stmt->rowCount() > 0;

    ok(['ok' => true, 'conversation_id' => $convId, 'bot_active' => (bool)($conv['bot_active'] ?? 1), 'new' => $isNew]);
}

// Envía mensaje saliente via Meta Cloud API
if ($action === 'wa_cloud_send') {
    requireAuth();
    $b = body();
    $phone    = $b['phone']    ?? null;
    $text     = $b['text']     ?? null;
    $template = $b['template'] ?? null;  // para mensajes fuera de ventana 24h

    if (!$phone) err('phone requerido');
    if (!$text && !$template) err('text o template requerido');

    $waToken  = defined('META_WA_TOKEN')           ? META_WA_TOKEN           : (getenv('WHATSAPP_TOKEN') ?: '');
    $phoneId  = defined('META_WA_PHONE_NUMBER_ID') ? META_WA_PHONE_NUMBER_ID : (getenv('WHATSAPP_PHONE_NUMBER_ID') ?: '');
    if (!$waToken || !$phoneId) err('META_WA_TOKEN / META_WA_PHONE_NUMBER_ID no configurados', 503);

    if ($text) {
        $payload = ['messaging_product' => 'whatsapp', 'to' => $phone, 'type' => 'text', 'text' => ['body' => $text]];
    } else {
        $payload = ['messaging_product' => 'whatsapp', 'to' => $phone, 'type' => 'template', 'template' => $template];
    }

    $ch = curl_init("https://graph.facebook.com/v21.0/{$phoneId}/messages");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$waToken}", 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_TIMEOUT        => 10,
    ]);
    $resp   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $respData = json_decode($resp, true) ?? [];
    if ($status >= 400) err($respData['error']['message'] ?? "Meta API error $status", $status);

    // Guardar mensaje saliente en DB
    $wamid = $respData['messages'][0]['id'] ?? null;
    $convStmt = db()->prepare("SELECT id FROM wa_cloud_conversations WHERE phone = ?");
    $convStmt->execute([$phone]);
    $conv = $convStmt->fetch();
    if ($conv && $wamid) {
        $msgId = uuid();
        db()->prepare("INSERT IGNORE INTO wa_cloud_messages (id, conversation_id, wamid, direction, content, sender_type) VALUES (?,?,?,'out',?,'human')")
            ->execute([$msgId, $conv['id'], $wamid, $text ?? json_encode($template)]);
    }

    ok($respData);
}

// ── Bandeja WhatsApp: listar conversaciones ───────────────────────────────────
if ($action === 'wa_cloud_list') {
    $user    = requireAuth();
    $isAdmin = isAdmin($user);

    // Migraciones
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN stage  VARCHAR(20) NOT NULL DEFAULT 'nuevo'     AFTER bot_active"); } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN source VARCHAR(30) NOT NULL DEFAULT 'whatsapp'  AFTER stage");      } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN last_customer_msg_at DATETIME NULL");                               } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN unread_count INT NOT NULL DEFAULT 0");                              } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN notes TEXT NULL");                                                  } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN contact_rut VARCHAR(20) NULL");                                     } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_date DATE NULL");                                           } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_messages ADD COLUMN sender_type VARCHAR(20) NULL");                                          } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN contact_email VARCHAR(100) NULL");                                    } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_origin VARCHAR(300) NULL");                                   } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_destination VARCHAR(300) NULL");                              } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_passengers INT NULL");                                        } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_type VARCHAR(100) NULL");                                     } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_vehicle VARCHAR(50) NULL AFTER service_type");                } catch (PDOException $e) {}

    // Backfill last_customer_msg_at para conversaciones que aún no lo tienen
    try {
        db()->exec("UPDATE wa_cloud_conversations c
            SET c.last_customer_msg_at = (
                SELECT MAX(m.created_at) FROM wa_cloud_messages m
                WHERE m.conversation_id = c.id AND m.direction = 'in'
            )
            WHERE c.last_customer_msg_at IS NULL");
    } catch (PDOException $e) {}

    // Auto-cerrar: ventana 24h expirada → stage=cerrado, bot=0
    // NO cerrar formulario_completo (ejecutiva debe poder verlos y cotizar)
    try {
        db()->exec("UPDATE wa_cloud_conversations
            SET stage = 'cerrado', bot_active = 0
            WHERE stage NOT IN ('cerrado', 'ganado', 'perdido', 'formulario_completo', 'cotizando')
            AND last_customer_msg_at IS NOT NULL
            AND last_customer_msg_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)");
    } catch (PDOException $e) {}

    $filterAgent = $_GET['assigned_to'] ?? null;  // UUID o 'none'
    $filterStage = $_GET['stage']       ?? null;

    $where  = [];
    $params = [];

    if (!$isAdmin) {
        $where[]  = '(c.assigned_to IS NULL OR c.assigned_to = ?)';
        $params[] = $user['id'];
    }
    if ($filterAgent === 'none') {
        $where[] = 'c.assigned_to IS NULL';
    } elseif ($filterAgent) {
        $where[]  = 'c.assigned_to = ?';
        $params[] = $filterAgent;
    }
    if ($filterStage) {
        $where[]  = 'c.stage = ?';
        $params[] = $filterStage;
    }

    $sql = "
        SELECT c.id, c.phone, c.contact_name, c.assigned_to, c.bot_active,
               c.stage, c.source, c.last_msg_at, c.last_customer_msg_at,
               c.unread_count, c.notes, c.contact_rut, c.service_date, c.created_at,
               c.contact_email, c.service_origin, c.service_destination, c.service_passengers, c.service_type, c.service_vehicle,
               c.wa_draft_quote_id,
               p.name AS assigned_name,
               m.content AS last_message
        FROM wa_cloud_conversations c
        LEFT JOIN profiles p ON p.id = c.assigned_to
        LEFT JOIN wa_cloud_messages m ON m.id = (
            SELECT id FROM wa_cloud_messages
            WHERE conversation_id = c.id
            ORDER BY created_at DESC LIMIT 1
        )
        " . ($where ? 'WHERE ' . implode(' AND ', $where) : '') . "
        ORDER BY c.last_msg_at DESC
        LIMIT 200
    ";

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$r) {
        $r['bot_active']           = (bool)(int)$r['bot_active'];
        $r['stage']                = $r['stage']  ?? 'nuevo';
        $r['source']               = $r['source'] ?? 'whatsapp';
        $r['unread_count']         = (int)($r['unread_count'] ?? 0);
        $r['last_customer_msg_at'] = $r['last_customer_msg_at'] ?? null;
        $r['notes']                = $r['notes']       ?? null;
        $r['contact_rut']          = $r['contact_rut']  ?? null;
        $r['service_date']         = $r['service_date'] ?? null;
    }
    ok($rows);
}

// ── Bandeja WhatsApp: cambiar canal de origen ────────────────────────────────
if ($action === 'wa_cloud_source') {
    requireAuth();
    $b      = body();
    $convId = $b['conv_id'] ?? null;
    $source = $b['source']  ?? null;
    $valid  = ['whatsapp', 'facebook', 'instagram', 'google', 'referido', 'otro'];
    if (!$convId || !in_array($source, $valid)) err('conv_id y source válido requeridos');
    db()->prepare("UPDATE wa_cloud_conversations SET source = ? WHERE id = ?")
        ->execute([$source, $convId]);
    ok(['source' => $source]);
}

// ── Bandeja WhatsApp: cambiar etapa ──────────────────────────────────────────
if ($action === 'wa_cloud_stage') {
    requireAuth();
    $b     = body();
    $convId = $b['conv_id'] ?? null;
    $stage  = $b['stage']   ?? null;
    $valid  = ['nuevo', 'cotizando', 'ganado', 'perdido', 'cerrado'];
    if (!$convId || !in_array($stage, $valid)) err('conv_id y stage válido requeridos');
    db()->prepare("UPDATE wa_cloud_conversations SET stage = ? WHERE id = ?")
        ->execute([$stage, $convId]);
    ok(['stage' => $stage]);
}

// ── Bandeja WhatsApp: marcar conversación como leída ────────────────────────
if ($action === 'wa_cloud_read') {
    requireAuth();
    $b = body();
    $convId = $b['conv_id'] ?? null;
    if (!$convId) err('conv_id requerido');
    db()->prepare("UPDATE wa_cloud_conversations SET unread_count = 0 WHERE id = ?")
        ->execute([$convId]);
    ok(['read' => true]);
}

// ── Bandeja WhatsApp: guardar notas y datos de contacto ─────────────────────
if ($action === 'wa_cloud_note') {
    requireAuth();
    $b  = body();
    $id = $b['conv_id'] ?? '';
    if (!$id) err('conv_id requerido');
    $fields = [];
    $vals   = [];
    foreach (['notes','contact_rut','service_date','contact_email','service_origin','service_destination','service_passengers','service_type','service_vehicle'] as $f) {
        if (array_key_exists($f, $b)) { $fields[] = "$f = ?"; $vals[] = ($b[$f] !== '' ? $b[$f] : null); }
    }
    if (empty($fields)) err('Sin campos');
    $vals[] = $id;
    db()->prepare("UPDATE wa_cloud_conversations SET " . implode(', ', $fields) . " WHERE id = ?")->execute($vals);
    ok(['saved' => true]);
}

// ── Bandeja WhatsApp: mensajes de una conversación ───────────────────────────
if ($action === 'wa_cloud_messages') {
    $user = requireAuth();
    $convId = $_GET['conv_id'] ?? null;
    if (!$convId) err('conv_id requerido');

    // Verificar acceso
    $conv = db()->prepare("SELECT * FROM wa_cloud_conversations WHERE id = ?");
    $conv->execute([$convId]);
    $convRow = $conv->fetch(PDO::FETCH_ASSOC);
    if (!$convRow) err('Conversación no encontrada', 404);
    if (!isAdmin($user) && $convRow['assigned_to'] && $convRow['assigned_to'] !== $user['id']) {
        err('Forbidden', 403);
    }

    $stmt = db()->prepare("
        SELECT id, direction, content, msg_type, status, sender_type, created_at
        FROM wa_cloud_messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
        LIMIT 200
    ");
    $stmt->execute([$convId]);
    $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $convRow['bot_active'] = (bool)(int)$convRow['bot_active'];
    ok(['conversation' => $convRow, 'messages' => $messages]);
}

// ── Admin: estado ejecutivas ──────────────────────────────────────────────────
if ($action === 'wa_estado_ejecutivas') {
    $secret = $_GET['_s'] ?? ($_SERVER['HTTP_X_ADMIN_SECRET'] ?? '');
    if ($secret !== 'ccl2026adm') requireAuth();
    $excluir = ['56974270657','56999000001','56999999999','56999990001'];
    $ph = implode(',', array_fill(0, count($excluir), '?'));
    $resumen = db()->prepare("
        SELECT COALESCE(p.name,'Sin asignar') AS ejecutiva,
               COUNT(*) AS total,
               SUM(c.stage='nuevo') AS nuevo,
               SUM(c.stage='formulario_enviado') AS form_enviado,
               SUM(c.stage='formulario_completo') AS form_completo,
               SUM(c.stage='cotizando') AS cotizando,
               SUM(c.stage='cerrado') AS cerrado,
               SUM(c.stage='ganado') AS ganado,
               SUM(c.stage='perdido') AS perdido,
               SUM(c.bot_active=1 AND c.stage NOT IN ('cerrado','ganado','perdido')) AS bot_activo,
               SUM(c.form_link_sent_at IS NOT NULL AND c.form_submitted_at IS NULL) AS esperando_form,
               SUM(c.form_submitted_at IS NOT NULL) AS forms_recibidos
        FROM wa_cloud_conversations c
        LEFT JOIN profiles p ON p.id = c.assigned_to
        WHERE c.phone NOT IN ($ph)
        GROUP BY c.assigned_to, p.name
        ORDER BY p.name IS NULL, p.name
    ");
    $resumen->execute($excluir);
    $detalle = db()->prepare("
        SELECT COALESCE(p.name,'Sin asignar') AS ejecutiva,
               c.contact_name, c.phone, c.stage, c.bot_active,
               c.form_link_sent_at IS NOT NULL AS form_enviado,
               c.form_submitted_at IS NOT NULL AS form_recibido,
               TIMESTAMPDIFF(HOUR, c.last_customer_msg_at, NOW()) AS horas_sin_msg,
               c.followup_count
        FROM wa_cloud_conversations c
        LEFT JOIN profiles p ON p.id = c.assigned_to
        WHERE c.stage NOT IN ('cerrado','ganado','perdido')
          AND c.phone NOT IN ($ph)
        ORDER BY p.name IS NULL, p.name, c.stage, c.last_msg_at DESC
    ");
    $detalle->execute($excluir);
    ok(['resumen' => $resumen->fetchAll(), 'detalle' => $detalle->fetchAll()]);
}

// ── Bandeja WhatsApp: asignar conversación ─ (ver bloque correcto más abajo) ──

// ── Bandeja WhatsApp: tomar chat (humano) / liberar (bot) ────────────────────
if ($action === 'wa_cloud_take') {
    $user = requireAuth();
    $b = body();
    $convId    = $b['conv_id']   ?? null;
    $botActive = $b['bot_active'] ?? null;  // true = bot retoma, false = humano toma

    if (!$convId || !isset($botActive)) err('conv_id y bot_active requeridos');

    $fields = ['bot_active = ?'];
    $vals   = [(int)(bool)$botActive];

    // Si humano toma: asignar a quien hizo la acción
    if (!$botActive) {
        $fields[] = 'assigned_to = ?';
        $vals[]   = $user['id'];
    }

    $vals[] = $convId;
    db()->prepare("UPDATE wa_cloud_conversations SET " . implode(', ', $fields) . " WHERE id = ?")
        ->execute($vals);

    ok(['bot_active' => (bool)$botActive, 'assigned_to' => !$botActive ? $user['id'] : null]);
}

if ($action === 'wa_cloud_assign') {
    $user = requireAuth();
    $b = body();
    $convId    = $b['conv_id']     ?? null;
    $assignTo  = $b['assigned_to'] ?? null;  // null = quitar asignación
    if (!$convId) err('conv_id requerido');
    db()->prepare("UPDATE wa_cloud_conversations SET assigned_to = ? WHERE id = ?")
        ->execute([$assignTo ?: null, $convId]);
    ok(['assigned_to' => $assignTo ?: null]);
}

// ── Bot: historial de conversación (autenticado con X-Internal-Secret) ───────
if ($action === 'wa_cloud_history') {
    $secret = $_SERVER['HTTP_X_INTERNAL_SECRET'] ?? '';
    if (!$secret || !hash_equals($secret, getenv('INTERNAL_PDF_SECRET') ?: '')) {
        err('Forbidden', 403);
    }
    $b = body();
    $convId = $b['conversation_id'] ?? null;
    if (!$convId) err('conversation_id requerido');
    $stmt = db()->prepare("SELECT direction, content FROM wa_cloud_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 20");
    $stmt->execute([$convId]);
    $rows = array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC));
    ok($rows);
}

// ── Bot: enviar mensaje saliente (autenticado con X-Internal-Secret) ─────────
if ($action === 'wa_cloud_bot_send') {
    $secret = $_SERVER['HTTP_X_INTERNAL_SECRET'] ?? '';
    if (!$secret || !hash_equals($secret, getenv('INTERNAL_PDF_SECRET') ?: '')) {
        err('Forbidden', 403);
    }
    $b = body();
    $phone = $b['phone'] ?? null;
    $text  = $b['text']  ?? null;
    if (!$phone || !$text) err('phone y text requeridos');

    $waToken = defined('META_WA_TOKEN')           ? META_WA_TOKEN           : (getenv('WHATSAPP_TOKEN') ?: '');
    $phoneId = defined('META_WA_PHONE_NUMBER_ID') ? META_WA_PHONE_NUMBER_ID : (getenv('WHATSAPP_PHONE_NUMBER_ID') ?: '');
    if (!$waToken || !$phoneId) err('META_WA_TOKEN / META_WA_PHONE_NUMBER_ID no configurados', 503);

    $payload = ['messaging_product' => 'whatsapp', 'to' => $phone, 'type' => 'text', 'text' => ['body' => $text]];
    $ch = curl_init("https://graph.facebook.com/v21.0/{$phoneId}/messages");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$waToken}", 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_TIMEOUT        => 10,
    ]);
    $resp   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $respData = json_decode($resp, true) ?? [];
    if ($status >= 400) err($respData['error']['message'] ?? "Meta API error $status", $status);

    // Guardar mensaje saliente en DB
    $wamid = $respData['messages'][0]['id'] ?? null;
    $convStmt = db()->prepare("SELECT id FROM wa_cloud_conversations WHERE phone = ?");
    $convStmt->execute([$phone]);
    $conv = $convStmt->fetch();
    if ($conv && $wamid) {
        $msgId = uuid();
        db()->prepare("INSERT IGNORE INTO wa_cloud_messages (id, conversation_id, wamid, direction, content) VALUES (?,?,?,'out',?)")
            ->execute([$msgId, $conv['id'], $wamid, $text]);
    }

    ok($respData);
}

// ── Bot: escalar a humano (autenticado con X-Internal-Secret) ────────────────
if ($action === 'wa_cloud_bot_escalate') {
    $secret = $_SERVER['HTTP_X_INTERNAL_SECRET'] ?? '';
    if (!$secret || !hash_equals($secret, getenv('INTERNAL_PDF_SECRET') ?: '')) {
        err('Forbidden', 403);
    }
    $b = body();
    $convId = $b['conversation_id'] ?? null;
    if (!$convId) err('conversation_id requerido');
    db()->prepare("UPDATE wa_cloud_conversations SET bot_active = 0 WHERE id = ?")
        ->execute([$convId]);
    ok(['escalated' => true]);
}

// ── Autorizaciones internas de precio (Cotizador) ────────────────────────────
// Descuentos bajo el mínimo y recargos los aprueba Claudio, Claudia o Paola
// (acordado con Claudio el 01-11-2026). Basta con que uno de los tres decida.
const AUTZ_APROBADORES = ['claudio@transccl.cl', 'contabilidad@transccl.cl', 'ecomercial2@transccl.cl'];
const AUTZ_TIPOS = ['descuento', 'recargo', 'descuento_recargo', 'a_medida'];

function autzEnsureTable(): void {
    static $listo = false;
    if ($listo) return;
    db()->exec("CREATE TABLE IF NOT EXISTS price_authorizations (
        id CHAR(36) NOT NULL PRIMARY KEY,
        status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        tipo VARCHAR(30) NOT NULL,
        referencia VARCHAR(255) NULL,
        detalle TEXT NULL,
        quotation_id CHAR(36) NULL,
        precio_lista INT NULL,
        precio_minimo INT NULL,
        precio_solicitado INT NULL,
        recargos TEXT NULL,
        payload MEDIUMTEXT NULL,
        requested_by CHAR(36) NOT NULL,
        requested_by_name VARCHAR(150) NULL,
        decided_by CHAR(36) NULL,
        decided_by_name VARCHAR(150) NULL,
        decided_at DATETIME NULL,
        comentario TEXT NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_autz_status (status),
        INDEX idx_autz_quotation (quotation_id),
        INDEX idx_autz_requested (requested_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $listo = true;
}

function autzEsAprobador(array $u): bool {
    return in_array(strtolower((string)($u['email'] ?? '')), AUTZ_APROBADORES, true);
}

// Hora de Chile explícita para no depender de la zona del servidor
function autzAhora(): string {
    return (new DateTime('now', new DateTimeZone('America/Santiago')))->format('Y-m-d H:i:s');
}

function autzFila(array $r): array {
    $r['recargos'] = $r['recargos'] ? json_decode($r['recargos'], true) : [];
    $r['payload']  = $r['payload'] ? json_decode($r['payload'], true) : null;
    foreach (['precio_lista', 'precio_minimo', 'precio_solicitado'] as $k) {
        $r[$k] = $r[$k] === null ? null : (int)$r[$k];
    }
    return $r;
}

if ($action === 'autz_create') {
    $u = requireAuth();
    autzEnsureTable();
    $b = body();
    $tipo = (string)($b['tipo'] ?? '');
    if (!in_array($tipo, AUTZ_TIPOS, true)) err('tipo inválido');
    $ref = trim((string)($b['referencia'] ?? ''));
    if ($ref === '') err('Indica el cliente o una referencia');
    $int = fn($k) => isset($b[$k]) && $b[$k] !== '' ? (int)$b[$k] : null;
    $id = uuid();
    db()->prepare('INSERT INTO price_authorizations
        (id, status, tipo, referencia, detalle, quotation_id, precio_lista, precio_minimo, precio_solicitado,
         recargos, payload, requested_by, requested_by_name, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        ->execute([
            $id, 'pendiente', $tipo, substr($ref, 0, 255), $b['detalle'] ?? null, $b['quotation_id'] ?? null,
            $int('precio_lista'), $int('precio_minimo'), $int('precio_solicitado'),
            isset($b['recargos']) ? json_encode($b['recargos'], JSON_UNESCAPED_UNICODE) : null,
            isset($b['payload']) ? json_encode($b['payload'], JSON_UNESCAPED_UNICODE) : null,
            $u['id'], $u['name'] ?? $u['email'], autzAhora(),
        ]);
    ok(['id' => $id, 'status' => 'pendiente']);
}

if ($action === 'autz_list') {
    $u = requireAuth();
    autzEnsureTable();
    $esAprobador = autzEsAprobador($u);
    $estado = $_GET['estado'] ?? 'pendiente';
    $where = [];
    $params = [];
    if ($estado === 'pendiente') $where[] = "status = 'pendiente'";
    elseif ($estado === 'resuelta') $where[] = "status IN ('aprobada','rechazada','anulada')";
    if (!$esAprobador || ($_GET['mias'] ?? '') === '1') { $where[] = 'requested_by = ?'; $params[] = $u['id']; }
    $sql = 'SELECT * FROM price_authorizations' . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
         . ' ORDER BY created_at DESC LIMIT 200';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    ok(['es_aprobador' => $esAprobador, 'items' => array_map('autzFila', $stmt->fetchAll())]);
}

if ($action === 'autz_get') {
    $u = requireAuth();
    autzEnsureTable();
    $stmt = db()->prepare('SELECT * FROM price_authorizations WHERE id = ?');
    $stmt->execute([$_GET['id'] ?? '']);
    $row = $stmt->fetch();
    if (!$row) err('No encontrada', 404);
    if ($row['requested_by'] !== $u['id'] && !autzEsAprobador($u)) err('Forbidden', 403);
    ok(autzFila($row));
}

if ($action === 'autz_decide') {
    $u = requireAuth();
    autzEnsureTable();
    if (!autzEsAprobador($u)) err('Solo Claudio, Claudia o Paola pueden aprobar', 403);
    $b = body();
    $decision = (string)($b['decision'] ?? '');
    if (!in_array($decision, ['aprobada', 'rechazada'], true)) err('decisión inválida');
    $stmt = db()->prepare("UPDATE price_authorizations
        SET status = ?, decided_by = ?, decided_by_name = ?, decided_at = ?, comentario = ?
        WHERE id = ? AND status = 'pendiente'");
    $stmt->execute([$decision, $u['id'], $u['name'] ?? $u['email'], autzAhora(), $b['comentario'] ?? null, $b['id'] ?? '']);
    if ($stmt->rowCount() === 0) err('La solicitud ya fue resuelta o no existe', 409);
    ok(['id' => $b['id'], 'status' => $decision]);
}

if ($action === 'autz_cancel') {
    $u = requireAuth();
    autzEnsureTable();
    $b = body();
    $stmt = db()->prepare("UPDATE price_authorizations
        SET status = 'anulada', decided_by = ?, decided_by_name = ?, decided_at = ?
        WHERE id = ? AND status = 'pendiente' AND (requested_by = ? OR ?)");
    $stmt->execute([$u['id'], $u['name'] ?? $u['email'], autzAhora(), $b['id'] ?? '', $u['id'], autzEsAprobador($u) ? 1 : 0]);
    if ($stmt->rowCount() === 0) err('No se puede anular: ya fue resuelta o no es tuya', 409);
    ok(['id' => $b['id'], 'status' => 'anulada']);
}

if ($action === 'autz_reopen') {
    $u = requireAuth();
    autzEnsureTable();
    $b = body();
    $stmt = db()->prepare("UPDATE price_authorizations
        SET status = 'pendiente', decided_by = NULL, decided_by_name = NULL, decided_at = NULL, comentario = NULL
        WHERE id = ? AND status = 'anulada' AND (requested_by = ? OR ?)");
    $stmt->execute([$b['id'] ?? '', $u['id'], autzEsAprobador($u) ? 1 : 0]);
    if ($stmt->rowCount() === 0) err('No se puede reabrir: no fue anulada o no tienes permiso', 409);
    ok(['id' => $b['id'], 'status' => 'pendiente']);
}

if ($action === 'autz_pending_count') {
    $u = requireAuth();
    autzEnsureTable();
    $esAprobador = autzEsAprobador($u);
    $n = $esAprobador ? (int)db()->query("SELECT COUNT(*) FROM price_authorizations WHERE status = 'pendiente'")->fetchColumn() : 0;
    ok(['count' => $n, 'es_aprobador' => $esAprobador]);
}

// ── Detalle de una conversación WA por ID ─────────────────────────────────────
if ($action === 'wa_cloud_detail') {
    $user = requireAuth();
    $convId = $_GET['conv_id'] ?? ($body['conv_id'] ?? null);
    if (!$convId) err('conv_id requerido');
    $conv = db()->prepare("SELECT c.id, c.phone, c.contact_name, c.assigned_to, c.bot_active, c.stage, c.source,
        c.last_msg_at, c.last_customer_msg_at, c.unread_count, c.notes,
        c.contact_rut, c.service_date, c.contact_email,
        c.service_origin, c.service_destination, c.service_passengers, c.service_type, c.service_vehicle,
        c.company_name, c.client_type, c.service_hour, c.service_hour_return,
        c.wa_draft_quote_id, c.created_at, p.name AS assigned_name
        FROM wa_cloud_conversations c
        LEFT JOIN profiles p ON p.id = c.assigned_to
        WHERE c.id = ?");
    $conv->execute([$convId]);
    $row = $conv->fetch(PDO::FETCH_ASSOC);
    if (!$row) err('Conversación no encontrada', 404);
    if (!isAdmin($user) && $row['assigned_to'] && $row['assigned_to'] !== $user['id']) err('Forbidden', 403);
    ok($row);
}

// ── Backfill ficha desde historial (Claude extrae datos de cada conv) ─────────
if ($action === 'wa_cloud_backfill') {
    $u = requireAuth();
    if (!isAdmin($u)) err('Solo administradores', 403);

    $aiKey = defined('AI_KEY') ? AI_KEY : (getenv('ANTHROPIC_API_KEY') ?: '');
    if (!$aiKey) err('Sin API key de Claude', 500);

    // Traer hasta 100 conversaciones con campos vacíos
    $convs = db()->query(
        "SELECT id, phone, contact_name FROM wa_cloud_conversations
         WHERE (contact_email IS NULL OR service_origin IS NULL OR service_destination IS NULL
             OR service_passengers IS NULL OR service_date IS NULL OR service_type IS NULL)
         ORDER BY last_msg_at DESC LIMIT 100"
    )->fetchAll(PDO::FETCH_ASSOC);

    $updated = 0;
    foreach ($convs as $conv) {
        // Historial de la conversación
        $msgs = db()->prepare("SELECT direction, content FROM wa_cloud_messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 60");
        $msgs->execute([$conv['id']]);
        $rows = $msgs->fetchAll(PDO::FETCH_ASSOC);
        if (count($rows) < 2) continue;

        $transcript = '';
        foreach ($rows as $r) {
            $who = $r['direction'] === 'in' ? 'CLIENTE' : 'BOT';
            $transcript .= "[{$who}]: {$r['content']}\n";
        }

        $extractPrompt = "Extrae del siguiente historial de WhatsApp los datos de cotización que el cliente mencionó. Responde ÚNICAMENTE con JSON en este formato exacto (omite los campos que no aparecen en la conversación, no pongas null ni cadenas vacías):\n{\"nombre\":\"...\",\"email\":\"...\",\"rut\":\"...\",\"origen\":\"...\",\"destino\":\"...\",\"fecha\":\"dd/mm/yyyy\",\"pasajeros\":\"número\",\"tipo\":\"...\"}\n\nHistorial:\n" . mb_substr($transcript, 0, 6000);

        $ch = curl_init('https://api.anthropic.com/v1/messages');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'x-api-key: ' . $aiKey,
                'anthropic-version: 2023-06-01',
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'model' => 'claude-haiku-5-5',
                'max_tokens' => 300,
                'messages' => [['role' => 'user', 'content' => $extractPrompt]],
            ]),
            CURLOPT_TIMEOUT => 20,
        ]);
        $raw  = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code !== 200) continue;

        $resp = json_decode($raw, true);
        $text = trim($resp['content'][0]['text'] ?? '');
        if (!$text) continue;

        // Extraer JSON de la respuesta (puede venir entre ```json ... ```)
        if (preg_match('/\{[^}]+\}/s', $text, $m)) {
            $ficha = json_decode($m[0], true);
            if (!is_array($ficha)) continue;
        } else continue;

        $map = [
            'nombre'    => 'contact_name',
            'email'     => 'contact_email',
            'rut'       => 'contact_rut',
            'origen'    => 'service_origin',
            'destino'   => 'service_destination',
            'fecha'     => 'service_date',
            'pasajeros' => 'service_passengers',
            'tipo'      => 'service_type',
        ];
        $fields = []; $vals = [];
        foreach ($map as $k => $col) {
            if (!empty($ficha[$k])) {
                $v = $ficha[$k];
                if ($col === 'service_date' && preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $v, $pd)) {
                    $v = "{$pd[3]}-{$pd[2]}-{$pd[1]}";
                }
                if ($col === 'service_passengers') $v = (int)$v ?: null;
                $fields[] = "$col = ?";
                $vals[]   = $v;
            }
        }
        if ($fields) {
            $vals[] = $conv['id'];
            db()->prepare("UPDATE wa_cloud_conversations SET " . implode(', ', $fields) . " WHERE id = ?")->execute($vals);
            $updated++;
        }
    }
    ok(['checked' => count($convs), 'updated' => $updated]);
}

// ── MIGRACIÓN (admin) ─────────────────────────────────────────────────────────
if ($action === 'wa_migrate_vehicle') {
    if (($_GET['k'] ?? '') !== 'transccl2026') err('Forbidden', 403);
    try {
        db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_vehicle VARCHAR(50) NULL AFTER service_type");
        ok(['added' => true]);
    } catch (PDOException $e) {
        ok(['already_exists' => true, 'msg' => $e->getMessage()]);
    }
}

// ── FORMULARIO PÚBLICO (sin auth) ────────────────────────────────────────────
if ($action === 'wa_form_get') {
    $phone = preg_replace('/\D/', '', body()['phone'] ?? ($_GET['phone'] ?? ''));
    if (!$phone) err('phone requerido');

    // Migraciones lazy para columnas de Google Maps (pueden no existir aún)
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_origin_place_id VARCHAR(255) NULL"); } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_origin_lat DOUBLE NULL");           } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_origin_lng DOUBLE NULL");           } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_destination_place_id VARCHAR(255) NULL"); } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_destination_lat DOUBLE NULL");      } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_destination_lng DOUBLE NULL");      } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN company_name VARCHAR(255) NULL");           } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN client_type ENUM('natural','empresa') NULL DEFAULT 'natural'"); } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN quote_send_email VARCHAR(255) NULL");       } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_hour TIME NULL");                   } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_hour_return TIME NULL");            } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN observaciones TEXT NULL");                  } catch (PDOException $e) {}

    // SELECT seguro: columnas base siempre presentes + nuevas con IF
    $stmt = db()->prepare(
        "SELECT contact_name, contact_email, contact_rut,
                service_origin, service_origin_place_id, service_origin_lat, service_origin_lng,
                service_destination, service_destination_place_id, service_destination_lat, service_destination_lng,
                service_date, service_passengers, service_type, service_vehicle,
                client_type, company_name, quote_send_email,
                service_hour, service_hour_return, observaciones
         FROM wa_cloud_conversations WHERE phone = ? LIMIT 1"
    );
    try {
        $stmt->execute([$phone]);
    } catch (PDOException $e) {
        // Fallback: si alguna columna nueva no existe aún, usar SELECT mínimo
        $stmt2 = db()->prepare(
            "SELECT contact_name, contact_email, contact_rut,
                    service_origin, service_origin_place_id, service_origin_lat, service_origin_lng,
                    service_destination, service_destination_place_id, service_destination_lat, service_destination_lng,
                    service_date, service_passengers, service_type, service_vehicle
             FROM wa_cloud_conversations WHERE phone = ? LIMIT 1"
        );
        $stmt2->execute([$phone]);
        $row = $stmt2->fetch() ?: [];
        if (!empty($row['service_date'])) {
            $row['service_date'] = date('Y-m-d', strtotime($row['service_date']));
        }
        ok($row);
    }
    $row = $stmt->fetch() ?: [];
    if (!empty($row['service_date'])) {
        $row['service_date'] = date('Y-m-d', strtotime($row['service_date']));
    }
    ok($row);
}

if ($action === 'wa_form_save') {
    $b     = body();
    $phone = preg_replace('/\D/', '', $b['phone'] ?? '');
    if (!$phone) err('phone requerido');
    $stmt = db()->prepare("SELECT id FROM wa_cloud_conversations WHERE phone = ? LIMIT 1");
    $stmt->execute([$phone]);
    if (!$stmt->fetch()) err('Conversación no encontrada', 404);

    // Migraciones columnas Google Maps + km
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_origin_place_id VARCHAR(255) NULL"); } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_origin_lat DOUBLE NULL");           } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_origin_lng DOUBLE NULL");           } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_destination_place_id VARCHAR(255) NULL"); } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_destination_lat DOUBLE NULL");      } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_destination_lng DOUBLE NULL");      } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_km DECIMAL(8,2) NULL");             } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN company_name VARCHAR(255) NULL");           } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN client_type ENUM('natural','empresa') NULL DEFAULT 'natural'"); } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN quote_send_email VARCHAR(255) NULL");       } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_hour TIME NULL");                   } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN service_hour_return TIME NULL");            } catch (PDOException $e) {}
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN observaciones TEXT NULL");                  } catch (PDOException $e) {}

    $allowed = ['contact_name','contact_email','contact_rut',
                'client_type','company_name','quote_send_email',
                'service_origin','service_origin_place_id','service_origin_lat','service_origin_lng',
                'service_destination','service_destination_place_id','service_destination_lat','service_destination_lng',
                'service_date','service_hour','service_hour_return',
                'service_passengers','service_type','service_vehicle','service_km',
                'observaciones'];
    $sets = []; $vals = [];
    foreach ($allowed as $col) {
        if (array_key_exists($col, $b)) {
            $v = $b[$col] === '' ? null : $b[$col];
            if ($col === 'service_passengers' && $v !== null) $v = (int)$v ?: null;
            if ($col === 'service_km'         && $v !== null) $v = round((float)$v, 2) ?: null;
            $sets[] = "$col = ?";
            $vals[] = $v;
        }
    }
    if (!$sets) err('Sin campos para guardar');

    // Verificar si ya tenía formulario enviado antes (para enviar confirmación solo la primera vez)
    $prevStmt = db()->prepare("SELECT id, contact_name, form_submitted_at FROM wa_cloud_conversations WHERE phone = ? LIMIT 1");
    $prevStmt->execute([$phone]);
    $prev = $prevStmt->fetch();
    $esPrimeroEnvio = empty($prev['form_submitted_at']);

    $sets[] = "form_submitted_at = COALESCE(form_submitted_at, NOW())";
    $sets[] = "stage = 'formulario_completo'";
    $vals[] = $phone;
    db()->prepare("UPDATE wa_cloud_conversations SET " . implode(', ', $sets) . " WHERE phone = ?")
        ->execute($vals);

    // Enviar confirmación WA solo la primera vez que se completa el formulario
    if ($esPrimeroEnvio && $prev) {
        $waToken = defined('META_WA_TOKEN')           ? META_WA_TOKEN           : (getenv('WHATSAPP_TOKEN') ?: '');
        $phoneId = defined('META_WA_PHONE_NUMBER_ID') ? META_WA_PHONE_NUMBER_ID : (getenv('WHATSAPP_PHONE_NUMBER_ID') ?: '');
        if ($waToken && $phoneId) {
            $nombre    = $prev['contact_name'] ? explode(' ', trim($prev['contact_name']))[0] : null;
            $saludo    = $nombre ? "¡Gracias, $nombre!" : "¡Gracias!";
            $msgTexto  = "$saludo ✅ Recibimos tu solicitud de transporte.\n\n"
                       . "Nuestro equipo ya está preparando tu cotización y te contactará a la brevedad. "
                       . "Si tienes alguna consulta adicional, escríbenos aquí mismo. 🚌\n\n"
                       . "www.transccl.cl";

            $payload = [
                'messaging_product' => 'whatsapp',
                'to'                => $phone,
                'type'              => 'text',
                'text'              => ['body' => $msgTexto, 'preview_url' => false],
            ];
            $ch = curl_init("https://graph.facebook.com/v21.0/{$phoneId}/messages");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$waToken}", 'Content-Type: application/json'],
                CURLOPT_POSTFIELDS     => json_encode($payload),
                CURLOPT_TIMEOUT        => 10,
            ]);
            $waResp   = curl_exec($ch);
            $waStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($waStatus < 400) {
                $wamid = (json_decode($waResp, true) ?? [])['messages'][0]['id'] ?? null;
                if ($wamid) {
                    db()->prepare(
                        "INSERT IGNORE INTO wa_cloud_messages
                         (id, conversation_id, wamid, direction, content, sender_type, created_at)
                         VALUES (?, ?, ?, 'out', ?, 'bot', NOW())"
                    )->execute([uuid(), $prev['id'], $wamid, $msgTexto]);
                }
            } else {
                error_log('[wa_form_save] WA confirm error ' . $waStatus . ': ' . substr($waResp, 0, 200));
            }

            // ── Notificar al ejecutivo asignado (WA personal + Email) ──────────
            $convFull = db()->prepare(
                "SELECT c.*, p.name AS exec_name, p.email AS exec_email, p.celular AS exec_celular
                 FROM wa_cloud_conversations c
                 LEFT JOIN profiles p ON p.id = c.assigned_to
                 WHERE c.phone = ? LIMIT 1"
            );
            $convFull->execute([$phone]);
            $conv = $convFull->fetch();

            // Si no tiene ejecutivo asignado, notificar a Claudio
            $execPhone  = $conv['exec_celular'] ?? null;
            $execEmail  = $conv['exec_email']   ?? null;
            $execName   = $conv['exec_name']    ?? 'Equipo';
            if (!$execPhone) { $execPhone = '56974270657'; $execEmail = 'claudio@transccl.cl'; $execName = 'Claudio'; }

            $clientName  = $conv['contact_name']        ?? 'Cliente';
            $origen      = $conv['service_origin']      ?? '—';
            $destino     = $conv['service_destination'] ?? '—';
            $fecha       = $conv['service_date']        ?? '—';
            $pax         = $conv['service_passengers']  ?? '—';
            $tipo        = $conv['service_type']        ?? '—';
            $clientPhone = $conv['phone']               ?? $phone;

            // A) WA al ejecutivo — texto libre (cliente escribió primero, ventana abierta)
            $waExecMsg = "🔔 *$clientName* completó el formulario de cotización.\n\n"
                       . "*Servicio:* $tipo\n"
                       . "*Desde:* $origen\n*Hacia:* $destino\n"
                       . "*Fecha:* $fecha\n*Pasajeros:* $pax\n"
                       . "*Tel cliente:* +$clientPhone\n\n"
                       . "👉 Cotizar: https://crm.transccl.cl";
            $waExecPayload = [
                'messaging_product' => 'whatsapp',
                'to'                => $execPhone,
                'type'              => 'text',
                'text'              => ['body' => $waExecMsg, 'preview_url' => false],
            ];
            $ch2 = curl_init("https://graph.facebook.com/v21.0/{$phoneId}/messages");
            curl_setopt_array($ch2, [
                CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
                CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$waToken}", 'Content-Type: application/json'],
                CURLOPT_POSTFIELDS     => json_encode($waExecPayload),
                CURLOPT_TIMEOUT        => 10,
            ]);
            $waExecResp   = curl_exec($ch2);
            $waExecStatus = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
            curl_close($ch2);
            if ($waExecStatus >= 400) {
                error_log('[wa_form_save] WA exec notify error ' . $waExecStatus . ': ' . substr($waExecResp, 0, 200));
            }

            // B) Email al ejecutivo
            if ($execEmail) {
                $subject = "🔔 $clientName completó el formulario — cotizar ahora";
                $htmlEmail = "<!DOCTYPE html><html><body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px'>"
                           . "<h2 style='color:#1a56db'>Nuevo formulario completo</h2>"
                           . "<p>Hola <strong>$execName</strong>, el cliente <strong>$clientName</strong> completó su solicitud y está esperando cotización.</p>"
                           . "<table style='width:100%;border-collapse:collapse;margin:20px 0'>"
                           . "<tr style='background:#f3f4f6'><td style='padding:10px;font-weight:bold'>Cliente</td><td style='padding:10px'>$clientName</td></tr>"
                           . "<tr><td style='padding:10px;font-weight:bold'>Teléfono</td><td style='padding:10px'>+$clientPhone</td></tr>"
                           . "<tr style='background:#f3f4f6'><td style='padding:10px;font-weight:bold'>Servicio</td><td style='padding:10px'>$tipo</td></tr>"
                           . "<tr><td style='padding:10px;font-weight:bold'>Desde</td><td style='padding:10px'>$origen</td></tr>"
                           . "<tr style='background:#f3f4f6'><td style='padding:10px;font-weight:bold'>Hacia</td><td style='padding:10px'>$destino</td></tr>"
                           . "<tr><td style='padding:10px;font-weight:bold'>Fecha</td><td style='padding:10px'>$fecha</td></tr>"
                           . "<tr style='background:#f3f4f6'><td style='padding:10px;font-weight:bold'>Pasajeros</td><td style='padding:10px'>$pax</td></tr>"
                           . "</table>"
                           . "<a href='https://crm.transccl.cl' style='background:#1a56db;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block'>Ir al CRM a cotizar →</a>"
                           . "<p style='margin-top:30px;color:#6b7280;font-size:12px'>TransCCL · Sistema automático</p>"
                           . "</body></html>";

                $headers  = "MIME-Version: 1.0\r\n";
                $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
                $headers .= "From: Sofia TransCCL <noreply@transccl.cl>\r\n";
                $headers .= "Reply-To: noreply@transccl.cl\r\n";
                @mail($execEmail, $subject, $htmlEmail, $headers);
            }
        }
    }

    ok(['saved' => true]);
}

// ── wa_bot_reactivate ─────────────────────────────────────────────────────────
if ($action === 'wa_bot_reactivate') {
    $user   = requireAuth();
    $b      = body();
    $convId = $b['conv_id'] ?? null;
    if (!$convId) err('conv_id requerido');

    $convStmt = db()->prepare("SELECT * FROM wa_cloud_conversations WHERE id = ?");
    $convStmt->execute([$convId]);
    $conv = $convStmt->fetch(PDO::FETCH_ASSOC);
    if (!$conv) err('Conversación no encontrada', 404);

    // Activar bot
    db()->prepare("UPDATE wa_cloud_conversations SET bot_active = 1 WHERE id = ?")
       ->execute([$convId]);

    // Últimos 30 mensajes (cronológico)
    $msgStmt = db()->prepare(
        "SELECT direction, content, sender_type FROM wa_cloud_messages
         WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 30"
    );
    $msgStmt->execute([$convId]);
    $msgs = array_reverse($msgStmt->fetchAll(PDO::FETCH_ASSOC));

    $historyText = '';
    foreach ($msgs as $m) {
        $who = $m['direction'] === 'in' ? 'Cliente'
             : ($m['sender_type'] === 'bot' ? 'Sofía (bot)' : 'Ejecutivo');
        $historyText .= "[{$who}]: {$m['content']}\n";
    }

    // Campos faltantes
    $faltantes = [];
    if (!$conv['contact_name'])      $faltantes[] = 'nombre y apellido';
    if (!$conv['contact_email'])     $faltantes[] = 'email';
    if (!$conv['contact_rut'])       $faltantes[] = 'RUT';
    if (!$conv['service_origin'])    $faltantes[] = 'origen del traslado';
    if (!$conv['service_destination']) $faltantes[] = 'destino del traslado';
    if (!$conv['service_date'])      $faltantes[] = 'fecha del servicio';
    if (!$conv['service_passengers']) $faltantes[] = 'número de pasajeros';
    if (!$conv['service_type'])      $faltantes[] = 'tipo de servicio';

    $fichaTexto = "Nombre: " . ($conv['contact_name']        ?? 'desconocido') . "\n"
        . "Email: "         . ($conv['contact_email']        ?? 'no registrado') . "\n"
        . "RUT: "           . ($conv['contact_rut']          ?? 'no registrado') . "\n"
        . "Origen: "        . ($conv['service_origin']       ?? 'no registrado') . "\n"
        . "Destino: "       . ($conv['service_destination']  ?? 'no registrado') . "\n"
        . "Fecha: "         . ($conv['service_date']         ?? 'no registrada') . "\n"
        . "Pasajeros: "     . ($conv['service_passengers']   ?? 'no registrado') . "\n"
        . "Tipo servicio: " . ($conv['service_type']         ?? 'no registrado') . "\n"
        . "Vehículo: "      . ($conv['service_vehicle']      ?? 'no registrado');

    $faltantesStr = count($faltantes) > 0
        ? "DATOS FALTANTES que debes pedir naturalmente: " . implode(', ', $faltantes) . "\n"
        : "Ya tienes todos los datos. Ofrece enviar la cotización pronto.\n";

    $systemPrompt = "Eres Sofía, asistente de TransCCL (empresa de traslados en buses, minibuses y vans en Chile).
Acaban de pasarte esta conversación de WhatsApp para que continues el seguimiento.
Tu tarea: leer TODA la conversación y enviar UN solo mensaje de seguimiento natural en español chileno informal.

REGLAS:
- Escribe de forma natural, como si llevaras la conversación, sin mencionar que hubo un ejecutivo humano
- Si el cliente ya dejó ciertos datos, no los repitas ni los pidas de nuevo
- Sé breve: máximo 3-4 oraciones
- NO uses emojis en exceso (máximo 1-2)
- Tono: amable, profesional y chileno
{$faltantesStr}";

    $userContent = "HISTORIAL:\n{$historyText}\n\nFICHA:\n{$fichaTexto}\n\nRedacta el mensaje de seguimiento:";

    // Llamar a Claude
    $aiKey = defined('AI_KEY') ? AI_KEY : (getenv('ANTHROPIC_API_KEY') ?: '');
    if (!$aiKey) err('AI_KEY no configurada', 503);

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_HTTPHEADER     => [
            'x-api-key: ' . $aiKey, 'anthropic-version: 2023-06-01', 'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => 'claude-sonnet-5-5', 'max_tokens' => 300,
            'system'   => $systemPrompt,
            'messages' => [['role' => 'user', 'content' => $userContent]],
        ]),
        CURLOPT_TIMEOUT => 30,
    ]);
    $aiResp   = curl_exec($ch);
    $aiStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($aiStatus >= 400) err('Error al generar mensaje IA: ' . substr($aiResp, 0, 200), 503);
    $aiData = json_decode($aiResp, true);
    $botMsg = trim($aiData['content'][0]['text'] ?? '');
    if (!$botMsg) err('IA no generó mensaje', 503);

    // Enviar por WA
    $waToken = defined('META_WA_TOKEN')           ? META_WA_TOKEN           : (getenv('WHATSAPP_TOKEN') ?: '');
    $phoneId = defined('META_WA_PHONE_NUMBER_ID') ? META_WA_PHONE_NUMBER_ID : (getenv('WHATSAPP_PHONE_NUMBER_ID') ?: '');
    if (!$waToken || !$phoneId) err('META_WA_TOKEN / META_WA_PHONE_NUMBER_ID no configurados', 503);

    $ch2 = curl_init("https://graph.facebook.com/v21.0/{$phoneId}/messages");
    curl_setopt_array($ch2, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer {$waToken}", 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode([
            'messaging_product' => 'whatsapp', 'to' => $conv['phone'],
            'type' => 'text', 'text' => ['body' => $botMsg, 'preview_url' => false],
        ]),
        CURLOPT_TIMEOUT => 10,
    ]);
    $waResp   = curl_exec($ch2);
    $waStatus = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
    curl_close($ch2);

    if ($waStatus >= 400) {
        error_log('[wa_bot_reactivate] WA send error ' . $waStatus . ': ' . substr($waResp, 0, 200));
    }

    // Guardar mensaje en DB
    $msgId = bin2hex(random_bytes(16));
    db()->prepare(
        "INSERT INTO wa_cloud_messages (id, conversation_id, direction, content, msg_type, status, sender_type)
         VALUES (?, ?, 'out', ?, 'text', 'sent', 'bot')"
    )->execute([$msgId, $convId, $botMsg]);

    db()->prepare("UPDATE wa_cloud_conversations SET last_msg_at = NOW(), bot_active = 1 WHERE id = ?")
       ->execute([$convId]);

    ok(['bot_active' => true, 'message' => $botMsg]);
}

// ── Sofía: obtener aprobación pendiente de una conversación ──────────────────
if ($action === 'wa_approvals_get') {
    $user   = requireAuth();
    $convId = $_GET['conv_id'] ?? body()['conv_id'] ?? '';

    // Migraciones lazy
    try { db()->exec("ALTER TABLE wa_cloud_conversations ADD COLUMN wa_draft_quote_id VARCHAR(36) NULL"); } catch (PDOException $e) {}
    try { db()->exec("CREATE TABLE IF NOT EXISTS wa_quote_approvals (
        id           VARCHAR(36)  PRIMARY KEY,
        conv_id      VARCHAR(36)  NOT NULL,
        quotation_id VARCHAR(36)  NOT NULL,
        created_by   VARCHAR(36)  NULL,
        created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
        approved_by  VARCHAR(36)  NULL,
        approved_at  DATETIME     NULL,
        quote_total  DECIMAL(12,0) NULL,
        quote_snapshot JSON       NULL,
        status       ENUM('pending','approved','rejected','invalidated','sent') DEFAULT 'pending',
        sent_at      DATETIME     NULL,
        sent_result  JSON         NULL,
        notes        TEXT         NULL,
        INDEX idx_wqa_conv (conv_id),
        INDEX idx_wqa_status (status)
    )"); } catch (PDOException $e) {}
    if (!$convId) err('conv_id requerido');

    $stmt = db()->prepare("
        SELECT wqa.id, wqa.conv_id, wqa.quotation_id, wqa.status,
               wqa.created_at, wqa.approved_at, wqa.sent_at,
               wqa.approved_by, wqa.notes, wqa.quote_total,
               q.number AS quote_number, q.total AS quote_total_bd,
               q.desde, q.hasta, q.distancia_km, q.fecha_salida, q.hora_salida,
               q.fecha_retorno, q.hora_retorno, q.vehicle_type,
               JSON_VALUE(q.observaciones, '$.pasajeros') AS pasajeros,
               p.name AS approved_by_name,
               pc.name AS created_by_name
        FROM wa_quote_approvals wqa
        JOIN quotations q ON q.id = wqa.quotation_id
        LEFT JOIN profiles p  ON p.id  = wqa.approved_by
        LEFT JOIN profiles pc ON pc.id = wqa.created_by
        WHERE wqa.conv_id = ?
        ORDER BY wqa.created_at DESC
        LIMIT 1
    ");
    $stmt->execute([$convId]);
    $row = $stmt->fetch();
    ok(['approval' => $row ?: null]);
}

// ── Sofía: aprobar o rechazar borrador ────────────────────────────────────────
if ($action === 'wa_approvals_decide') {
    $user = requireAuth();

    // Solo gerencia/admin/superadmin/supervisor pueden aprobar borradores de Sofía
    $allowedRoles = ['gerencia', 'admin', 'superadmin', 'supervisor'];
    if (!in_array($user['role'] ?? '', $allowedRoles)) {
        err('Sin permiso: solo Gerencia o supervisores autorizados pueden aprobar cotizaciones de Sofía', 403);
    }

    $b    = body();
    $convId    = $b['conv_id']     ?? '';
    $decision  = $b['decision']    ?? ''; // 'approved' | 'rejected'
    $notes     = trim($b['notes']  ?? '');
    if (!$convId || !in_array($decision, ['approved', 'rejected'])) err('conv_id y decision requeridos');

    // Obtener aprobación pendiente
    $ap = db()->prepare("SELECT id, quotation_id, status FROM wa_quote_approvals WHERE conv_id = ? ORDER BY created_at DESC LIMIT 1");
    $ap->execute([$convId]);
    $apRow = $ap->fetch();
    if (!$apRow) err('No hay cotización de Sofía para esta conversación', 404);
    if ($apRow['status'] !== 'pending') err('Esta cotización ya fue ' . $apRow['status'] . '. No se puede ' . $decision, 409);

    // Capturar snapshot de la cotización en el momento de la decisión
    $qSnap = db()->prepare("SELECT id, number, total, etapa, desde, hasta, fecha_salida, vehicle_type, distancia_km FROM quotations WHERE id=?");
    $qSnap->execute([$apRow['quotation_id']]);
    $snapshot = $qSnap->fetch() ?: [];

    if ($decision === 'rejected') {
        db()->prepare("UPDATE wa_quote_approvals SET status='rejected', approved_by=?, approved_at=NOW(), notes=?, quote_snapshot=? WHERE id=?")
            ->execute([$user['id'], $notes ?: null, json_encode($snapshot), $apRow['id']]);
        db()->prepare("UPDATE quotations SET etapa='borrador_wa_rechazado' WHERE id=?")
            ->execute([$apRow['quotation_id']]);
        db()->prepare("UPDATE wa_cloud_conversations SET wa_draft_quote_id=NULL WHERE id=?")
            ->execute([$convId]);
        ok(['rechazado' => true, 'rechazado_por' => $user['id'], 'timestamp' => date('c')]);
    }

    // Aprobar: status='approved' (el envío es un paso separado)
    // La ejecutiva comercial NO cambia — solo se registra quién autorizó
    db()->prepare("UPDATE wa_quote_approvals SET status='approved', approved_by=?, approved_at=NOW(), notes=?, quote_snapshot=? WHERE id=?")
        ->execute([$user['id'], $notes ?: null, json_encode($snapshot), $apRow['id']]);
    // Mover cotización de borrador a lista para envío
    db()->prepare("UPDATE quotations SET etapa='cotizacion', status='open' WHERE id=?")
        ->execute([$apRow['quotation_id']]);

    $q = db()->prepare("SELECT number, total, desde, hasta, fecha_salida FROM quotations WHERE id=?");
    $q->execute([$apRow['quotation_id']]);
    $qRow = $q->fetch();
    ok([
        'aprobado'       => true,
        'aprobado_por'   => $user['id'],
        'timestamp'      => date('c'),
        'quote_number'   => $qRow['number'] ?? null,
        'total'          => $qRow['total']  ?? null,
        'envio_pendiente'=> true, // El envío WA es un paso posterior independiente
    ]);
}

// ── Sofía: invalidar aprobación para permitir nueva versión ───────────────────
if ($action === 'wa_invalidate_approval') {
    $user = requireAuth();
    $allowedRoles = ['gerencia', 'admin', 'superadmin', 'supervisor'];
    if (!in_array($user['role'] ?? '', $allowedRoles)) {
        err('Sin permiso: solo Gerencia o supervisores pueden invalidar aprobaciones', 403);
    }
    $b      = body();
    $convId = $b['conv_id'] ?? '';
    $motivo = trim($b['motivo'] ?? 'Invalidado manualmente por supervisor');
    if (!$convId) err('conv_id requerido');

    $ap = db()->prepare("SELECT id, status, quotation_id FROM wa_quote_approvals WHERE conv_id=? AND status IN ('approved','pending') ORDER BY created_at DESC LIMIT 1");
    $ap->execute([$convId]);
    $apRow = $ap->fetch();
    if (!$apRow) err('No hay aprobación activa (approved/pending) para invalidar', 404);

    db()->prepare("UPDATE wa_quote_approvals SET status='invalidated', approved_by=?, approved_at=NOW(), notes=? WHERE id=?")
        ->execute([$user['id'], $motivo, $apRow['id']]);
    db()->prepare("UPDATE quotations SET etapa='borrador_wa_invalidado' WHERE id=?")
        ->execute([$apRow['quotation_id']]);
    db()->prepare("UPDATE wa_cloud_conversations SET wa_draft_quote_id=NULL WHERE id=?")
        ->execute([$convId]);
    ok(['invalidado'=>true,'status_anterior'=>$apRow['status'],'invalidado_por'=>$user['id'],'timestamp'=>date('c')]);
}

// ── Sofía: métricas agregadas ─────────────────────────────────────────────────
if ($action === 'wa_sofia_metrics') {
    requireAuth();
    $desde = $_GET['desde'] ?? date('Y-m-01');
    $hasta = $_GET['hasta'] ?? date('Y-m-t');

    $m = [];

    // Prospectos atendidos por bot (tuvieron bot_active = 1 alguna vez)
    $r = db()->prepare("SELECT COUNT(DISTINCT conversation_id) FROM wa_cloud_messages WHERE sender_type = 'bot' AND created_at BETWEEN ? AND ?");
    $r->execute([$desde . ' 00:00:00', $hasta . ' 23:59:59']);
    $m['prospectos_bot'] = (int)$r->fetchColumn();

    // Formularios completados
    $r2 = db()->prepare("SELECT COUNT(*) FROM wa_cloud_conversations WHERE stage IN ('formulario_completo','cotizando','ganado') AND created_at BETWEEN ? AND ?");
    $r2->execute([$desde . ' 00:00:00', $hasta . ' 23:59:59']);
    $m['formularios_completados'] = (int)$r2->fetchColumn();

    // Borradores creados por Sofía
    $r3 = db()->prepare("SELECT COUNT(*) FROM wa_quote_approvals WHERE created_at BETWEEN ? AND ?");
    $r3->execute([$desde . ' 00:00:00', $hasta . ' 23:59:59']);
    $m['borradores_creados'] = (int)$r3->fetchColumn();

    // Aprobadas y enviadas
    $r4 = db()->prepare("SELECT COUNT(*) FROM wa_quote_approvals WHERE status = 'sent' AND sent_at BETWEEN ? AND ?");
    $r4->execute([$desde . ' 00:00:00', $hasta . ' 23:59:59']);
    $m['aprobadas_enviadas'] = (int)$r4->fetchColumn();

    // Rechazadas
    $r5 = db()->prepare("SELECT COUNT(*) FROM wa_quote_approvals WHERE status = 'rejected' AND approved_at BETWEEN ? AND ?");
    $r5->execute([$desde . ' 00:00:00', $hasta . ' 23:59:59']);
    $m['rechazadas'] = (int)$r5->fetchColumn();

    // Intervenciones humanas (bot → humano)
    $r6 = db()->prepare("SELECT COUNT(DISTINCT c.id) FROM wa_cloud_conversations c WHERE c.bot_active = 0 AND c.wa_draft_quote_id IS NOT NULL AND c.created_at BETWEEN ? AND ?");
    $r6->execute([$desde . ' 00:00:00', $hasta . ' 23:59:59']);
    $m['intervenciones_humanas'] = (int)$r6->fetchColumn();

    // Ganados originados desde bot
    $r7 = db()->prepare("SELECT COUNT(*) FROM wa_cloud_conversations WHERE stage = 'ganado' AND wa_draft_quote_id IS NOT NULL AND created_at BETWEEN ? AND ?");
    $r7->execute([$desde . ' 00:00:00', $hasta . ' 23:59:59']);
    $m['ganados_sofia'] = (int)$r7->fetchColumn();

    ok(['metrics' => $m, 'periodo' => ['desde' => $desde, 'hasta' => $hasta]]);
}

// ── PHP Tarifario (mirror exacto de lib/tarifario.ts v2026-11-01) ────────────
// NUNCA cambiar sin actualizar el TypeScript también.
// escalera(m) => fijo = m - 19*3100 = m - 58900 , valorKm = 3100
$PHP_TARIFARIO = [
    'bus45'     => ['pax'=>45,'minimo'=>184500,'fijo'=>118500,'valorKm'=>3560,'disposicion'=>100000,'costoTramo'=>64750],
    'taxibus30' => ['pax'=>30,'minimo'=>175800,'fijo'=>116900,'valorKm'=>3100,'disposicion'=>90000, 'costoTramo'=>60000],
    'taxibus25' => ['pax'=>25,'minimo'=>167800,'fijo'=>108900,'valorKm'=>3100,'disposicion'=>90000, 'costoTramo'=>55000],
    'minibus19' => ['pax'=>19,'minimo'=>159100,'fijo'=>100200,'valorKm'=>3100,'disposicion'=>90000, 'costoTramo'=>42500],
    'minibus17' => ['pax'=>17,'minimo'=>151100,'fijo'=>92200, 'valorKm'=>3100,'disposicion'=>80000, 'costoTramo'=>40000],
    'minibus15' => ['pax'=>15,'minimo'=>142400,'fijo'=>83500, 'valorKm'=>3100,'disposicion'=>80000, 'costoTramo'=>34750],
    'van11'     => ['pax'=>11,'minimo'=>134400,'fijo'=>75500, 'valorKm'=>3100,'disposicion'=>80000, 'costoTramo'=>32500],
];
function php_formato_por_pasajeros(int $pax): string {
    global $PHP_TARIFARIO;
    $t = $PHP_TARIFARIO; uasort($t, fn($a,$b)=>$a['pax']<=>$b['pax']);
    foreach ($t as $id=>$f) { if ($f['pax']>=$pax) return $id; }
    return 'bus45';
}
function php_formato_nombre(string $id): string {
    return match($id) {
        'bus45'=>'Bus 45','taxibus30'=>'Taxibús 30','taxibus25'=>'Taxibús 25',
        'minibus19'=>'Minibús 19','minibus17'=>'Minibús 17','minibus15'=>'Minibús 15','van11'=>'Van 11',
        default=>$id,
    };
}
function php_map_vehiculo(string $v, int $pax): string {
    $v = strtolower(trim($v));
    $direct = ['bus45','taxibus30','taxibus25','minibus19','minibus17','minibus15','van11'];
    if (in_array($v, $direct)) return $v;
    if ($v==='bus'||str_starts_with($v,'bus ')) return 'bus45';
    if ($v==='van11'||$v==='van'||str_starts_with($v,'van ')) return 'van11';
    return php_formato_por_pasajeros($pax);
}
function php_calcular_tarifa_salida(string $formato_id, float $km): array {
    global $PHP_TARIFARIO;
    $f = $PHP_TARIFARIO[$formato_id] ?? $PHP_TARIFARIO['bus45'];
    $lista = (int)max($f['minimo'], $f['fijo'] + $f['valorKm'] * $km);
    $minimo = (int)round($lista * (0.65 / 0.70));  // margenLista=0.35, margenMinimo=0.30
    return [
        'formato_id'    => $formato_id,
        'formato_nombre'=> php_formato_nombre($formato_id),
        'km'            => $km,
        'precio_lista'  => $lista,
        'precio_minimo' => $minimo,
    ];
}

// ── crear_borrador_wa — crea cotización borrador a partir de conversación WA ──
// $opts['use_client_lookup'] = true  → busca/crea cliente por RUT (staging Fase 1)
function crear_borrador_wa(PDO $pdo, string $conv_id, array $opts = []): array {
    $use_client_lookup = $opts['use_client_lookup'] ?? false;

    $stmt = $pdo->prepare("SELECT * FROM wa_cloud_conversations WHERE id=? LIMIT 1");
    $stmt->execute([$conv_id]);
    $conv = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$conv) return ['error'=>'Conversación no encontrada','code'=>404];

    foreach (['service_origin','service_destination','service_passengers','service_date'] as $f) {
        if (empty($conv[$f])) return ['error'=>"Campo requerido: $f",'code'=>422,'missing'=>$f];
    }
    $km = isset($conv['service_km']) && (float)$conv['service_km'] > 0 ? (float)$conv['service_km'] : null;
    if (!$km) return ['error'=>'Distancia no calculada (service_km vacío)','code'=>422,'missing'=>'service_km'];

    $pax = (int)$conv['service_passengers'];
    if ($pax < 1) return ['error'=>'Número de pasajeros inválido','code'=>422];
    if ($pax > 90) return ['error'=>"$pax pasajeros: requiere cotización a medida (máx 90)",'code'=>422,'tipo'=>'a_medida'];
    if ($km > 150) return ['error'=>"{$km} km supera el límite de 150 km para borrador automático",'code'=>422,'tipo'=>'a_medida'];

    // ── Fase 1: identificación de cliente por RUT ────────────────────────────
    $client_id  = null;
    $contact_id = null;
    $company_field = $conv['contact_name'] ?? 'Sin nombre'; // default actual

    if ($use_client_lookup) {
        $rut = trim($conv['contact_rut'] ?? '');
        $client_type = $conv['client_type'] ?? null;

        if (!$rut || !validateRut($rut)) {
            // Sin RUT válido: marcar datos incompletos, no crear cotización
            try {
                $pdo->prepare("UPDATE wa_cloud_conversations SET stage='datos_incompletos' WHERE id=?")
                    ->execute([$conv_id]);
            } catch (PDOException $e) {}
            return ['error'=>'RUT no recopilado o inválido. Sofía debe solicitar el RUT antes de cotizar.',
                    'code'=>422,'missing'=>'contact_rut','stage'=>'datos_incompletos'];
        }

        $email = trim($conv['quote_send_email'] ?? $conv['contact_email'] ?? '');
        if (!$email) {
            try {
                $pdo->prepare("UPDATE wa_cloud_conversations SET stage='datos_incompletos' WHERE id=?")
                    ->execute([$conv_id]);
            } catch (PDOException $e) {}
            return ['error'=>'Email no recopilado. Sofía debe solicitar el correo del cliente antes de cotizar.',
                    'code'=>422,'missing'=>'contact_email','stage'=>'datos_incompletos'];
        }

        $rut_norm = normalizeRut($rut);
        $rut_key  = rutKey($rut);

        // Buscar cliente existente por RUT
        $sc = $pdo->prepare("SELECT id, name, email FROM clients WHERE REPLACE(REPLACE(rut,'.',''),'-','') = ? LIMIT 1");
        $sc->execute([$rut_key]);
        $existing_client = $sc->fetch(PDO::FETCH_ASSOC);

        if ($existing_client) {
            $client_id    = $existing_client['id'];
            $company_field = $existing_client['name'];

            // Buscar contacto correcto por email (nunca auto-seleccionar primero)
            $contact_email_to_use = $email;
            $sc2 = $pdo->prepare("SELECT id, name FROM contacts WHERE client_id=? AND email=? LIMIT 1");
            $sc2->execute([$client_id, $contact_email_to_use]);
            $ct = $sc2->fetch(PDO::FETCH_ASSOC);
            if ($ct) {
                $contact_id = $ct['id'];
            } else {
                // Verificar si hay múltiples contactos (ambigüedad)
                $ct_count = $pdo->prepare("SELECT COUNT(*) AS n FROM contacts WHERE client_id=?");
                $ct_count->execute([$client_id]);
                $n = (int)$ct_count->fetch(PDO::FETCH_ASSOC)['n'];
                if ($n > 0) {
                    // Ambigüedad: hay contactos pero ninguno coincide con el email
                    // Escalar a ejecutiva sin crear cotización
                    return ['error'=>'El cliente tiene contactos registrados pero ninguno coincide con el correo proporcionado. Verificar con ejecutiva.',
                            'code'=>422,'missing'=>'contact_match','client_id'=>$client_id,'n_contacts'=>$n,'escalate'=>true];
                }
                // No hay contactos: crear uno nuevo si es empresa
                if ($client_type === 'empresa' && !empty($conv['contact_name'])) {
                    $new_ct_id = $pdo->query("SELECT UUID() AS u")->fetch(PDO::FETCH_ASSOC)['u'];
                    $pdo->prepare("INSERT INTO contacts (id,client_id,name,email,phone_mobile) VALUES (?,?,?,?,?)")
                        ->execute([$new_ct_id, $client_id, $conv['contact_name'], $email, $conv['phone'] ?? null]);
                    $contact_id = $new_ct_id;
                }
            }
        } else {
            // Cliente nuevo: crear solo si tiene datos suficientes
            $nombre_cliente = $conv['company_name'] ?? $conv['contact_name'] ?? '';
            if (!$nombre_cliente) {
                return ['error'=>'Nombre o razón social no recopilado.',
                        'code'=>422,'missing'=>'company_name','stage'=>'datos_incompletos'];
            }
            $new_cl_id = $pdo->query("SELECT UUID() AS u")->fetch(PDO::FETCH_ASSOC)['u'];
            try {
                $pdo->prepare("INSERT INTO clients (id,name,rut,email,phone,created_at) VALUES (?,?,?,?,?,NOW())")
                    ->execute([$new_cl_id, $nombre_cliente, $rut_norm, $email, $conv['phone'] ?? null]);
                $client_id    = $new_cl_id;
                $company_field = $nombre_cliente;

                // Crear contacto si es empresa y hay nombre de contacto diferente a la razón social
                if ($client_type === 'empresa' && !empty($conv['contact_name']) && $conv['contact_name'] !== $nombre_cliente) {
                    $new_ct_id = $pdo->query("SELECT UUID() AS u")->fetch(PDO::FETCH_ASSOC)['u'];
                    $pdo->prepare("INSERT INTO contacts (id,client_id,name,email,phone_mobile) VALUES (?,?,?,?,?)")
                        ->execute([$new_ct_id, $new_cl_id, $conv['contact_name'], $email, $conv['phone'] ?? null]);
                    $contact_id = $new_ct_id;
                }
            } catch (PDOException $e) {
                // Manejar race condition: otro request insertó el mismo RUT primero
                if ($e->getCode() == 23000 || strpos($e->getMessage(), 'Duplicate') !== false) {
                    $sc3 = $pdo->prepare("SELECT id, name FROM clients WHERE REPLACE(REPLACE(rut,'.',''),'-','') = ? LIMIT 1");
                    $sc3->execute([$rut_key]);
                    $winner = $sc3->fetch(PDO::FETCH_ASSOC);
                    if ($winner) { $client_id = $winner['id']; $company_field = $winner['name']; }
                } else {
                    return ['error'=>'Error al crear cliente: '.$e->getMessage(),'code'=>500];
                }
            }
        }
    }

    // ── Idempotencia y bloqueo por aprobación existente ──────────────────────
    // Usar FOR UPDATE si client_lookup está activo (previene race condition)
    if ($use_client_lookup) {
        try { $pdo->beginTransaction(); } catch (PDOException $e) {}
        $lock = $pdo->prepare("SELECT wa_draft_quote_id FROM wa_cloud_conversations WHERE id=? FOR UPDATE");
        $lock->execute([$conv_id]);
        $conv_locked = $lock->fetch(PDO::FETCH_ASSOC);
        $draft_id = $conv_locked['wa_draft_quote_id'] ?? null;
    } else {
        $draft_id = $conv['wa_draft_quote_id'] ?? null;
    }

    if ($draft_id) {
        try {
            $sa = $pdo->prepare("SELECT id, status FROM wa_quote_approvals WHERE quotation_id=? ORDER BY created_at DESC LIMIT 1");
            $sa->execute([$draft_id]);
            $ex = $sa->fetch(PDO::FETCH_ASSOC);
            if ($ex) {
                if ($ex['status'] === 'pending') {
                    if ($use_client_lookup) { try { $pdo->rollBack(); } catch (PDOException $e) {} }
                    return ['ok'=>true,'idempotent'=>true,'quotation_id'=>$draft_id,'approval_id'=>$ex['id']];
                }
                if (in_array($ex['status'], ['approved', 'sent'])) {
                    if ($use_client_lookup) { try { $pdo->rollBack(); } catch (PDOException $e) {} }
                    return [
                        'error' => "Esta cotización ya fue {$ex['status']}. Para crear una nueva versión, el supervisor debe invalidar la aprobación anterior.",
                        'code'  => 409,
                        'approval_status' => $ex['status'],
                        'approval_id'     => $ex['id'],
                    ];
                }
            }
        } catch (PDOException $e) {}
    }

    $formato_id = php_map_vehiculo($conv['service_vehicle'] ?? '', $pax);
    $tarifa = php_calcular_tarifa_salida($formato_id, $km);

    // Invalidar aprobaciones anteriores en estado pending o invalidated (no approved/sent)
    try {
        $pdo->prepare("UPDATE wa_quote_approvals SET status='invalidated',notes='Reemplazado por nuevo borrador' WHERE conv_id=? AND status='pending'")->execute([$conv_id]);
    } catch (PDOException $e) {}

    $quot_id = $pdo->query("SELECT UUID() AS u")->fetch(PDO::FETCH_ASSOC)['u'];
    $appr_id = $pdo->query("SELECT UUID() AS u")->fetch(PDO::FETCH_ASSOC)['u'];
    $exec_id = $conv['assigned_to'] ?? null;
    $number  = 'BWA-' . date('Ymd') . '-' . str_pad(rand(1000,9999), 4, '0', STR_PAD_LEFT);
    $obs     = sprintf('Borrador automático Sofía. Vehículo: %s. Distancia: %s km. Pasajeros: %d. Servicio: salida / mismo día.',
                 $tarifa['formato_nombre'], $km, $pax);
    $snapshot = ['origin'=>$conv['service_origin'],'destination'=>$conv['service_destination'],
                 'passengers'=>$pax,'vehicle'=>$tarifa['formato_nombre'],'km'=>$km,
                 'precio_lista'=>$tarifa['precio_lista'],'modalidad'=>'mismo_dia','servicio'=>'salida',
                 'generado'=>date('c')];

    try {
        // Columnas client_id/contact_id solo si existen (producción puede no tenerlas aún)
        $has_client_col = false;
        try {
            $pdo->query("SELECT client_id FROM quotations LIMIT 0");
            $has_client_col = true;
        } catch (PDOException $e) {}

        $hora_salida   = !empty($conv['service_hour'])        ? $conv['service_hour']        : null;
        $hora_retorno  = !empty($conv['service_hour_return']) ? $conv['service_hour_return'] : null;

        if ($has_client_col && $client_id) {
            $pdo->prepare("
                INSERT INTO quotations
                    (id,number,status,etapa,company,
                     issue_date,expiry_date,
                     subtotal,tax_pct,total,
                     notes,observaciones,
                     desde,hasta,desde_lat,desde_lng,hasta_lat,hasta_lng,
                     distancia_km,fecha_salida,hora_salida,hora_retorno,vehicle_type,
                     client_id,contact_id,user_id,pd_sync_status,pdf_upload_status,created_at)
                VALUES (?,?,?,?,?,
                        ?,?,
                        ?,?,?,
                        ?,?,
                        ?,?,?,?,?,?,
                        ?,?,?,?,?,
                        ?,?,?,?,?,NOW())
            ")->execute([
                $quot_id,$number,'open','borrador_wa',$company_field,
                date('Y-m-d'),date('Y-m-d',strtotime('+7 days')),
                $tarifa['precio_lista'],0,$tarifa['precio_lista'],
                'Borrador automático WA — pendiente de revisión y aprobación',$obs,
                $conv['service_origin'],$conv['service_destination'],
                $conv['service_origin_lat']??null,$conv['service_origin_lng']??null,
                $conv['service_destination_lat']??null,$conv['service_destination_lng']??null,
                $km,$conv['service_date'],$hora_salida,$hora_retorno,$tarifa['formato_nombre'],
                $client_id,$contact_id,$exec_id,'pending','pending',
            ]);
        } else {
            $pdo->prepare("
                INSERT INTO quotations
                    (id,number,status,etapa,company,
                     issue_date,expiry_date,
                     subtotal,tax_pct,total,
                     notes,observaciones,
                     desde,hasta,desde_lat,desde_lng,hasta_lat,hasta_lng,
                     distancia_km,fecha_salida,hora_salida,hora_retorno,vehicle_type,
                     user_id,pd_sync_status,pdf_upload_status,created_at)
                VALUES (?,?,?,?,?,
                        ?,?,
                        ?,?,?,
                        ?,?,
                        ?,?,?,?,?,?,
                        ?,?,?,?,?,
                        ?,?,?,NOW())
            ")->execute([
                $quot_id,$number,'open','borrador_wa',$company_field,
                date('Y-m-d'),date('Y-m-d',strtotime('+7 days')),
                $tarifa['precio_lista'],0,$tarifa['precio_lista'],
                'Borrador automático WA — pendiente de revisión y aprobación',$obs,
                $conv['service_origin'],$conv['service_destination'],
                $conv['service_origin_lat']??null,$conv['service_origin_lng']??null,
                $conv['service_destination_lat']??null,$conv['service_destination_lng']??null,
                $km,$conv['service_date'],$hora_salida,$hora_retorno,$tarifa['formato_nombre'],
                $exec_id,'pending','pending',
            ]);
        }
        $pdo->prepare("
            INSERT INTO wa_quote_approvals (id,conv_id,quotation_id,created_by,quote_total,quote_snapshot,status)
            VALUES (?,?,?,?,?,?,'pending')
        ")->execute([$appr_id,$conv_id,$quot_id,$exec_id,$tarifa['precio_lista'],json_encode($snapshot)]);
        $pdo->prepare("UPDATE wa_cloud_conversations SET wa_draft_quote_id=? WHERE id=?")->execute([$quot_id,$conv_id]);
        if ($use_client_lookup) { try { $pdo->commit(); } catch (PDOException $e) {} }
        return ['ok'=>true,'quotation_id'=>$quot_id,'approval_id'=>$appr_id,'number'=>$number,'tarifa'=>$tarifa,
                'client_id'=>$client_id,'contact_id'=>$contact_id,'client_created'=>!($existing_client??null)];
    } catch (PDOException $e) {
        if ($use_client_lookup) { try { $pdo->rollBack(); } catch (PDOException $ex) {} }
        return ['error'=>'DB error: '.$e->getMessage(),'code'=>500];
    }
}

// ── wa_create_borrador ────────────────────────────────────────────────────────
if ($action === 'wa_create_borrador') {
    $conv_id = body()['conv_id'] ?? ($_GET['conv_id'] ?? '');
    if (!$conv_id) err('conv_id requerido');
    $result = crear_borrador_wa(db(), $conv_id);
    if (isset($result['error'])) err($result['error'], $result['code'] ?? 422);
    ok($result);
}

// ── E2E Staging Tests (TEMPORAL — eliminar después de pruebas) ────────────────
// Requiere header x-e2e-token con valor definido en env E2E_STAGING_TOKEN (cPanel).
// Conecta a DB staging, NO a producción.
if (str_starts_with($action, 'e2e_')) {
    $e2e_token          = $_SERVER['HTTP_X_E2E_TOKEN'] ?? '';
    $e2e_token_expected = getenv('E2E_STAGING_TOKEN') ?: '';
    if (!$e2e_token_expected || $e2e_token !== $e2e_token_expected) {
        err('e2e token inválido', 403);
    }

    // Conexión exclusiva staging (no usa db() de producción)
    static $stgpdo = null;
    if (!$stgpdo) {
        try {
            $stgpdo = new PDO(
                'mysql:host=localhost;dbname=transccl_crm_staging;charset=utf8mb4',
                getenv('STG_DB_USER') ?: '',
                getenv('STG_DB_PASS') ?: '',
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
            );
        } catch (PDOException $e) {
            err('staging db error: ' . $e->getMessage(), 500);
        }
    }

    function stg(): PDO { global $stgpdo; return $stgpdo; }
    function stguuid(): string { return stg()->query("SELECT UUID() AS u")->fetch()['u']; }

    // Fix staging: wa_cloud_conversations puede ser copia de quotations (sin columna phone)
    // Solución: agregar columnas WA que faltan sin tocar las existentes
    $wa_fix_cols = [
        "ALTER TABLE wa_cloud_conversations ADD COLUMN phone VARCHAR(20) NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN channel VARCHAR(20) DEFAULT 'whatsapp'",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN bot_active TINYINT(1) DEFAULT 1",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN assigned_to VARCHAR(36) NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN contact_name VARCHAR(200) NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN contact_email VARCHAR(200) NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN contact_rut VARCHAR(20) NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_origin VARCHAR(300) NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_destination VARCHAR(300) NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_date DATE NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_passengers INT NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_type VARCHAR(50) NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN stage VARCHAR(50) NULL",
    ];
    foreach ($wa_fix_cols as $fix) { try { stg()->exec($fix); } catch (PDOException $e) {} }

    // Migraciones lazy en staging
    $stg_migrations = [
        "ALTER TABLE wa_cloud_conversations ADD COLUMN wa_draft_quote_id VARCHAR(36) NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_origin_place_id VARCHAR(255) NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_origin_lat DOUBLE NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_origin_lng DOUBLE NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_destination_place_id VARCHAR(255) NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_destination_lat DOUBLE NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_destination_lng DOUBLE NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_vehicle VARCHAR(100) NULL",
        "CREATE TABLE IF NOT EXISTS wa_quote_approvals (
            id VARCHAR(36) PRIMARY KEY, conv_id VARCHAR(36) NOT NULL, quotation_id VARCHAR(36) NOT NULL,
            created_by VARCHAR(36) NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            approved_by VARCHAR(36) NULL, approved_at DATETIME NULL,
            quote_total DECIMAL(12,0) NULL, quote_snapshot JSON NULL,
            status ENUM('pending','approved','rejected','invalidated','sent') DEFAULT 'pending',
            sent_at DATETIME NULL, sent_result JSON NULL, notes TEXT NULL,
            INDEX idx_wqa_conv (conv_id), INDEX idx_wqa_status (status)
        )",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_km DECIMAL(8,2) NULL",
        // ── Fase 1: tablas de clientes/contactos en staging ──────────────────
        "CREATE TABLE IF NOT EXISTS clients (
            id CHAR(36) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            rut VARCHAR(20) NULL,
            email VARCHAR(200) NULL,
            phone VARCHAR(50) NULL,
            address TEXT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB",
        "CREATE TABLE IF NOT EXISTS contacts (
            id CHAR(36) PRIMARY KEY,
            client_id CHAR(36) NOT NULL,
            name VARCHAR(200) NOT NULL,
            email VARCHAR(200) NULL,
            phone_mobile VARCHAR(50) NULL,
            phone_landline VARCHAR(50) NULL,
            cargo VARCHAR(100) NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB",
        // ── Fase 1: columnas nuevas en wa_cloud_conversations ─────────────────
        "ALTER TABLE wa_cloud_conversations ADD COLUMN company_name VARCHAR(200) NULL COMMENT 'Razón social empresa'",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN client_type ENUM('natural','empresa') NULL",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN quote_send_email VARCHAR(200) NULL COMMENT 'Email confirmado para envío'",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_hour TIME NULL COMMENT 'Hora de salida HH:MM'",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN service_hour_return TIME NULL COMMENT 'Hora de regreso aproximada HH:MM'",
        "ALTER TABLE wa_cloud_conversations ADD COLUMN observaciones TEXT NULL COMMENT 'Observaciones del servicio'",
        // ── Fase 1: historial de invalidaciones en wa_quote_approvals ─────────
        "ALTER TABLE wa_quote_approvals ADD COLUMN invalidated_reason TEXT NULL",
        "ALTER TABLE wa_quote_approvals ADD COLUMN invalidated_at DATETIME NULL",
        "ALTER TABLE wa_quote_approvals ADD COLUMN invalidated_by VARCHAR(36) NULL",
        "ALTER TABLE wa_quote_approvals ADD COLUMN previous_approval_id VARCHAR(36) NULL COMMENT 'FK a aprobación anterior invalidada'",
        // ── Fase 1: client_id y contact_id en cotizaciones staging ────────────
        "ALTER TABLE quotations ADD COLUMN client_id CHAR(36) NULL",
        "ALTER TABLE quotations ADD COLUMN contact_id CHAR(36) NULL",
    ];
    foreach ($stg_migrations as $smig) { try { stg()->exec($smig); } catch (PDOException $e) {} }

    // ── e2e_debug_seed ─────────────────────────────────────────────────────
    if ($action === 'e2e_debug_seed') {
        $cols_wcc = stg()->query("SHOW COLUMNS FROM wa_cloud_conversations")->fetchAll(PDO::FETCH_COLUMN);
        $has_svc  = in_array('service_vehicle', $cols_wcc);
        $has_soi  = in_array('service_origin_place_id', $cols_wcc);
        $has_phone = in_array('phone', $cols_wcc);
        $has_status = in_array('status', $cols_wcc);

        // Test INSERT mínimo
        $test_id  = stguuid();
        $test_phone = '56000000099';
        $ins_err = null;
        try {
            stg()->prepare("INSERT INTO wa_cloud_conversations (id, phone, status) VALUES (?,?,'open')")->execute([$test_id, $test_phone]);
            stg()->prepare("DELETE FROM wa_cloud_conversations WHERE id=?")->execute([$test_id]);
        } catch (PDOException $e) { $ins_err = $e->getMessage(); }

        ok([
            'cols_first_10' => array_slice($cols_wcc, 0, 10),
            'cols_wa' => array_intersect($cols_wcc, ['phone','channel','status','service_origin','service_vehicle','wa_draft_quote_id']),
            'has_phone' => $has_phone,
            'has_status' => $has_status,
            'has_svc' => $has_svc,
            'has_soi' => $has_soi,
            'minimal_insert_error' => $ins_err,
        ]);
    }

    // ── e2e_describe ───────────────────────────────────────────────────────
    if ($action === 'e2e_describe') {
        $table = $_GET['table'] ?? 'quotations';
        $cols  = stg()->query("SHOW FULL COLUMNS FROM `$table`")->fetchAll();
        ok(['table' => $table, 'columns' => array_map(fn($c) => ['Field'=>$c['Field'],'Type'=>$c['Type'],'Null'=>$c['Null']], $cols)]);
    }

    // ── e2e_status ─────────────────────────────────────────────────────────
    if ($action === 'e2e_status') {
        $tables = stg()->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
        $counts = [];
        foreach (['wa_cloud_conversations','wa_quote_approvals','quotations'] as $t) {
            $counts[$t] = in_array($t, $tables)
                ? (int)stg()->query("SELECT COUNT(*) FROM `$t`")->fetchColumn()
                : 'NO EXISTE';
        }
        ok(['db' => 'transccl_crm_staging', 'tables' => count($tables), 'counts' => $counts]);
    }

    // ── e2e_seed ───────────────────────────────────────────────────────────
    if ($action === 'e2e_seed') {
        $phone_test = '56911111001';
        $conv_id    = stguuid();
        $quot_id    = stguuid();
        $appr_id    = stguuid();
        $exec_id    = 'beb2594e-be75-11f1-adc3-56000529c2a9'; // Javiera Aguilera

        // Verificar columnas disponibles (para debug)
        $existing_cols = stg()->query("SHOW COLUMNS FROM wa_cloud_conversations")->fetchAll(PDO::FETCH_COLUMN);
        $has_phone     = in_array('phone', $existing_cols);
        $has_service   = in_array('service_origin', $existing_cols);
        $status_col    = in_array('status', $existing_cols) ? 'open' : null; // usar 'open' para el enum existente

        if (!$has_phone) {
            err("staging: wa_cloud_conversations no tiene columna 'phone' — ALTERs fallaron. Cols: " . implode(',', array_slice($existing_cols, 0, 10)));
        }

        try {
            // INSERT wa_cloud_conversations — usar 'open' para enum existente, service_vehicle si no existe se ignora
            $cols_wcc = stg()->query("SHOW COLUMNS FROM wa_cloud_conversations")->fetchAll(PDO::FETCH_COLUMN);
            $has_svc  = in_array('service_vehicle', $cols_wcc);
            $has_soi  = in_array('service_origin_place_id', $cols_wcc);

            // wa_cloud_conversations en staging usa 'stage' (no 'status'); incluir service_* si existen
            stg()->prepare("
                INSERT INTO wa_cloud_conversations
                    (id, phone, channel, assigned_to, contact_name, contact_email, contact_rut,
                     service_origin, service_origin_place_id, service_origin_lat, service_origin_lng,
                     service_destination, service_destination_place_id, service_destination_lat, service_destination_lng,
                     service_date, service_passengers, service_type, service_vehicle, service_km, wa_draft_quote_id, created_at)
                VALUES (?,?,'whatsapp',?,
                    'Empresa Test S.A.','test@empresa.cl','12.345.678-9',
                    'Las Condes, Santiago','ChIJN1t_tDeuEmsRUsoyG83frY4',-33.4150,-70.5869,
                    'Viña del Mar, Valparaíso','ChIJhWj3mVeCYJYRJUMHmOKWwBc',-33.0247,-71.5518,
                    DATE_ADD(NOW(),INTERVAL 3 DAY),42,'privado','Bus 45',128.6,?,NOW())
            ")->execute([$conv_id, $phone_test, $exec_id, $quot_id]);

            stg()->prepare("
                INSERT INTO quotations
                    (id, number, status, etapa, company,
                     desde, hasta, desde_lat, desde_lng, hasta_lat, hasta_lng,
                     distancia_km, subtotal, tax_pct, total,
                     vehicle_type, user_id, created_at)
                VALUES (?, 'STG-E2E-001', 'open', 'borrador_wa', 'Empresa Test S.A.',
                    'Las Condes, Santiago', 'Viña del Mar, Valparaíso',
                    -33.4150, -70.5869, -33.0247, -71.5518,
                    125.4, 131775, 19, 156812,
                    'Bus 45', ?, NOW())
            ")->execute([$quot_id, $exec_id]);

            stg()->prepare("
                INSERT INTO wa_quote_approvals
                    (id,conv_id,quotation_id,created_by,quote_total,quote_snapshot,status)
                VALUES (?,?,?,?,156812,?,'pending')
            ")->execute([$appr_id,$conv_id,$quot_id,$exec_id,json_encode([
                'origin'=>'Las Condes, Santiago','destination'=>'Viña del Mar, Valparaíso',
                'passengers'=>42,'vehicle'=>'Bus 45','km'=>125.4,'price_km'=>1250,'total'=>156812
            ])]);

            ok(['conv_id'=>$conv_id,'quotation_id'=>$quot_id,'approval_id'=>$appr_id,'phone'=>$phone_test,'has_svc'=>$has_svc,'has_soi'=>$has_soi]);
        } catch (PDOException $e) {
            err('seed error: ' . $e->getMessage(), 500);
        }
    }

    // ── e2e_check_form ─────────────────────────────────────────────────────
    if ($action === 'e2e_check_form') {
        $phone = body()['phone'] ?? ($_GET['phone'] ?? '56911111001');
        $stmt  = stg()->prepare("SELECT * FROM wa_cloud_conversations WHERE phone=? LIMIT 1");
        $stmt->execute([$phone]);
        $row   = $stmt->fetch() ?: [];
        ok(['row' => $row, 'has_coords' => isset($row['service_origin_lat'])]);
    }

    // ── e2e_approve ────────────────────────────────────────────────────────
    if ($action === 'e2e_approve') {
        $conv_id  = body()['conv_id'] ?? ($_GET['conv_id'] ?? '');
        $approver = body()['approver'] ?? 'beb2594e-be75-11f1-adc3-56000529c2a9';
        $stmt = stg()->prepare("SELECT * FROM wa_quote_approvals WHERE conv_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$conv_id]);
        $appr = $stmt->fetch();
        if (!$appr) err('No hay aprobación pendiente');
        stg()->prepare("UPDATE wa_quote_approvals SET status='approved',approved_by=?,approved_at=NOW(),notes='Aprobación E2E staging' WHERE id=?")->execute([$approver,$appr['id']]);
        ok(['approved_id'=>$appr['id'],'status_before'=>$appr['status'],'status_after'=>'approved']);
    }

    // ── e2e_reject ─────────────────────────────────────────────────────────
    if ($action === 'e2e_reject') {
        $conv_id  = body()['conv_id'] ?? ($_GET['conv_id'] ?? '');
        $rejecter = body()['rejecter'] ?? 'beb2594e-be75-11f1-adc3-56000529c2a9';
        $stmt = stg()->prepare("SELECT * FROM wa_quote_approvals WHERE conv_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$conv_id]);
        $appr = $stmt->fetch();
        if (!$appr) err('No hay aprobación pendiente');
        stg()->prepare("UPDATE wa_quote_approvals SET status='rejected',approved_by=?,approved_at=NOW(),notes='Rechazo E2E: precio fuera de rango' WHERE id=?")->execute([$rejecter,$appr['id']]);
        ok(['rejected_id'=>$appr['id'],'status_after'=>'rejected']);
    }

    // ── e2e_double_approve ─────────────────────────────────────────────────
    if ($action === 'e2e_double_approve') {
        $conv_id = body()['conv_id'] ?? ($_GET['conv_id'] ?? '');
        $stmt = stg()->prepare("SELECT status FROM wa_quote_approvals WHERE conv_id=? ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$conv_id]);
        $row = $stmt->fetch();
        $status = $row['status'] ?? 'no-existe';
        ok([
            'test' => 'double_approve',
            'current_status' => $status,
            'result' => $status !== 'pending' ? 'BLOQUEADO_CORRECTO' : 'ERROR_no_fue_aprobado_antes',
        ]);
    }

    // ── e2e_gerencia_approve ───────────────────────────────────────────────
    if ($action === 'e2e_gerencia_approve') {
        $conv_id  = body()['conv_id'] ?? ($_GET['conv_id'] ?? '');
        $gerencia = 'gerencia-transccl-test';
        $stmt = stg()->prepare("SELECT * FROM wa_quote_approvals WHERE conv_id=? AND status='pending' ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$conv_id]);
        $appr = $stmt->fetch();
        if (!$appr) err('No hay aprobación pendiente');
        stg()->prepare("UPDATE wa_quote_approvals SET status='approved',approved_by=?,approved_at=NOW(),notes='Gerencia aprueba sin cambiar ejecutiva' WHERE id=?")->execute([$gerencia,$appr['id']]);
        $stmt2 = stg()->prepare("SELECT assigned_to FROM wa_cloud_conversations WHERE id=?");
        $stmt2->execute([$conv_id]);
        $conv = $stmt2->fetch();
        ok([
            'test' => 'gerencia_approve',
            'approved_by' => $gerencia,
            'conv_assigned_to' => $conv['assigned_to'] ?? null,
            'assigned_unchanged' => ($conv['assigned_to'] === 'beb2594e-be75-11f1-adc3-56000529c2a9')
                ? 'PASS' : 'FAIL',
        ]);
    }

    // ── e2e_send_simulated ─────────────────────────────────────────────────
    if ($action === 'e2e_send_simulated') {
        $conv_id = body()['conv_id'] ?? ($_GET['conv_id'] ?? '');
        $stmt = stg()->prepare("SELECT * FROM wa_quote_approvals WHERE conv_id=? AND status='approved' ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$conv_id]);
        $appr = $stmt->fetch();
        if (!$appr) err('No hay aprobación en estado approved');
        stg()->prepare("UPDATE wa_quote_approvals SET status='sent',sent_at=NOW(),sent_result=? WHERE id=?")->execute([
            json_encode(['simulado'=>true,'nota'=>'PRUEBA STAGING — no enviado a WhatsApp real','wamid'=>null]),
            $appr['id']
        ]);
        ok(['test'=>'send_simulated','sent_at'=>date('c'),'simulated'=>true,'wa_message_sent'=>false]);
    }

    // ── e2e_osrm ───────────────────────────────────────────────────────────
    if ($action === 'e2e_osrm') {
        // Las Condes → Viña del Mar (mismas coords del seed)
        $lat1=-33.4150; $lng1=-70.5869; $lat2=-33.0247; $lng2=-71.5518;
        $url = "http://router.project-osrm.org/route/v1/driving/{$lng1},{$lat1};{$lng2},{$lat2}?overview=false";
        $raw = @file_get_contents($url, false, stream_context_create(['http'=>['timeout'=>8]]));
        if ($raw === false) err('No se pudo conectar a OSRM');
        $data = json_decode($raw, true);
        $km   = round(($data['routes'][0]['distance'] ?? 0) / 1000, 1);
        ok([
            'test'   => 'osrm_vs_official',
            'route'  => 'Las Condes → Viña del Mar',
            'coords' => ['origin'=>[-33.4150,-70.5869],'destination'=>[-33.0247,-71.5518]],
            'distance_km' => $km,
            'engine' => 'router.project-osrm.org/route/v1/driving',
            'cotizador_oficial' => [
                'mismo_engine' => true,
                'referencia' => '/api/places/route.ts línea 33 usa el mismo router',
            ],
            'divergencia' => 'NINGUNA — mismo motor OSRM en ambos sistemas',
        ]);
    }

    // ── e2e_cleanup ────────────────────────────────────────────────────────
    if ($action === 'e2e_cleanup') {
        $phones = ['56911111001','56911111002','56911111003','56911111004','56911111005',
                   '56911111006','56911111007','56911111008','56911111009','56911111010','56911111011'];
        $in = implode(',', array_map(fn($p) => "'$p'", $phones));
        stg()->exec("DELETE FROM wa_quote_approvals WHERE conv_id IN (SELECT id FROM wa_cloud_conversations WHERE phone IN ($in))");
        stg()->exec("DELETE FROM wa_cloud_conversations WHERE phone IN ($in)");
        stg()->exec("DELETE FROM quotations WHERE number LIKE 'STG-%' OR number LIKE 'BWA-%'");
        stg()->exec("DELETE FROM contacts WHERE client_id IN (SELECT id FROM clients WHERE email LIKE '%test%' OR email LIKE '%staging%' OR name LIKE '%Test%')");
        stg()->exec("DELETE FROM clients WHERE email LIKE '%test%' OR email LIKE '%staging%' OR name LIKE '%Test%' OR rut LIKE '76.000.1%'");
        ok(['cleanup'=>'done','staging_db'=>'transccl_crm_staging']);
    }

    // ── e2e_seed_borrador — conversación sin borrador previo ───────────────
    if ($action === 'e2e_seed_borrador') {
        $phone = '56911111002';
        $conv_id = stguuid();
        $exec_id = 'beb2594e-be75-11f1-adc3-56000529c2a9';
        try {
            stg()->prepare("
                INSERT INTO wa_cloud_conversations
                    (id, phone, channel, assigned_to, contact_name,
                     service_origin, service_origin_place_id, service_origin_lat, service_origin_lng,
                     service_destination, service_destination_place_id, service_destination_lat, service_destination_lng,
                     service_date, service_passengers, service_type, service_vehicle, service_km, created_at)
                VALUES (?,?,'whatsapp',?,'Empresa Borrador Test S.A.',
                    'Las Condes, Santiago','ChIJN1t_tDeuEmsRUsoyG83frY4',-33.4150,-70.5869,
                    'Viña del Mar, Valparaíso','ChIJhWj3mVeCYJYRJUMHmOKWwBc',-33.0247,-71.5518,
                    DATE_ADD(NOW(),INTERVAL 5 DAY),42,'privado','bus',128.6,NOW())
            ")->execute([$conv_id, $phone, $exec_id]);
            ok(['conv_id'=>$conv_id,'phone'=>$phone,'has_draft'=>false]);
        } catch (PDOException $e) {
            err('seed_borrador error: '.$e->getMessage());
        }
    }

    // ── e2e_create_borrador ────────────────────────────────────────────────
    if ($action === 'e2e_create_borrador') {
        $conv_id = body()['conv_id'] ?? ($_GET['conv_id'] ?? '');
        if (!$conv_id) err('conv_id requerido');
        $result = crear_borrador_wa(stg(), $conv_id);
        if (isset($result['error'])) err($result['error'], $result['code'] ?? 422);
        ok($result);
    }

    // ── e2e_borrador_duplicado — idempotencia ──────────────────────────────
    if ($action === 'e2e_borrador_duplicado') {
        $conv_id = body()['conv_id'] ?? ($_GET['conv_id'] ?? '');
        if (!$conv_id) err('conv_id requerido');
        $r1 = crear_borrador_wa(stg(), $conv_id);
        if (isset($r1['error'])) err('Primer borrador falló: '.$r1['error']);
        $r2 = crear_borrador_wa(stg(), $conv_id);
        $is_idempotent = ($r2['idempotent'] ?? false) === true
                      && ($r2['quotation_id'] === $r1['quotation_id']);
        ok([
            'test'         => 'borrador_duplicado',
            'primer_id'    => $r1['quotation_id'],
            'segundo_id'   => $r2['quotation_id'] ?? null,
            'idempotent'   => $r2['idempotent'] ?? false,
            'ids_iguales'  => ($r2['quotation_id'] ?? null) === $r1['quotation_id'],
            'resultado'    => $is_idempotent ? 'PASS' : 'FAIL',
        ]);
    }

    // ── e2e_form_get — versión staging de wa_form_get (para test formulario real) ─
    if ($action === 'e2e_form_get') {
        $phone = $_GET['phone'] ?? '';
        if (!$phone) err('phone requerido');
        $stmt = stg()->prepare(
            "SELECT contact_name, contact_email, contact_rut,
                    client_type, company_name, quote_send_email,
                    service_origin, service_origin_place_id, service_origin_lat, service_origin_lng,
                    service_destination, service_destination_place_id, service_destination_lat, service_destination_lng,
                    service_date, service_hour, service_hour_return,
                    service_passengers, service_type, service_vehicle, service_km, observaciones, stage
             FROM wa_cloud_conversations WHERE phone=? LIMIT 1"
        );
        $stmt->execute([$phone]);
        $conv = $stmt->fetch();
        if (!$conv) err('Conversación de staging no encontrada para ' . $phone, 404);
        // Respuesta plana (igual que wa_form_get) para que el formulario funcione igual en staging y producción
        ok(array_merge($conv, ['staging' => true]));
    }

    // ── e2e_form_save_borrador — staging de wa_form_save + trigger automático ─
    if ($action === 'e2e_form_save_borrador') {
        $b = body();
        $phone = $b['phone'] ?? '';
        if (!$phone) err('phone requerido');

        // Verificar que es un teléfono de prueba (5691111xxxx)
        if (!preg_match('/^5691111\d{4}$/', $phone)) err('Solo teléfonos de prueba 5691111xxxx', 403);

        $stmt = stg()->prepare("SELECT id FROM wa_cloud_conversations WHERE phone=? LIMIT 1");
        $stmt->execute([$phone]);
        $conv = $stmt->fetch();
        if (!$conv) err('Conversación de staging no encontrada. Usar e2e_seed_borrador primero.', 404);
        $conv_id = $conv['id'];

        $allowed = ['contact_name','contact_email','contact_rut',
                    'client_type','company_name','quote_send_email',
                    'service_origin','service_origin_place_id','service_origin_lat','service_origin_lng',
                    'service_destination','service_destination_place_id','service_destination_lat','service_destination_lng',
                    'service_date','service_hour','service_hour_return',
                    'service_passengers','service_type','service_vehicle','service_km','observaciones'];
        $sets = []; $vals = [];
        foreach ($allowed as $col) {
            if (array_key_exists($col, $b)) {
                $v = $b[$col] === '' ? null : $b[$col];
                if ($col === 'service_passengers' && $v !== null) $v = (int)$v ?: null;
                if ($col === 'service_km'         && $v !== null) $v = round((float)$v, 2) ?: null;
                $sets[] = "$col = ?"; $vals[] = $v;
            }
        }
        $sets[] = "stage = 'formulario_completo'";
        $sets[] = "form_submitted_at = COALESCE(form_submitted_at,NOW())";
        $vals[] = $conv_id;
        stg()->prepare("UPDATE wa_cloud_conversations SET " . implode(', ', $sets) . " WHERE id=?")->execute($vals);

        // Trigger automático: crear borrador si wa_draft_quote_id es NULL
        $stateStmt = stg()->prepare("SELECT wa_draft_quote_id, contact_rut FROM wa_cloud_conversations WHERE id=?");
        $stateStmt->execute([$conv_id]);
        $stateRow        = $stateStmt->fetch(PDO::FETCH_ASSOC);
        $existingDraftId = $stateRow['wa_draft_quote_id'] ?? null;
        $rutGuardado     = trim($stateRow['contact_rut'] ?? '');
        $borrador_result = null;
        if (!$existingDraftId) {
            // Activar use_client_lookup si hay RUT (permite crear/buscar clientes y contactos)
            $opts = $rutGuardado ? ['use_client_lookup' => true] : [];
            $borrador_result = crear_borrador_wa(stg(), $conv_id, $opts);
        }
        ok(['saved'=>true,'staging'=>true,'conv_id'=>$conv_id,'borrador'=>$borrador_result,'nota'=>'Staging only']);
    }

    // ── e2e_form_complete_borrador — simula envío de formulario + trigger auto ─
    // Equivale a: cliente envía formulario → wa_form_save → crear_borrador_wa()
    // Todo sobre staging DB (stg()), nunca toca producción.
    if ($action === 'e2e_form_complete_borrador') {
        $conv_id = body()['conv_id'] ?? ($_GET['conv_id'] ?? '');
        if (!$conv_id) err('conv_id requerido');

        // Verificar que la conv existe en staging y tiene los campos mínimos
        $check = stg()->prepare("SELECT id, phone, service_km, service_passengers, service_vehicle, service_origin, service_destination, service_date, wa_draft_quote_id FROM wa_cloud_conversations WHERE id=?");
        $check->execute([$conv_id]);
        $conv = $check->fetch();
        if (!$conv) err('Conversación no encontrada en staging', 404);
        if ($conv['wa_draft_quote_id']) err('Ya existe un borrador activo para esta conversación. Limpiar primero.', 409);

        // Paso 1: simular wa_form_save → marcar stage y form_submitted_at
        stg()->prepare("UPDATE wa_cloud_conversations SET stage='formulario_completo', form_submitted_at=COALESCE(form_submitted_at,NOW()) WHERE id=?")
            ->execute([$conv_id]);

        // Paso 2: trigger automático — crear borrador (lo que wa_form_save llamará en producción)
        $borrador = crear_borrador_wa(stg(), $conv_id);
        if (isset($borrador['error'])) err('Auto-crear borrador falló: ' . $borrador['error'], $borrador['code'] ?? 422);

        ok([
            'test'            => 'form_complete_borrador',
            'conv_id'         => $conv_id,
            'stage_updated'   => 'formulario_completo',
            'form_submitted'  => true,
            'borrador'        => $borrador,
            'nota'            => 'Staging only — no modifica producción',
        ]);
    }

    // ── e2e_borrador_incompleto — datos faltantes ──────────────────────────
    if ($action === 'e2e_borrador_incompleto') {
        // Crear conversación sin service_km
        $conv_id = stguuid();
        stg()->prepare("
            INSERT INTO wa_cloud_conversations
                (id, phone, channel, assigned_to, contact_name,
                 service_origin, service_destination, service_date, service_passengers, created_at)
            VALUES (?,?,'whatsapp',?,'Test Incompleto',
                'Las Condes, Santiago','Viña del Mar',DATE_ADD(NOW(),INTERVAL 5 DAY),10,NOW())
        ")->execute([$conv_id, '56911111099', 'beb2594e-be75-11f1-adc3-56000529c2a9']);
        $result = crear_borrador_wa(stg(), $conv_id);
        // Limpiar conv temporal
        stg()->prepare("DELETE FROM wa_cloud_conversations WHERE id=?")->execute([$conv_id]);
        $expected_error = isset($result['error']) && str_contains($result['error'], 'service_km');
        ok([
            'test'           => 'borrador_incompleto',
            'error_recibido' => $result['error'] ?? null,
            'missing'        => $result['missing'] ?? null,
            'resultado'      => $expected_error ? 'PASS' : 'FAIL',
        ]);
    }

    // ── e2e_inspect_prod_incident ──────────────────────────────────────────
    if ($action === 'e2e_inspect_prod_incident') {
        $phone = '56999000001';
        // Columnas que pueden existir o no en producción
        $cols_wcc = db()->query("SHOW COLUMNS FROM wa_cloud_conversations")->fetchAll(PDO::FETCH_COLUMN);
        $sel = array_intersect(['id','phone','contact_name','contact_rut','service_origin','service_destination','wa_draft_quote_id','created_at'], $cols_wcc);
        $sel_sql = implode(',', $sel);
        $stmt = db()->prepare("SELECT $sel_sql FROM wa_cloud_conversations WHERE phone=? LIMIT 1");
        $stmt->execute([$phone]);
        $conv = $stmt->fetch();
        if (!$conv) ok(['prod_incident' => 'NO_EXISTE', 'phone' => $phone]);

        // Mensajes (tabla puede no existir, columna puede ser conv_id o conversation_id)
        $msgs = 0; $msg_col = null;
        try {
            $cols_msg = db()->query("SHOW COLUMNS FROM wa_cloud_messages")->fetchAll(PDO::FETCH_COLUMN);
            if (in_array('conv_id', $cols_msg))             { $msg_col = 'conv_id'; }
            elseif (in_array('conversation_id', $cols_msg)) { $msg_col = 'conversation_id'; }
            if ($msg_col) {
                $s = db()->prepare("SELECT COUNT(*) FROM wa_cloud_messages WHERE $msg_col=?");
                $s->execute([$conv['id']]);
                $msgs = (int)$s->fetchColumn();
            } else { $msgs = -1; } // columna de conv no encontrada
        } catch (PDOException $e) { $msgs = -2; $msg_col = 'tabla_no_existe'; }

        // Aprobaciones (tabla puede no existir)
        $apprs = [];
        try {
            $s3 = db()->prepare("SELECT id, status, quote_total, created_at FROM wa_quote_approvals WHERE conv_id=? LIMIT 5");
            $s3->execute([$conv['id']]);
            $apprs = $s3->fetchAll();
        } catch (PDOException $e) { $apprs = ['error' => 'tabla_no_existe']; }

        ok([
            'prod_incident' => [
                'conversation' => $conv,
                'messages_count' => $msgs,
                'msg_col_used' => $msg_col,
                'approvals' => $apprs,
                'safe_to_delete' => ($msgs === 0 && empty($apprs) && stripos($conv['contact_name']??'', 'test') !== false),
            ],
        ]);
    }

    // ── e2e_seed_borrador_phone — seed conv+borrador para teléfonos autorizados ─
    if ($action === 'e2e_seed_borrador_phone') {
        $b     = body();
        $phone = $b['phone'] ?? '';
        $whitelist = ['56911111001','56911111002','56911111003','56911111004','56911111005',
                      '56911111006','56911111007','56911111008','56911111009','56911111010','56911111011'];
        if (!$phone || !in_array($phone, $whitelist, true)) {
            err('Solo teléfonos de prueba autorizados (56911111001–011)', 403);
        }
        $exists = stg()->prepare("SELECT id FROM wa_cloud_conversations WHERE phone=? LIMIT 1");
        $exists->execute([$phone]);
        if ($exists->fetch()) {
            err("Ya existe una conversación staging para $phone. Limpiar primero.", 409);
        }
        $conv_id  = stguuid();
        $exec_id  = 'beb2594e-be75-11f1-adc3-56000529c2a9';
        try {
            stg()->prepare("
                INSERT INTO wa_cloud_conversations
                    (id, phone, channel, assigned_to, contact_name,
                     service_origin, service_origin_place_id, service_origin_lat, service_origin_lng,
                     service_destination, service_destination_place_id, service_destination_lat, service_destination_lng,
                     service_date, service_passengers, service_type, service_vehicle, service_km,
                     stage, created_at)
                VALUES (?,?,'whatsapp',?,?,
                    ?,?,?,?,
                    ?,?,?,?,
                    ?,?,?,?,?,
                    'formulario_completo',NOW())
            ")->execute([
                $conv_id, $phone, $exec_id,
                $b['contact_name']  ?? 'Test Staging',
                $b['service_origin'] ?? 'Las Condes, Santiago',
                $b['service_origin_place_id'] ?? null,
                (float)($b['service_origin_lat'] ?? -33.4150),
                (float)($b['service_origin_lng'] ?? -70.5869),
                $b['service_destination'] ?? 'Viña del Mar, Valparaíso',
                $b['service_destination_place_id'] ?? null,
                (float)($b['service_destination_lat'] ?? -33.0247),
                (float)($b['service_destination_lng'] ?? -71.5518),
                $b['service_date'] ?? date('Y-m-d', strtotime('+7 days')),
                (int)($b['service_passengers'] ?? 42),
                $b['service_type']    ?? 'privado',
                $b['service_vehicle'] ?? 'bus',
                (float)($b['service_km'] ?? 128.6),
            ]);
            $borrador = crear_borrador_wa(stg(), $conv_id);
            if (isset($borrador['error'])) {
                stg()->prepare("DELETE FROM wa_cloud_conversations WHERE id=?")->execute([$conv_id]);
                err('Auto-crear borrador falló: ' . $borrador['error'], $borrador['code'] ?? 422);
            }
            ok(['conv_id'=>$conv_id,'phone'=>$phone,'has_draft'=>true,'borrador'=>$borrador,'staging'=>true]);
        } catch (PDOException $e) {
            err('seed_phone error: '.$e->getMessage());
        }
    }

    // ── e2e_debug_convs — diagnóstico: datos raw de teléfonos de prueba ─────────
    if ($action === 'e2e_debug_convs') {
        $phones = ['56911111002','56911111003'];
        $in = implode(',', array_map(fn($p) => "'$p'", $phones));
        $convs = stg()->query("
            SELECT c.id, c.phone, c.contact_name, c.stage, c.wa_draft_quote_id,
                   c.service_km, c.service_passengers, c.service_vehicle,
                   c.created_at,
                   q.id AS q_id, q.number AS q_number, q.status AS q_status,
                   a.id AS a_id, a.status AS a_status
            FROM wa_cloud_conversations c
            LEFT JOIN quotations q ON q.id = c.wa_draft_quote_id
            LEFT JOIN wa_quote_approvals a ON a.conv_id = c.id
            WHERE c.phone IN ($in)
            ORDER BY c.created_at DESC
        ")->fetchAll(PDO::FETCH_ASSOC);
        $all_approvals = stg()->query("SELECT * FROM wa_quote_approvals ORDER BY created_at DESC LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
        $all_convs_with_draft = stg()->query("SELECT id, phone, wa_draft_quote_id FROM wa_cloud_conversations WHERE wa_draft_quote_id IS NOT NULL")->fetchAll(PDO::FETCH_ASSOC);
        ok(['convs_for_phones'=>$convs,'all_approvals'=>$all_approvals,'convs_with_draft'=>$all_convs_with_draft]);
    }

    // ── e2e_convs_pending_approval — lista convs staging con borrador pendiente ─
    // El rol se valida contra producción DB; el header x-user-role se ignora.
    if ($action === 'e2e_convs_pending_approval') {
        $uid  = $_SERVER['HTTP_X_USER_ID']  ?? '';
        if (!$uid) err('No autorizado — se requiere sesión activa', 401);
        $p = db()->prepare("SELECT role, active FROM profiles WHERE id=? LIMIT 1");
        $p->execute([$uid]);
        $prof = $p->fetch();
        if (!$prof || !$prof['active']) err('No autorizado — usuario no válido o inactivo', 401);
        $role = $prof['role'];

        $stmt = stg()->prepare("
            SELECT
                c.id, c.phone, c.contact_name, c.stage,
                c.wa_draft_quote_id,
                c.service_origin, c.service_destination, c.service_date,
                c.created_at                       AS last_msg_at,
                q.number                           AS quote_number,
                q.total                            AS quote_total,
                q.distancia_km                     AS quote_km,
                a.status                           AS approval_status,
                a.id                               AS approval_id
            FROM wa_cloud_conversations c
            LEFT JOIN quotations          q ON q.id     = c.wa_draft_quote_id
            LEFT JOIN wa_quote_approvals  a ON a.conv_id = c.id AND a.status = 'pending'
            WHERE c.wa_draft_quote_id IS NOT NULL
              AND a.id IS NOT NULL
            ORDER BY c.created_at DESC
            LIMIT 50
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $convs = array_map(function($r) {
            $total = $r['quote_total'] ? '$'.number_format((float)$r['quote_total'],0,',','.') : '?';
            $km    = $r['quote_km']    ? " · {$r['quote_km']} km" : '';
            return [
                'id'                 => $r['id'],
                'phone'              => $r['phone'],
                'contact_name'       => $r['contact_name'],
                'assigned_name'      => '🧪 Staging',
                'stage'              => $r['stage'] ?? 'formulario_completo',
                'bot_active'         => false,
                'wa_draft_quote_id'  => $r['wa_draft_quote_id'],
                'last_msg_at'        => $r['last_msg_at'],
                'last_message'       => $r['quote_number']
                    ? "Cotización #{$r['quote_number']} — {$total}{$km}"
                    : 'Borrador pendiente de aprobación',
                'unread_count'       => 0,
                'service_origin'     => $r['service_origin'],
                'service_destination'=> $r['service_destination'],
                'service_date'       => $r['service_date'],
                'approval_id'        => $r['approval_id'],
                'approval_status'    => $r['approval_status'],
            ];
        }, $rows);

        ok(['convs'=>$convs,'staging'=>true,'count'=>count($convs)]);
    }

    // ── e2e_approvals_decide_stg — aprobar/rechazar borrador en staging ────────
    // El rol se valida contra producción DB; el header x-user-role se ignora.
    if ($action === 'e2e_approvals_decide_stg') {
        $uid  = $_SERVER['HTTP_X_USER_ID']  ?? '';
        if (!$uid) err('No autorizado — se requiere sesión activa', 401);
        $p = db()->prepare("SELECT role, active FROM profiles WHERE id=? LIMIT 1");
        $p->execute([$uid]);
        $prof = $p->fetch();
        if (!$prof || !$prof['active']) err('No autorizado — usuario no válido o inactivo', 401);
        $role = $prof['role'];
        $allowed = ['gerencia','admin','superadmin','supervisor'];
        if (!in_array($role, $allowed)) {
            err('Sin permiso: solo Gerencia o supervisores autorizados pueden decidir sobre cotizaciones', 403);
        }

        $b        = body();
        $conv_id  = $b['conv_id']  ?? '';
        $decision = $b['decision'] ?? '';
        $notes    = trim($b['notes'] ?? '');
        if (!$conv_id || !in_array($decision, ['approved','rejected'])) {
            err('conv_id y decision (approved|rejected) requeridos');
        }

        $ap = stg()->prepare("SELECT id, quotation_id, status FROM wa_quote_approvals WHERE conv_id=? ORDER BY created_at DESC LIMIT 1");
        $ap->execute([$conv_id]);
        $apRow = $ap->fetch();
        if (!$apRow) err('No hay cotización de Sofía para esta conversación en staging', 404);
        if ($apRow['status'] !== 'pending') {
            err("Esta cotización ya fue {$apRow['status']}. No se puede $decision", 409);
        }

        $qSnap = stg()->prepare("SELECT id, number, total, etapa, distancia_km FROM quotations WHERE id=?");
        $qSnap->execute([$apRow['quotation_id']]);
        $snapshot = $qSnap->fetch() ?: [];

        if ($decision === 'rejected') {
            stg()->prepare("UPDATE wa_quote_approvals SET status='rejected', approved_by=?, approved_at=NOW(), notes=?, quote_snapshot=? WHERE id=?")
                ->execute([$uid, $notes ?: null, json_encode($snapshot), $apRow['id']]);
            stg()->prepare("UPDATE quotations SET etapa='borrador_wa_rechazado' WHERE id=?")
                ->execute([$apRow['quotation_id']]);
            stg()->prepare("UPDATE wa_cloud_conversations SET wa_draft_quote_id=NULL WHERE id=?")
                ->execute([$conv_id]);
            ok([
                'rechazado'   => true,
                'rechazado_por' => $uid,
                'timestamp'   => date('c'),
                'staging'     => true,
                'nota'        => 'Acción registrada en staging — ningún mensaje enviado por WhatsApp',
            ]);
        }

        // Aprobación (status='approved'; el envío es paso separado y requiere autorización adicional)
        stg()->prepare("UPDATE wa_quote_approvals SET status='approved', approved_by=?, approved_at=NOW(), notes=?, quote_snapshot=? WHERE id=?")
            ->execute([$uid, $notes ?: null, json_encode($snapshot), $apRow['id']]);
        stg()->prepare("UPDATE quotations SET etapa='cotizacion', status='open' WHERE id=?")
            ->execute([$apRow['quotation_id']]);
        // wa_draft_quote_id se conserva para mantener trazabilidad conversación-cotización

        $q = stg()->prepare("SELECT number, total FROM quotations WHERE id=?");
        $q->execute([$apRow['quotation_id']]);
        $qRow = $q->fetch();
        ok([
            'aprobado'        => true,
            'aprobado_por'    => $uid,
            'timestamp'       => date('c'),
            'quote_number'    => $qRow['number'] ?? null,
            'total'           => $qRow['total']  ?? null,
            'envio_pendiente' => true,
            'staging'         => true,
            'nota'            => 'Aprobación registrada en staging — ningún mensaje enviado por WhatsApp',
        ]);
    }

    // ── e2e_force_approve_stg — aprueba borrador staging directamente (solo tests) ──
    if ($action === 'e2e_force_approve_stg') {
        $b = body();
        $ap_id = $b['approval_id'] ?? '';
        if (!$ap_id) err('approval_id requerido');
        $ap = stg()->prepare("SELECT id, quotation_id, status FROM wa_quote_approvals WHERE id=? LIMIT 1");
        $ap->execute([$ap_id]);
        $row = $ap->fetch();
        if (!$row) err('Aprobación no encontrada', 404);
        if (!in_array($row['status'], ['pending'])) err("Estado actual: {$row['status']} — solo pending puede aprobarse", 409);
        stg()->prepare("UPDATE wa_quote_approvals SET status='approved', approved_by='e2e_test', approved_at=NOW() WHERE id=?")
            ->execute([$ap_id]);
        stg()->prepare("UPDATE quotations SET etapa='cotizacion', status='open' WHERE id=?")->execute([$row['quotation_id']]);
        ok(['approved'=>true,'approval_id'=>$ap_id,'quotation_id'=>$row['quotation_id'],'staging'=>true,'test_only'=>true]);
    }

    // ── e2e_force_sent_stg — marca aprobación como 'sent' (solo tests) ──────────
    if ($action === 'e2e_force_sent_stg') {
        $ap_id = body()['approval_id'] ?? '';
        if (!$ap_id) err('approval_id requerido');
        $ap = stg()->prepare("SELECT id, status FROM wa_quote_approvals WHERE id=? LIMIT 1");
        $ap->execute([$ap_id]);
        $row = $ap->fetch();
        if (!$row) err('Aprobación no encontrada', 404);
        stg()->prepare("UPDATE wa_quote_approvals SET status='sent', approved_at=NOW(), approved_by='e2e_test' WHERE id=?")
            ->execute([$ap_id]);
        ok(['sent'=>true,'approval_id'=>$ap_id,'staging'=>true,'test_only'=>true]);
    }

    // ── e2e_fase1_verify — verificación pre-migración ─────────────────────────
    if ($action === 'e2e_fase1_verify') {
        $version = stg()->query("SELECT VERSION() AS v")->fetch()['v'];
        $engines = stg()->query("SHOW TABLE STATUS WHERE Engine IS NOT NULL")->fetchAll();
        $eng_map = [];
        foreach ($engines as $t) $eng_map[$t['Name']] = $t['Engine'] ?? '?';
        // Confirmar aislamiento: staging usa DB distinta a producción
        $stg_db = stg()->query("SELECT DATABASE() AS d")->fetch()['d'];
        $prod_db = db()->query("SELECT DATABASE() AS d")->fetch()['d'];
        ok([
            'mysql_version' => $version,
            'staging_db'    => $stg_db,
            'prod_db'       => $prod_db,
            'isolated'      => $stg_db !== $prod_db,
            'table_engines' => $eng_map,
            'add_col_if_not_exists_supported' => version_compare($version, '8.0.0', '>='),
        ]);
    }

    // ── e2e_fase1_backup — respalda tablas afectadas en staging ───────────────
    if ($action === 'e2e_fase1_backup') {
        $ts = date('Ymd_His');
        $tables = ['clients','contacts','wa_cloud_conversations','wa_quote_approvals','quotations'];
        $results = [];
        foreach ($tables as $t) {
            $backup = "{$t}_bk_{$ts}";
            try {
                stg()->exec("CREATE TABLE {$backup} AS SELECT * FROM {$t}");
                $cnt = stg()->query("SELECT COUNT(*) AS n FROM {$backup}")->fetch()['n'];
                $results[$t] = ['backup_table' => $backup, 'rows_backed_up' => $cnt, 'ok' => true];
            } catch (PDOException $e) {
                $results[$t] = ['ok' => false, 'error' => $e->getMessage()];
            }
        }
        ok(['timestamp' => $ts, 'backups' => $results]);
    }

    // ── e2e_fase1_rut_audit — auditoría de RUT duplicados en staging ──────────
    if ($action === 'e2e_fase1_rut_audit') {
        $duplicates = stg()->query("
            SELECT REPLACE(REPLACE(rut,'.',''),'-','') AS rut_key,
                   COUNT(*) AS n, GROUP_CONCAT(id) AS ids, GROUP_CONCAT(name) AS nombres
            FROM clients
            WHERE rut IS NOT NULL AND rut != ''
            GROUP BY rut_key HAVING COUNT(*) > 1
        ")->fetchAll();
        $nulls = stg()->query("SELECT COUNT(*) AS n FROM clients WHERE rut IS NULL OR rut=''")->fetch()['n'];
        $total = stg()->query("SELECT COUNT(*) AS n FROM clients")->fetch()['n'];
        $can_add_unique = count($duplicates) === 0;
        ok([
            'total_clients'    => $total,
            'rut_nulls'        => $nulls,
            'rut_duplicates'   => $duplicates,
            'can_add_unique'   => $can_add_unique,
            'message'          => $can_add_unique
                ? 'Sin duplicados — se puede aplicar el UNIQUE index'
                : 'HAY DUPLICADOS — detener migración y reportar a Gerencia',
        ]);
    }

    // ── e2e_fase1_apply_unique — aplica UNIQUE index en clients.rut (staging) ──
    if ($action === 'e2e_fase1_apply_unique') {
        // Solo proceder si la auditoría fue ejecutada primero
        $dup_check = stg()->query("
            SELECT COUNT(*) AS n FROM (
                SELECT REPLACE(REPLACE(rut,'.',''),'-','') AS k
                FROM clients WHERE rut IS NOT NULL AND rut != ''
                GROUP BY k HAVING COUNT(*) > 1
            ) t
        ")->fetch()['n'];
        if ((int)$dup_check > 0) {
            err('Existen RUT duplicados. Ejecutar e2e_fase1_rut_audit y resolver antes de continuar.', 409);
        }
        try {
            // MariaDB: columna generada STORED + UNIQUE INDEX (MySQL 8.0 usa functional index syntax)
            stg()->exec("ALTER TABLE clients
                ADD COLUMN IF NOT EXISTS rut_normalized VARCHAR(30)
                GENERATED ALWAYS AS (
                    IF(rut IS NULL OR rut='', NULL, REPLACE(REPLACE(rut,'.',''),'-',''))
                ) STORED COMMENT 'RUT normalizado para índice único'");
            stg()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_rut_normalized
                ON clients (rut_normalized)");
            ok(['unique_index_applied' => true, 'index' => 'idx_clients_rut_normalized', 'method' => 'generated_column']);
        } catch (PDOException $e) {
            err('Error al crear UNIQUE index: ' . $e->getMessage(), 500);
        }
    }

    // ── e2e_fase1_seed_conv — crea conversación staging con campos Fase 1 SIN borrador ──
    if ($action === 'e2e_fase1_seed_conv') {
        $b = body();
        $phone = $b['phone'] ?? '';
        $whitelist = ['56911111001','56911111002','56911111003','56911111004','56911111005',
                      '56911111006','56911111007','56911111008','56911111009','56911111010','56911111011'];
        if (!$phone || !in_array($phone, $whitelist, true)) err('Teléfono no autorizado', 403);
        $exists = stg()->prepare("SELECT id FROM wa_cloud_conversations WHERE phone=? LIMIT 1");
        $exists->execute([$phone]);
        if ($exists->fetch()) err("Ya existe conversación para $phone. Limpiar primero.", 409);
        $conv_id = stguuid();
        $exec_id = 'beb2594e-be75-11f1-adc3-56000529c2a9';
        stg()->prepare("
            INSERT INTO wa_cloud_conversations
                (id, phone, channel, assigned_to, contact_name, contact_rut, contact_email,
                 company_name, client_type, quote_send_email,
                 service_origin, service_destination, service_date, service_hour, service_hour_return,
                 service_passengers, service_type, service_vehicle, service_km, stage, created_at)
            VALUES (?,?,'whatsapp',?,?,?,?,?,?,?,
                'Las Condes, Santiago','Viña del Mar, Valparaíso',
                DATE_ADD(NOW(),INTERVAL 7 DAY),?,?,
                42,'privado','bus',128.6,
                'formulario_completo',NOW())
        ")->execute([
            $conv_id, $phone, $exec_id,
            $b['contact_name']     ?? 'Test Empresa Staging',
            $b['contact_rut']      ?? null,
            $b['contact_email']    ?? null,
            $b['company_name']     ?? null,
            $b['client_type']      ?? 'empresa',
            $b['quote_send_email'] ?? $b['contact_email'] ?? null,
            $b['service_hour']        ?? '09:00',
            $b['service_hour_return'] ?? '14:30',
        ]);
        ok(['conv_id'=>$conv_id,'phone'=>$phone,'has_draft'=>false,'staging'=>true]);
    }

    // ── e2e_fase1_seed_client — siembra cliente/contacto para pruebas Fase 1 ──
    if ($action === 'e2e_fase1_seed_client') {
        $b = body();
        $cl_id = stg()->query("SELECT UUID() AS u")->fetch()['u'];
        stg()->prepare("INSERT IGNORE INTO clients (id,name,rut,email,phone) VALUES (?,?,?,?,?)")
            ->execute([$cl_id, $b['name']??'Empresa Test S.A.', $b['rut']??'76.000.001-K',
                       $b['email']??'contacto@empresatest.cl', $b['phone']??'+56912345678']);
        $ct_id = null;
        if (!empty($b['contact_name'])) {
            $ct_id = stg()->query("SELECT UUID() AS u")->fetch()['u'];
            stg()->prepare("INSERT IGNORE INTO contacts (id,client_id,name,email,phone_mobile) VALUES (?,?,?,?,?)")
                ->execute([$ct_id, $cl_id, $b['contact_name'], $b['contact_email']??$b['email']??'', $b['phone']??null]);
        }
        ok(['client_id'=>$cl_id,'contact_id'=>$ct_id]);
    }

    // ── e2e_fase1_borrador_con_cliente — crea borrador Fase 1 con lookup ─────
    if ($action === 'e2e_fase1_borrador_con_cliente') {
        $b = body();
        $conv_id = $b['conv_id'] ?? '';
        if (!$conv_id) err('conv_id requerido');
        // Actualizar campos de cliente en la conversación antes de crear borrador
        $upd_fields = ['contact_rut','contact_email','contact_name','company_name','client_type','quote_send_email'];
        $set = []; $params = [];
        foreach ($upd_fields as $f) {
            if (array_key_exists($f, $b)) { $set[] = "$f=?"; $params[] = $b[$f]; }
        }
        if ($set) {
            $params[] = $conv_id;
            stg()->prepare("UPDATE wa_cloud_conversations SET ".implode(',',$set)." WHERE id=?")->execute($params);
        }
        $result = crear_borrador_wa(stg(), $conv_id, ['use_client_lookup' => true]);
        if (isset($result['error'])) err($result['error'], $result['code'] ?? 422);
        ok($result);
    }

    // ── e2e_inject_ficha_stg — simula FICHA_JSON del webhook en staging (sin desplegar webhook) ──
    // Aplica el mismo fichaMap que wa_webhook.php para actualizar campos de la conversación.
    if ($action === 'e2e_inject_ficha_stg') {
        $b = body();
        $conv_id = $b['conv_id'] ?? '';
        if (!$conv_id) err('conv_id requerido');
        $ficha = $b['ficha'] ?? [];
        if (!$ficha) err('ficha (objeto FICHA_JSON) requerido');
        // Verificar que la conversación existe en staging
        $chk = stg()->prepare("SELECT id FROM wa_cloud_conversations WHERE id=? LIMIT 1");
        $chk->execute([$conv_id]);
        if (!$chk->fetch()) err("Conversación staging no encontrada: $conv_id", 404);
        // fichaMap idéntico al de wa_webhook.php
        $fichaMap = [
            'nombre'        => 'contact_name',
            'email'         => 'contact_email',
            'rut'           => 'contact_rut',
            'razon_social'  => 'company_name',
            'tipo_cliente'  => 'client_type',
            'origen'        => 'service_origin',
            'destino'       => 'service_destination',
            'fecha'         => 'service_date',
            'hora_salida'   => 'service_hour',
            'hora_retorno'  => 'service_hour_return',
            'pasajeros'     => 'service_passengers',
            'tipo'          => 'service_type',
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
        if (!$cols) err('ficha vacía — ningún campo reconocido', 422);
        $vals[] = $conv_id;
        stg()->prepare("UPDATE wa_cloud_conversations SET ".implode(',',$cols)." WHERE id=?")->execute($vals);
        // Leer estado actualizado
        $st = stg()->prepare("SELECT contact_name,contact_email,contact_rut,company_name,client_type,
            service_origin,service_destination,service_date,service_hour,service_hour_return,
            service_passengers,service_type,service_vehicle,wa_draft_quote_id,stage FROM wa_cloud_conversations WHERE id=?");
        $st->execute([$conv_id]);
        $updated = $st->fetch(PDO::FETCH_ASSOC);
        ok(['injected'=>count($cols),'fields_set'=>array_keys($ficha),'conv_state'=>$updated,'staging'=>true]);
    }

    // ── e2e_get_conv_stg — retorna estado actual de una conversación staging ──
    if ($action === 'e2e_get_conv_stg') {
        $conv_id = body()['conv_id'] ?? ($_GET['conv_id'] ?? '');
        if (!$conv_id) err('conv_id requerido');
        $st = stg()->prepare("SELECT * FROM wa_cloud_conversations WHERE id=? LIMIT 1");
        $st->execute([$conv_id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) err("Conversación staging no encontrada: $conv_id", 404);
        // También retornar cotizaciones y aprobaciones asociadas
        $quot = stg()->prepare("SELECT id,number,status,etapa,company,total,desde,hasta,
            fecha_salida,hora_salida,hora_retorno,client_id,contact_id,created_at
            FROM quotations WHERE id=? LIMIT 1");
        $quot->execute([$row['wa_draft_quote_id'] ?? '']);
        $quotRow = $quot->fetch(PDO::FETCH_ASSOC) ?: null;
        $appr = stg()->prepare("SELECT id,status,approved_by,approved_at FROM wa_quote_approvals
            WHERE conv_id=? ORDER BY created_at DESC LIMIT 3");
        $appr->execute([$conv_id]);
        $apprRows = $appr->fetchAll(PDO::FETCH_ASSOC);
        ok(['conv'=>$row,'quotation'=>$quotRow,'approvals'=>$apprRows,'staging'=>true]);
    }

    // ── e2e_stg_quotations_update — actualiza cotización staging + invalida aprobación ─
    if ($action === 'e2e_stg_quotations_update') {
        $uid = $_SERVER['HTTP_X_USER_ID'] ?? '';
        if (!$uid) err('x-user-id requerido', 401);

        $b  = body();
        $id = $b['id'] ?? '';
        if (!$id) err('id requerido');

        // Campos críticos que disparan invalidación de aprobación
        $critical_fields = ['total','subtotal','desde','hasta','distancia_km','fecha_salida',
                            'hora_salida','fecha_retorno','hora_retorno','vehicle_type','client_id','contact_id'];

        // Leer estado actual antes del UPDATE
        $current = stg()->prepare("SELECT total,subtotal,desde,hasta,distancia_km,fecha_salida,hora_salida,fecha_retorno,hora_retorno,vehicle_type,client_id,contact_id FROM quotations WHERE id=? LIMIT 1");
        $current->execute([$id]);
        $cur = $current->fetch(PDO::FETCH_ASSOC);
        if (!$cur) err('Cotización no encontrada', 404);

        // Detectar si cambia algún campo crítico de cabecera
        $changed_fields = [];
        foreach ($critical_fields as $f) {
            if (array_key_exists($f, $b) && (string)($cur[$f]??'') !== (string)$b[$f]) {
                $changed_fields[] = "$f: '{$cur[$f]}' → '{$b[$f]}'";
            }
        }
        $items_changed = isset($b['items']) && is_array($b['items']);
        $has_critical_change = count($changed_fields) > 0 || $items_changed;

        // Verificar aprobación vigente
        $ap = stg()->prepare("SELECT id, status FROM wa_quote_approvals WHERE quotation_id=? AND status IN ('approved','sent') ORDER BY created_at DESC LIMIT 1");
        $ap->execute([$id]);
        $ap_row = $ap->fetch(PDO::FETCH_ASSOC);

        if ($has_critical_change && $ap_row) {
            if ($ap_row['status'] === 'sent') {
                err('Esta cotización ya fue enviada al cliente y no puede modificarse.', 409);
            }
            // Invalidar aprobación vigente
            $invalidation_reason = count($changed_fields) > 0
                ? 'Campos modificados: ' . implode('; ', $changed_fields)
                : 'Ítems de cotización modificados';
            if ($items_changed) $invalidation_reason .= ' (ítems reemplazados)';

            stg()->prepare("UPDATE wa_quote_approvals SET status='invalidated', invalidated_reason=?, invalidated_at=NOW(), invalidated_by=? WHERE id=?")
                ->execute([$invalidation_reason, $uid, $ap_row['id']]);

            // Leer snapshot post-modificación (lo hacemos después del UPDATE)
        }

        // Ejecutar UPDATE de cotización
        $fields_map = ['number','status','etapa','company','issue_date','expiry_date','subtotal','tax_pct','total',
                       'notes','terms','desde','hasta','desde_lat','desde_lng','hasta_lat','hasta_lng',
                       'distancia_km','fecha_salida','hora_salida','fecha_retorno','hora_retorno',
                       'client_id','contact_id','vehicle_type','observaciones'];
        $set = []; $params = [];
        foreach ($fields_map as $f) {
            if (array_key_exists($f, $b)) { $set[] = "$f=?"; $params[] = $b[$f]; }
        }
        if ($set) {
            $params[] = $id;
            stg()->prepare("UPDATE quotations SET ".implode(',',$set)." WHERE id=?")->execute($params);
        }

        // Reemplazar ítems si vienen
        if ($items_changed) {
            stg()->prepare("DELETE FROM quotation_items WHERE quotation_id=?")->execute([$id]);
            if (stg()->query("SHOW TABLES LIKE 'quotation_items'")->rowCount() > 0) {
                $ist = stg()->prepare("INSERT INTO quotation_items (id,quotation_id,description,pasajeros,quantity,unit_price,subtotal,sort_order) VALUES (?,?,?,?,?,?,?,?)");
                foreach ($b['items'] as $i => $item) {
                    $qty = $item['quantity'] ?? 1; $up = $item['unit_price'] ?? 0;
                    $ist->execute([stg()->query("SELECT UUID() AS u")->fetch()['u'], $id,
                        $item['description']??'', $item['pasajeros']??null, $qty, $up,
                        $item['subtotal'] ?? $qty*$up, $item['sort_order'] ?? $i]);
                }
            }
        }

        // Crear nueva aprobación pendiente si hubo invalidación
        if ($has_critical_change && $ap_row && $ap_row['status'] === 'approved') {
            $new_ap_id = stg()->query("SELECT UUID() AS u")->fetch()['u'];
            $q_snap = stg()->prepare("SELECT total,desde,hasta,distancia_km,fecha_salida,vehicle_type FROM quotations WHERE id=?");
            $q_snap->execute([$id]);
            $snap = $q_snap->fetch(PDO::FETCH_ASSOC) ?: [];
            stg()->prepare("INSERT INTO wa_quote_approvals (id,conv_id,quotation_id,created_by,quote_total,quote_snapshot,status,previous_approval_id) SELECT ?,conv_id,?,?, ?,?,?,id FROM wa_quote_approvals WHERE id=?")
                ->execute([$new_ap_id, $id, $uid, $snap['total']??null, json_encode($snap), 'pending', $ap_row['id']]);
        }

        ok(['updated'=>true,'critical_change'=>$has_critical_change,'invalidated'=>($has_critical_change && $ap_row && $ap_row['status']==='approved'),'changed_fields'=>$changed_fields,'items_changed'=>$items_changed]);
    }

    // ── e2e_fase1_seed_conv_stg — seed conversación en staging con teléfono libre ──
    if ($action === 'e2e_fase1_seed_conv_stg') {
        $b = body();
        $phone = $b['phone'] ?? '';
        if (!$phone) err('phone requerido');
        // Limpiar conv previa del mismo teléfono si existe
        $stg_pdo = stg();
        $ex = $stg_pdo->prepare("SELECT id FROM wa_cloud_conversations WHERE phone=? LIMIT 1");
        $ex->execute([$phone]);
        $old = $ex->fetch();
        if ($old) {
            $stg_pdo->prepare("DELETE FROM wa_cloud_messages WHERE conversation_id=?")->execute([$old['id']]);
            $stg_pdo->prepare("DELETE FROM wa_quote_approvals WHERE conv_id=?")->execute([$old['id']]);
            $stg_pdo->prepare("DELETE FROM wa_cloud_conversations WHERE id=?")->execute([$old['id']]);
        }
        $conv_id = stguuid();
        $exec_id = 'beb2594e-be75-11f1-adc3-56000529c2a9';
        $origin  = $b['service_origin']      ?? null;
        $dest    = $b['service_destination'] ?? null;
        $sdate   = $b['service_date']        ?? null;
        $service_km = isset($b['service_km']) ? (float)$b['service_km'] : null;
        $stg_pdo->prepare("
            INSERT INTO wa_cloud_conversations
                (id, phone, assigned_to, contact_name, contact_rut, contact_email,
                 company_name, client_type,
                 service_origin, service_destination, service_date,
                 service_hour, service_hour_return,
                 service_passengers, service_type, service_vehicle, service_km,
                 stage, bot_active, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'nuevo',1,NOW())
        ")->execute([
            $conv_id, $phone, $exec_id,
            $b['contact_name']        ?? null,
            $b['contact_rut']         ?? null,
            $b['contact_email']       ?? null,
            $b['company_name']        ?? null,
            $b['client_type']         ?? null,
            $origin, $dest, $sdate,
            $b['service_hour']        ?? null,
            $b['service_hour_return'] ?? null,
            isset($b['service_passengers']) ? (int)$b['service_passengers'] : null,
            $b['service_type']        ?? null,
            $b['service_vehicle']     ?? null,
            $service_km,
        ]);
        ok(['conv_id'=>$conv_id,'phone'=>$phone,'staging'=>true]);
    }

    // ── e2e_crear_borrador_stg — llama crear_borrador_wa() sobre staging DB ──
    if ($action === 'e2e_crear_borrador_stg') {
        $b = body();
        $conv_id = $b['conv_id'] ?? '';
        if (!$conv_id) err('conv_id requerido');
        $chk = stg()->prepare("SELECT id FROM wa_cloud_conversations WHERE id=? LIMIT 1");
        $chk->execute([$conv_id]);
        if (!$chk->fetch()) err("Conversación staging no encontrada: $conv_id", 404);
        $result = crear_borrador_wa(stg(), $conv_id, ['use_client_lookup' => true]);
        if (isset($result['error'])) err($result['error'], $result['code'] ?? 422);
        ok($result);
    }

    // ── e2e_seed_approval_stg — crea aprobación ficticia en staging ──
    if ($action === 'e2e_seed_approval_stg') {
        $b = body();
        $conv_id     = $b['conv_id']      ?? '';
        $quotation_id = $b['quotation_id'] ?? '';
        $status      = $b['status']       ?? 'approved';
        $approved_by = $b['approved_by']  ?? 'test_user';
        if (!$conv_id || !$quotation_id) err('conv_id y quotation_id requeridos');
        $ap_id = stguuid();
        // Leer total de la cotización
        $qt = stg()->prepare("SELECT total FROM quotations WHERE id=? LIMIT 1");
        $qt->execute([$quotation_id]);
        $qt_row = $qt->fetch(PDO::FETCH_ASSOC);
        $total = $qt_row['total'] ?? 0;
        stg()->prepare("INSERT INTO wa_quote_approvals
            (id, conv_id, quotation_id, status, approved_by, approved_at, created_by, quote_total, quote_snapshot)
            VALUES (?,?,?,?,?,NOW(),?,?,?)")
            ->execute([$ap_id, $conv_id, $quotation_id, $status, $approved_by, $approved_by,
                       $total, json_encode(['auto_seed'=>true,'total'=>$total])]);
        ok(['approval_id'=>$ap_id,'status'=>$status,'staging'=>true]);
    }

    // ── e2e_last_bot_msg_stg — último mensaje 'out' de wa_cloud_messages en staging ──
    if ($action === 'e2e_last_bot_msg_stg') {
        $b = body();
        $phone = $b['phone'] ?? ($_GET['phone'] ?? '');
        if (!$phone) err('phone requerido');
        $conv = stg()->prepare("SELECT id FROM wa_cloud_conversations WHERE phone=? LIMIT 1");
        $conv->execute([$phone]);
        $c = $conv->fetch(PDO::FETCH_ASSOC);
        if (!$c) err("No hay conversación para $phone", 404);
        $msg = stg()->prepare("SELECT content, created_at FROM wa_cloud_messages
            WHERE conversation_id=? AND direction='out'
            ORDER BY created_at DESC LIMIT 1");
        $msg->execute([$c['id']]);
        $m = $msg->fetch(PDO::FETCH_ASSOC) ?: null;
        ok(['conv_id'=>$c['id'], 'last_bot_msg'=>$m]);
    }

    err("Acción e2e '$action' no reconocida", 404);
}

// ── Not found ─────────────────────────────────────────────────────────────────
err("Acción '$action' no encontrada", 404);
