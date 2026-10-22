<?php
/**
 * CRM Transccl - API Backend
 * Subir a: https://transccl.cl/crm-api.php (public_html)
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

// ── Config ────────────────────────────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'transccl_crm');
define('DB_USER', 'transccl_crm_user');
define('DB_PASS', 'Claudio@1978');
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
        // Crear perfil con rol vendedor por defecto
        $id = uuid();
        db()->prepare('INSERT INTO profiles (id, email, name, role, password_hash, active) VALUES (?, ?, ?, ?, ?, 1)')
             ->execute([$id, $email, $name ?: $email, 'vendedor', password_hash(bin2hex(random_bytes(16)), PASSWORD_BCRYPT)]);
        $stmt = db()->prepare('SELECT * FROM profiles WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $user = $stmt->fetch();
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

    $stmt = db()->prepare("
        SELECT p.*,
               pr.name AS assigned_name,
               (SELECT COUNT(*) FROM prospect_activities WHERE prospect_id = p.id) AS activity_count,
               (SELECT MAX(created_at) FROM prospect_activities WHERE prospect_id = p.id) AS last_activity_at
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
    $cid = uuid();
    db()->prepare("INSERT INTO prospect_contacts (id, prospect_id, name, role, phone, mobile, email, anexo, call_instructions, is_primary) VALUES (?,?,?,?,?,?,?,?,?,?)")
        ->execute([$cid, $prospect_id, $b['name'], $b['role'] ?? null, $b['phone'] ?? null, $b['mobile'] ?? null, $b['email'] ?? null, $b['anexo'] ?? null, $b['call_instructions'] ?? null, 0]);
    $stmt = db()->prepare("SELECT * FROM prospect_contacts WHERE id = ?");
    $stmt->execute([$cid]);
    ok($stmt->fetch());
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
if ($action === 'call_recording_update') {
    $b = body();
    $call_sid       = $b['call_sid'] ?? null;
    $recording_url  = $b['recording_url'] ?? null;
    $duration       = isset($b['recording_duration']) ? (int)$b['recording_duration'] : null;
    if (!$call_sid || !$recording_url) ok(['skipped' => true]);
    db()->prepare("UPDATE prospect_activities SET recording_url = ?, duration_sec = COALESCE(duration_sec, ?) WHERE call_sid = ?")
        ->execute([$recording_url, $duration, $call_sid]);
    ok(['updated' => true]);
}

if ($action === 'call_status_update') {
    $b = body();
    $call_sid = $b['call_sid'] ?? null;
    $duration = isset($b['duration']) ? (int)$b['duration'] : null;
    if (!$call_sid) ok(['skipped' => true]);
    if ($duration !== null) {
        db()->prepare("UPDATE prospect_activities SET duration_sec = ? WHERE call_sid = ?")
            ->execute([$duration, $call_sid]);
        // También actualizar outbound_calls (solo si aún no tiene duración)
        db()->prepare("UPDATE outbound_calls SET duration_sec = COALESCE(duration_sec, ?) WHERE call_sid = ?")
            ->execute([$duration, $call_sid]);
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

    $baseJoin = "
        FROM outbound_calls o
        JOIN profiles pf ON pf.id = o.user_id
        LEFT JOIN prospect_contacts c ON (
            RIGHT(REGEXP_REPLACE(c.mobile, '[^0-9]', ''), 9) = RIGHT(REGEXP_REPLACE(o.to_number, '[^0-9]', ''), 9)
            OR RIGHT(REGEXP_REPLACE(c.phone,  '[^0-9]', ''), 9) = RIGHT(REGEXP_REPLACE(o.to_number, '[^0-9]', ''), 9)
        )
        LEFT JOIN prospects pr ON pr.id = c.prospect_id
    ";

    // 1. Summary
    $stmt = db()->prepare("
        SELECT COUNT(*) as total,
               SUM(CASE WHEN COALESCE(o.duration_sec,0) > 0 THEN 1 ELSE 0 END) as answered,
               COALESCE(SUM(o.duration_sec), 0) as total_seconds
        $baseJoin WHERE $whereStr
    ");
    $stmt->execute($params);
    $sumRow = $stmt->fetch();

    // 2. Daily breakdown
    $stmt = db()->prepare("
        SELECT DATE(DATE_SUB(o.called_at, INTERVAL 3 HOUR)) as date,
               COUNT(*) as total,
               SUM(CASE WHEN COALESCE(o.duration_sec,0) > 0 THEN 1 ELSE 0 END) as answered,
               COALESCE(SUM(o.duration_sec), 0) as total_seconds
        $baseJoin WHERE $whereStr
        GROUP BY DATE(DATE_SUB(o.called_at, INTERVAL 3 HOUR))
        ORDER BY date DESC
    ");
    $stmt->execute($params);
    $daily = $stmt->fetchAll();

    // 3. Executive stats
    $stmt = db()->prepare("
        SELECT o.user_id, pf.name as executive_name,
               COUNT(*) as total,
               SUM(CASE WHEN COALESCE(o.duration_sec,0) > 0 THEN 1 ELSE 0 END) as answered,
               COALESCE(SUM(o.duration_sec), 0) as total_seconds,
               COUNT(DISTINCT DATE(DATE_SUB(o.called_at, INTERVAL 3 HOUR))) as days_active
        $baseJoin WHERE $whereStr
        GROUP BY o.user_id, pf.name
        ORDER BY total DESC
    ");
    $stmt->execute($params);
    $execStats = $stmt->fetchAll();

    // 4. Commune stats
    $stmt = db()->prepare("
        SELECT COALESCE(pr.commune, 'Sin asignar') as commune,
               COUNT(*) as total,
               SUM(CASE WHEN COALESCE(o.duration_sec,0) > 0 THEN 1 ELSE 0 END) as answered,
               COUNT(DISTINCT pr.id) as prospects_called
        $baseJoin WHERE $whereStr
        GROUP BY pr.commune
        ORDER BY total DESC
    ");
    $stmt->execute($params);
    $communeStats = $stmt->fetchAll();

    // Total prospects per commune for coverage %
    $stmtTotals = db()->prepare("
        SELECT commune, COUNT(*) as total_prospects
        FROM prospects WHERE campaign_id = ? GROUP BY commune
    ");
    $stmtTotals->execute([$campaign_id]);
    $communeTotals = [];
    foreach ($stmtTotals->fetchAll() as $r) {
        $communeTotals[$r['commune']] = (int)$r['total_prospects'];
    }

    // 5. Top prospects by engagement
    $stmt = db()->prepare("
        SELECT pr.id as prospect_id, pr.name as prospect_name, pr.commune, pr.status,
               COUNT(*) as total_calls,
               SUM(CASE WHEN COALESCE(o.duration_sec,0) > 0 THEN 1 ELSE 0 END) as answered,
               CAST(AVG(NULLIF(o.duration_sec, 0)) AS UNSIGNED) as avg_duration,
               MAX(CASE WHEN o.recording_url IS NOT NULL AND COALESCE(o.duration_sec,0) > 0
                        THEN o.recording_url ELSE NULL END) as best_recording
        $baseJoin
        WHERE $whereStr AND pr.id IS NOT NULL
        GROUP BY pr.id, pr.name, pr.commune, pr.status
        HAVING SUM(CASE WHEN COALESCE(o.duration_sec,0) > 0 THEN 1 ELSE 0 END) > 0
        ORDER BY answered DESC, avg_duration DESC
        LIMIT 15
    ");
    $stmt->execute($params);
    $topProspects = $stmt->fetchAll();

    // Cast + derive rates
    foreach ($daily as &$r) {
        $r['total']         = (int)$r['total'];
        $r['answered']      = (int)$r['answered'];
        $r['total_seconds'] = (int)$r['total_seconds'];
        $r['pct_answered']  = $r['total'] > 0 ? round($r['answered'] / $r['total'] * 100) : 0;
    }
    foreach ($execStats as &$r) {
        $r['total']         = (int)$r['total'];
        $r['answered']      = (int)$r['answered'];
        $r['total_seconds'] = (int)$r['total_seconds'];
        $r['days_active']   = (int)$r['days_active'];
        $r['pct_answered']  = $r['total'] > 0 ? round($r['answered'] / $r['total'] * 100) : 0;
        $r['daily_avg']     = $r['days_active'] > 0 ? round($r['total'] / $r['days_active'], 1) : 0;
    }
    foreach ($communeStats as &$r) {
        $r['total']           = (int)$r['total'];
        $r['answered']        = (int)$r['answered'];
        $r['prospects_called'] = (int)$r['prospects_called'];
        $r['total_prospects'] = $communeTotals[$r['commune']] ?? 0;
        $r['pct_answered']    = $r['total'] > 0 ? round($r['answered'] / $r['total'] * 100) : 0;
        $r['coverage_pct']    = $r['total_prospects'] > 0 ? round($r['prospects_called'] / $r['total_prospects'] * 100) : 0;
    }
    foreach ($topProspects as &$r) {
        $r['total_calls'] = (int)$r['total_calls'];
        $r['answered']    = (int)$r['answered'];
        $r['avg_duration'] = $r['avg_duration'] ? (int)$r['avg_duration'] : null;
    }

    ok([
        'summary' => [
            'total'         => (int)$sumRow['total'],
            'answered'      => (int)$sumRow['answered'],
            'pct_answered'  => $sumRow['total'] > 0 ? round($sumRow['answered'] / $sumRow['total'] * 100) : 0,
            'total_seconds' => (int)$sumRow['total_seconds'],
        ],
        'daily'           => $daily,
        'executive_stats' => array_values($execStats),
        'commune_stats'   => array_values($communeStats),
        'top_prospects'   => array_values($topProspects),
    ]);
}

if ($action === 'log_outbound_call') {
    $secret = $_SERVER['HTTP_X_INTERNAL_SECRET'] ?? '';
    $jwtSecret = getenv('CRM_JWT_SECRET') ?: JWT_SECRET;
    if (!hash_equals($jwtSecret, $secret)) { http_response_code(403); echo '{}'; exit; }
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

if ($action === 'log_inbound_call') {
    // Llamado desde incoming_call_route al recibir llamada entrante
    $secret = $_SERVER['HTTP_X_INTERNAL_SECRET'] ?? '';
    $jwtSecret = getenv('CRM_JWT_SECRET') ?: JWT_SECRET;
    if (!hash_equals($jwtSecret, $secret)) { http_response_code(403); echo '{}'; exit; }
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
    $pdfSecret = getenv('INTERNAL_PDF_SECRET') ?: '';
    // Acepta secreto interno (INTERNAL_PDF_SECRET) o sesión autenticada
    $isInternal = $secret !== '' && $pdfSecret !== '' && hash_equals($pdfSecret, $secret);
    $b = body();
    if (!$isInternal) { $me = requireAuth(); }
    $callSid       = $b['call_sid']        ?? null;
    $parentCallSid = $b['parent_call_sid'] ?? null;
    $recordingUrl  = $b['recording_url']   ?? null;
    $duration      = isset($b['recording_duration']) ? (int)$b['recording_duration'] : null;
    if (!$callSid && !$parentCallSid) { ok(['skipped' => true]); }
    // Actualizar por call_sid o parent_call_sid en outbound_calls
    foreach (array_filter([$callSid, $parentCallSid]) as $sid) {
        db()->prepare("UPDATE outbound_calls SET recording_url = COALESCE(recording_url, ?), duration_sec = COALESCE(duration_sec, ?) WHERE call_sid = ?")
            ->execute([$recordingUrl, $duration, $sid]);
        db()->prepare("UPDATE prospect_activities SET recording_url = COALESCE(recording_url, ?), duration_sec = COALESCE(duration_sec, ?) WHERE call_sid = ?")
            ->execute([$recordingUrl, $duration, $sid]);
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
    requireAdmin();
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

    // Communes with assigned executive and pending prospect count
    $stmt = db()->prepare("
        SELECT
            ca.commune,
            ca.user_id,
            p.name  AS user_name,
            COUNT(pr.id) AS pending_count
        FROM commune_assignments ca
        LEFT JOIN profiles  p  ON p.id  = ca.user_id
        LEFT JOIN prospects pr ON pr.commune = ca.commune
                               AND pr.campaign_id = ca.campaign_id
                               AND pr.status NOT IN ('closed_won','closed_lost')
        WHERE ca.campaign_id = ?
        GROUP BY ca.commune, ca.user_id, p.name
        ORDER BY p.name, COUNT(pr.id) DESC
    ");
    $stmt->execute([$campaign_id]);
    $rows = $stmt->fetchAll();

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

// ── Not found ─────────────────────────────────────────────────────────────────
err("Acción '$action' no encontrada", 404);
