<?php
/**
 * wa-estado.php — Dashboard de estado Sofía / Pipeline WhatsApp
 * Acceso: sesión CRM válida (Bearer JWT) o header X-Admin-Secret desde servidor
 * No contiene datos de API externos; solo lectura de BD.
 */

if (!defined('DB_HOST')) {
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'transccl_crm');
    define('DB_USER', 'transccl_crm_user');
    define('DB_PASS', getenv('CRM_DB_PASSWORD') ?: 'Claudio@1978');
}

// ── Auth — sin secretos en URL (evitar filtración en logs) ───────────────────
$auth_ok = false;
// 1) Header X-Admin-Secret (vía proxy/servidor, no llega en URL)
$admin_secret = $_SERVER['HTTP_X_ADMIN_SECRET'] ?? '';
if ($admin_secret !== '' && defined('WA_ESTADO_SECRET') && hash_equals(WA_ESTADO_SECRET, $admin_secret)) {
    $auth_ok = true;
}
// 2) JWT de sesión CRM
if (!$auth_ok) {
    $token = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($token, 'Bearer ') && defined('CRM_JWT_SECRET')) {
        try {
            [$h, $p, $sig] = explode('.', substr($token, 7));
            $check = rtrim(strtr(base64_encode(hash_hmac('sha256', "$h.$p", CRM_JWT_SECRET, true)), '+/', '-_'), '=');
            if (hash_equals($check, $sig)) $auth_ok = true;
        } catch (Throwable $e) {}
    }
}
// 3) Sesión PHP del CRM (usuario logueado)
if (!$auth_ok) {
    @session_start();
    if (!empty($_SESSION['crm_user_id'])) $auth_ok = true;
}
if (!$auth_ok) {
    http_response_code(401);
    header('Content-Type: text/plain');
    die('Acceso no autorizado.');
}
// $secret se conserva como string vacío para no romper referencias posteriores
$secret = '';

// ── Datos ────────────────────────────────────────────────────────────────────
try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );

    $excluir = ['56974270657','56999000001','56999999999','56999990001'];
    $ph = implode(',', array_fill(0, count($excluir), '?'));

    // Resumen por ejecutiva
    $stmtR = $pdo->prepare("
        SELECT COALESCE(p.name,'Sin asignar') AS ejecutiva,
               COUNT(*) AS total,
               SUM(c.stage='nuevo') AS nuevo,
               SUM(c.stage='formulario_enviado') AS form_enviado,
               SUM(c.stage='formulario_completo') AS form_completo,
               SUM(c.stage='cotizando') AS cotizando,
               SUM(c.bot_active=1 AND c.stage NOT IN ('cerrado','ganado','perdido')) AS con_sofia,
               SUM(c.form_link_sent_at IS NOT NULL AND c.form_submitted_at IS NULL) AS esperando_form,
               SUM(c.form_submitted_at IS NOT NULL AND c.stage NOT IN ('cerrado','ganado','perdido')) AS forms_sin_cotizar,
               SUM(c.handoff_requested_at IS NOT NULL AND c.bot_active=0) AS en_handoff
        FROM wa_cloud_conversations c
        LEFT JOIN profiles p ON p.id = c.assigned_to
        WHERE c.phone NOT IN ($ph)
          AND c.stage NOT IN ('cerrado','ganado','perdido')
        GROUP BY c.assigned_to, p.name
        ORDER BY p.name IS NULL, p.name
    ");
    $stmtR->execute($excluir);
    $resumen = $stmtR->fetchAll();

    // Totales globales
    $totales = array_reduce($resumen, function($c, $r) {
        $c['total']           += $r['total'];
        $c['con_sofia']       += $r['con_sofia'];
        $c['esperando_form']  += $r['esperando_form'];
        $c['forms_sin_cotizar'] += $r['forms_sin_cotizar'];
        $c['en_handoff']      += $r['en_handoff'];
        return $c;
    }, ['total'=>0,'con_sofia'=>0,'esperando_form'=>0,'forms_sin_cotizar'=>0,'en_handoff'=>0]);

    // Detalle — conversaciones que necesitan atención
    $stmtD = $pdo->prepare("
        SELECT COALESCE(p.name,'Sin asignar') AS ejecutiva,
               c.contact_name,
               c.stage,
               c.bot_active,
               IF(c.form_submitted_at IS NOT NULL,1,0) AS form_recibido,
               IF(c.handoff_requested_at IS NOT NULL,1,0) AS en_handoff,
               TIMESTAMPDIFF(MINUTE, COALESCE(c.last_customer_msg_at, c.last_msg_at), NOW()) AS minutos_sin_msg,
               TIMESTAMPDIFF(MINUTE, c.form_submitted_at, NOW()) AS minutos_desde_form,
               c.followup_count,
               c.unread_count
        FROM wa_cloud_conversations c
        LEFT JOIN profiles p ON p.id = c.assigned_to
        WHERE c.stage NOT IN ('cerrado','ganado','perdido')
          AND c.phone NOT IN ($ph)
        ORDER BY minutos_sin_msg DESC
        LIMIT 60
    ");
    $stmtD->execute($excluir);
    $detalle = $stmtD->fetchAll();

    $data_ok  = true;
    $data_err = null;
} catch (Throwable $e) {
    $data_ok  = false;
    $data_err = $e->getMessage();
    $resumen = $detalle = $totales = [];
}

$ts = date('d/m/Y H:i');
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Estado Sofía</title>
<style>
:root {
  --bg:#0f172a; --surface:#1e293b; --surface2:#263348;
  --border:#334155; --fg:#e2e8f0; --fg-muted:#94a3b8;
  --accent:#3b82f6; --accent-bg:#1e3a5f;
  --ok:#22c55e; --ok-bg:#14311f;
  --warn:#f59e0b; --warn-bg:#3b2500;
  --danger:#ef4444; --danger-bg:#3b1515;
  --tag-nuevo:#60a5fa; --tag-form:#a78bfa; --tag-handoff:#fb923c;
  --radius:8px; color-scheme:dark;
}
*{box-sizing:border-box; margin:0; padding:0;}
body{background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.5;
  padding:20px max(16px,env(safe-area-inset-left,0px));
  padding-right:max(16px,env(safe-area-inset-right,0px));
  padding-bottom:env(safe-area-inset-bottom,0px);}
h1{font-size:18px;font-weight:700;margin-bottom:4px;}
.meta{font-size:12px;color:var(--fg-muted);margin-bottom:20px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;}
.refresh-btn{background:var(--accent-bg);color:var(--accent);border:1px solid var(--accent);border-radius:5px;
  padding:3px 10px;font-size:11px;cursor:pointer;text-decoration:none;}
/* KPIs */
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:20px;}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;}
.kpi-value{font-size:28px;font-weight:700;line-height:1;}
.kpi-label{font-size:11px;color:var(--fg-muted);margin-top:4px;font-weight:500;text-transform:uppercase;letter-spacing:.04em;}
.kpi-ok .kpi-value{color:var(--ok);}
.kpi-warn .kpi-value{color:var(--warn);}
.kpi-danger .kpi-value{color:var(--danger);}
.kpi-accent .kpi-value{color:var(--accent);}
/* Error */
.error-box{background:var(--danger-bg);border:1px solid var(--danger);border-radius:var(--radius);padding:12px 16px;margin-bottom:16px;font-size:13px;}
/* Section */
.section-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--fg-muted);margin-bottom:10px;
  display:flex;align-items:center;gap:8px;}
.section-title::after{content:'';flex:1;height:1px;background:var(--border);}
/* Resumen table */
.table-wrap{overflow-x:auto;margin-bottom:24px;}
table{width:100%;border-collapse:collapse;font-size:13px;}
th{background:var(--surface2);padding:9px 12px;text-align:right;font-weight:600;font-size:11px;text-transform:uppercase;
  letter-spacing:.04em;color:var(--fg-muted);white-space:nowrap;}
th:first-child{text-align:left;}
td{padding:9px 12px;text-align:right;border-top:1px solid var(--border);}
td:first-child{text-align:left;font-weight:500;}
tr:hover td{background:var(--surface2);}
.num-warn{color:var(--warn);font-weight:700;}
.num-danger{color:var(--danger);font-weight:700;}
.num-ok{color:var(--ok);}
/* Detalle cards */
.conv-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-bottom:24px;}
.conv-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;}
.conv-card.urgent{border-color:var(--danger);}
.conv-card.warn{border-color:var(--warn);}
.conv-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;}
.conv-name{font-weight:600;font-size:13px;}
.conv-exec{font-size:11px;color:var(--fg-muted);}
.conv-time{font-size:11px;white-space:nowrap;}
.conv-time.ok{color:var(--ok);}
.conv-time.warn{color:var(--warn);}
.conv-time.danger{color:var(--danger);}
.tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px;}
.tag{font-size:10px;font-weight:600;padding:1px 7px;border-radius:12px;border:1px solid;}
.tag-stage-nuevo{background:#1a2d4f;color:var(--tag-nuevo);border-color:var(--tag-nuevo);}
.tag-stage-formulario_enviado{background:#2a1f4f;color:var(--tag-form);border-color:var(--tag-form);}
.tag-stage-formulario_completo{background:#3b1f1f;color:var(--danger);border-color:var(--danger);}
.tag-stage-cotizando{background:#2d2f10;color:#facc15;border-color:#facc15;}
.tag-handoff{background:#3b2000;color:var(--tag-handoff);border-color:var(--tag-handoff);}
.tag-unread{background:#1f2a3b;color:var(--accent);border-color:var(--accent);}
.empty{color:var(--fg-muted);font-size:13px;text-align:center;padding:24px;}
</style>
</head>
<body>
<h1>Estado Sofía · Pipeline WhatsApp</h1>
<div class="meta">
  <span>Actualizado: <?= $ts ?></span>
  <a class="refresh-btn" href="?">↻ Actualizar</a>
  <span style="margin-left:auto;color:var(--fg-muted)">Solo conversaciones activas</span>
</div>

<?php if (!$data_ok): ?>
<div class="error-box">⚠ Error al obtener datos: <?= htmlspecialchars($data_err ?? '') ?></div>
<?php else: ?>

<!-- KPIs -->
<div class="kpis">
  <div class="kpi <?= $totales['total'] > 0 ? 'kpi-accent' : '' ?>">
    <div class="kpi-value"><?= $totales['total'] ?></div>
    <div class="kpi-label">Activas</div>
  </div>
  <div class="kpi <?= $totales['con_sofia'] > 0 ? 'kpi-ok' : '' ?>">
    <div class="kpi-value"><?= $totales['con_sofia'] ?></div>
    <div class="kpi-label">Con Sofía</div>
  </div>
  <div class="kpi <?= $totales['esperando_form'] > 0 ? 'kpi-warn' : '' ?>">
    <div class="kpi-value"><?= $totales['esperando_form'] ?></div>
    <div class="kpi-label">Esperando formulario</div>
  </div>
  <div class="kpi <?= $totales['forms_sin_cotizar'] > 0 ? 'kpi-danger' : 'kpi-ok' ?>">
    <div class="kpi-value"><?= $totales['forms_sin_cotizar'] ?></div>
    <div class="kpi-label">Formularios sin cotizar</div>
  </div>
  <div class="kpi <?= $totales['en_handoff'] > 0 ? 'kpi-warn' : '' ?>">
    <div class="kpi-value"><?= $totales['en_handoff'] ?></div>
    <div class="kpi-label">Con ejecutiva</div>
  </div>
</div>

<!-- Resumen por ejecutiva -->
<div class="section-title">Por ejecutiva</div>
<?php if (empty($resumen)): ?>
<div class="empty">Sin conversaciones activas</div>
<?php else: ?>
<div class="table-wrap">
<table>
  <thead>
    <tr>
      <th>Ejecutiva</th>
      <th>Total</th>
      <th>Con Sofía</th>
      <th>Form enviado</th>
      <th>Form recibido</th>
      <th>Sin cotizar ⚠</th>
      <th>Handoff</th>
    </tr>
  </thead>
  <tbody>
  <?php foreach ($resumen as $r): ?>
    <tr>
      <td><?= htmlspecialchars($r['ejecutiva']) ?></td>
      <td><?= $r['total'] ?></td>
      <td class="num-ok"><?= $r['con_sofia'] ?></td>
      <td><?= $r['form_enviado'] ?></td>
      <td><?= $r['form_completo'] ?></td>
      <td class="<?= $r['forms_sin_cotizar'] > 0 ? 'num-danger' : '' ?>"><?= $r['forms_sin_cotizar'] ?></td>
      <td class="<?= $r['en_handoff'] > 0 ? 'num-warn' : '' ?>"><?= $r['en_handoff'] ?></td>
    </tr>
  <?php endforeach ?>
  </tbody>
</table>
</div>
<?php endif ?>

<!-- Detalle -->
<div class="section-title">Conversaciones activas (ordenadas por tiempo sin respuesta)</div>
<?php if (empty($detalle)): ?>
<div class="empty">Sin conversaciones activas 🎉</div>
<?php else: ?>
<div class="conv-list">
<?php foreach ($detalle as $d):
  $mins = (int)$d['minutos_sin_msg'];
  $mins_form = (int)($d['minutos_desde_form'] ?? 0);
  $urgency = '';
  if ($d['form_recibido'] && $mins_form > 120) $urgency = 'urgent';
  elseif ($d['form_recibido'] && $mins_form > 30) $urgency = 'warn';
  elseif ($mins > 240) $urgency = 'warn';

  $time_cls = $mins > 120 ? 'danger' : ($mins > 30 ? 'warn' : 'ok');
  $time_txt = $mins < 60 ? "{$mins}m" : (floor($mins/60) . 'h ' . ($mins%60) . 'm');
?>
<div class="conv-card <?= $urgency ?>">
  <div class="conv-top">
    <div>
      <div class="conv-name"><?= htmlspecialchars($d['contact_name'] ?: 'Sin nombre') ?></div>
      <div class="conv-exec"><?= htmlspecialchars($d['ejecutiva']) ?></div>
    </div>
    <div class="conv-time <?= $time_cls ?>"><?= $time_txt ?></div>
  </div>
  <div class="tags">
    <span class="tag tag-stage-<?= $d['stage'] ?>"><?= htmlspecialchars(str_replace('_',' ',$d['stage'])) ?></span>
    <?php if ($d['en_handoff']): ?><span class="tag tag-handoff">👤 ejecutiva</span><?php endif ?>
    <?php if ($d['unread_count'] > 0): ?><span class="tag tag-unread"><?= $d['unread_count'] ?> nuevo<?= $d['unread_count']>1?'s':'' ?></span><?php endif ?>
    <?php if ($d['form_recibido'] && $mins_form > 0): ?>
    <span class="tag <?= $mins_form>120?'tag-stage-formulario_completo':'tag-stage-cotizando' ?>" style="<?= $mins_form>120?'':'border-color:#facc15;color:#facc15' ?>">
      form hace <?= $mins_form < 60 ? "{$mins_form}m" : (floor($mins_form/60).'h') ?>
    </span>
    <?php endif ?>
  </div>
</div>
<?php endforeach ?>
</div>
<?php endif ?>

<?php endif ?>

<script>
// Auto-refresh cada 2 minutos
setTimeout(() => window.location.reload(), 120000);
</script>
</body>
</html>
