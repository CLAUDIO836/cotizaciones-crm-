<?php
/**
 * crm-api-ai.php — Acciones del Agente Comercial IA
 *
 * Subir al servidor y agregar en crm-api.php, antes de la última línea err(...):
 *   include_once __DIR__ . '/crm-api-ai.php';
 *
 * Usa las mismas funciones de crm-api.php: db(), uuid(), ok(), err(), body(), requireAuth()
 */

// ── Helpers locales ───────────────────────────────────────────────────────────

function ai_is_admin(array $user): bool {
    return in_array($user['role'], ['superadmin', 'admin', 'coordinador'], true);
}

/**
 * Construye cláusula WHERE y params para filtrar por usuario si no es admin.
 * Retorna [string $extra_and_clause, array $params]
 */
function ai_user_filter(array $user, string $alias = 'c'): array {
    if (ai_is_admin($user)) {
        return ['', []];
    }
    return [" AND {$alias}.assigned_user_id = ?", [$user['id']]];
}

// ── ai_landing_stats ──────────────────────────────────────────────────────────

if ($action === 'ai_landing_stats') {
    $user = requireAuth();
    [$uf, $up] = ai_user_filter($user);

    // Conversaciones activas
    $stmt = db()->prepare(
        "SELECT COUNT(*) AS total_active,
                SUM(c.mode = 'ai')    AS ai_mode,
                SUM(c.mode = 'human') AS human_mode
         FROM ai_conversations c
         WHERE c.status = 'active' $uf"
    );
    $stmt->execute($up);
    $conv = $stmt->fetch();

    // Borradores pendientes
    $stmt = db()->prepare(
        "SELECT COUNT(*) FROM ai_messages m
         JOIN ai_conversations c ON c.id = m.conversation_id
         WHERE m.status = 'pending' AND m.sender = 'ai' AND m.message_type = 'draft'
           AND c.status != 'archived' $uf"
    );
    $stmt->execute($up);
    $drafts_pending = (int)$stmt->fetchColumn();

    // Seguimientos vencidos
    $stmt = db()->prepare(
        "SELECT COUNT(*) FROM ai_tasks t
         JOIN ai_conversations c ON c.id = t.conversation_id
         WHERE t.type = 'follow_up' AND t.done = 0 AND t.due_date < NOW()
           AND c.status != 'archived' $uf"
    );
    $stmt->execute($up);
    $overdue = (int)$stmt->fetchColumn();

    // Listos para cotizar
    $stmt = db()->prepare(
        "SELECT COUNT(*) FROM ai_conversations c
         WHERE c.status != 'archived'
           AND EXISTS (
             SELECT 1 FROM ai_tasks t
             WHERE t.conversation_id = c.id AND t.type = 'quote_ready' AND t.done = 0
           ) $uf"
    );
    $stmt->execute($up);
    $ready = (int)$stmt->fetchColumn();

    ok([
        'total_active'       => (int)($conv['total_active'] ?? 0),
        'ai_mode'            => (int)($conv['ai_mode']      ?? 0),
        'human_mode'         => (int)($conv['human_mode']   ?? 0),
        'drafts_pending'     => $drafts_pending,
        'follow_ups_overdue' => $overdue,
        'ready_to_quote'     => $ready,
        'attention'          => $drafts_pending + $overdue,
    ]);
}

// ── ai_conversations_list ─────────────────────────────────────────────────────

if ($action === 'ai_conversations_list') {
    $user = requireAuth();
    [$uf, $up] = ai_user_filter($user);

    // Filtros opcionales
    $status_filter = '';
    if (!empty($_GET['status'])) {
        $up[] = $_GET['status'];
        $status_filter = ' AND c.status = ?';
    } else {
        $status_filter = " AND c.status != 'archived'";
    }

    $mode_filter = '';
    if (!empty($_GET['mode'])) {
        $up[] = $_GET['mode'];
        $mode_filter = ' AND c.mode = ?';
    }

    $stmt = db()->prepare("
        SELECT
            c.id, c.company_id, c.lead_id, c.client_id,
            c.status, c.mode, c.priority, c.channel, c.subject,
            c.assigned_user_id, c.last_activity_at, c.created_at,
            p.name  AS assigned_name,
            co.name AS company,
            l.empresa_nombre, l.contacto_nombre,
            cl.name AS client_name,
            (
                SELECT content FROM ai_messages
                WHERE conversation_id = c.id
                ORDER BY created_at DESC LIMIT 1
            ) AS latest_message,
            (
                SELECT COUNT(*) > 0 FROM ai_messages
                WHERE conversation_id = c.id
                  AND status = 'pending' AND sender = 'ai' AND message_type = 'draft'
            ) AS has_pending_draft,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM ai_tasks t
                    WHERE t.conversation_id = c.id
                      AND t.type = 'follow_up' AND t.done = 0 AND t.due_date < NOW()
                ) THEN 'vencido'
                WHEN EXISTS (
                    SELECT 1 FROM ai_tasks t
                    WHERE t.conversation_id = c.id AND t.type = 'quote_ready' AND t.done = 0
                ) THEN 'cotizar'
                WHEN EXISTS (
                    SELECT 1 FROM ai_tasks t
                    WHERE t.conversation_id = c.id AND t.type = 'follow_up' AND t.done = 0
                ) THEN 'seguimiento'
                WHEN c.lead_id IS NOT NULL THEN 'lead'
                ELSE NULL
            END AS tab_type
        FROM ai_conversations c
        LEFT JOIN profiles    p  ON p.id  = c.assigned_user_id
        LEFT JOIN companies   co ON co.id = c.company_id
        LEFT JOIN lead_requests l ON l.id = c.lead_id
        LEFT JOIN clients     cl ON cl.id = c.client_id
        WHERE 1=1 $status_filter $mode_filter $uf
        ORDER BY
            has_pending_draft DESC,
            FIELD(c.priority, 'high', 'medium', 'low'),
            c.last_activity_at DESC
        LIMIT 200
    ");
    $stmt->execute($up);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['has_pending_draft'] = (bool)$row['has_pending_draft'];
    }
    unset($row);

    ok($rows);
}

// ── ai_conversations_create ───────────────────────────────────────────────────

if ($action === 'ai_conversations_create') {
    $user = requireAuth();
    $b = body();

    $lead_id    = $b['lead_id']     ?? null;
    $client_id  = $b['client_id']   ?? null;
    $company_id = $b['company_id']  ?? null;
    $priority   = $b['priority']    ?? 'medium';
    $channel    = $b['channel']     ?? 'email';
    $subject    = $b['subject']     ?? null;
    $assigned   = $b['assigned_user_id'] ?? $user['id'];

    if (!in_array($priority, ['high','medium','low'], true)) $priority = 'medium';

    $id = uuid();
    db()->prepare("
        INSERT INTO ai_conversations
            (id, company_id, lead_id, client_id, priority, channel, subject, assigned_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ")->execute([$id, $company_id, $lead_id, $client_id, $priority, $channel, $subject, $assigned]);

    db()->prepare("
        INSERT INTO ai_audit_log (id, conversation_id, user_id, action, details)
        VALUES (?, ?, ?, 'conversation_created', ?)
    ")->execute([uuid(), $id, $user['id'],
        json_encode(['lead_id' => $lead_id, 'client_id' => $client_id])]);

    ok(['id' => $id]);
}

// ── ai_conversations_get ──────────────────────────────────────────────────────

if ($action === 'ai_conversations_get') {
    $user = requireAuth();
    $id = $_GET['id'] ?? '';
    if (!$id) err('Missing id', 400);

    $stmt = db()->prepare("
        SELECT c.*,
               p.name  AS assigned_name,
               co.name AS company,
               l.empresa_nombre,  l.empresa_rut,
               l.contacto_nombre, l.contacto_cargo,
               l.contacto_email,  l.contacto_telefono,
               l.tipo_servicio,   l.desde,   l.hasta,
               l.pasajeros_aprox, l.fecha_inicio,
               l.observaciones,   l.frecuencia,
               l.dias_semana,     l.vehiculo_preferido,
               l.establecimiento_nombre, l.motivo_viaje,
               l.requiere_factura, l.target_company,
               cl.name AS client_name,
               cl.email AS client_email, cl.phone AS client_phone
        FROM ai_conversations c
        LEFT JOIN profiles      p  ON p.id  = c.assigned_user_id
        LEFT JOIN companies     co ON co.id = c.company_id
        LEFT JOIN lead_requests l  ON l.id  = c.lead_id
        LEFT JOIN clients       cl ON cl.id = c.client_id
        WHERE c.id = ?
    ");
    $stmt->execute([$id]);
    $conv = $stmt->fetch();
    if (!$conv) err('Conversation not found', 404);

    // Deserialise JSON column
    if (isset($conv['dias_semana']) && $conv['dias_semana']) {
        $conv['dias_semana'] = json_decode($conv['dias_semana'], true);
    }
    $conv['requiere_factura'] = (bool)($conv['requiere_factura'] ?? false);

    // Messages
    $stmt = db()->prepare(
        "SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC"
    );
    $stmt->execute([$id]);
    $conv['messages'] = $stmt->fetchAll();

    // Tasks
    $stmt = db()->prepare(
        "SELECT * FROM ai_tasks WHERE conversation_id = ? ORDER BY created_at ASC"
    );
    $stmt->execute([$id]);
    $tasks = $stmt->fetchAll();
    foreach ($tasks as &$t) {
        $t['done'] = (bool)$t['done'];
    }
    $conv['tasks'] = $tasks;

    ok($conv);
}

// ── ai_conversation_mode ──────────────────────────────────────────────────────

if ($action === 'ai_conversation_mode') {
    $user = requireAuth();
    $b = body();
    $id   = $b['id']   ?? '';
    $mode = $b['mode'] ?? '';
    if (!$id || !in_array($mode, ['ai','human'], true)) err('Invalid params', 400);

    db()->prepare("UPDATE ai_conversations SET mode = ? WHERE id = ?")->execute([$mode, $id]);

    db()->prepare("
        INSERT INTO ai_audit_log (id, conversation_id, user_id, action, details)
        VALUES (?, ?, ?, 'mode_changed', ?)
    ")->execute([uuid(), $id, $user['id'], json_encode(['mode' => $mode])]);

    ok(['id' => $id, 'mode' => $mode]);
}

// ── ai_messages_create ────────────────────────────────────────────────────────

if ($action === 'ai_messages_create') {
    $user = requireAuth();
    $b = body();
    $conversation_id = $b['conversation_id'] ?? '';
    $content         = $b['content']         ?? '';
    $sender          = $b['sender']           ?? 'human';
    $message_type    = $b['message_type']     ?? 'sent';

    if (!$conversation_id || !$content) err('Missing fields', 400);
    if (!in_array($sender, ['client','ai','human','system'], true)) $sender = 'human';
    if (!in_array($message_type, ['inbound','draft','sent','note'], true)) $message_type = 'sent';

    $id = uuid();
    db()->prepare("
        INSERT INTO ai_messages (id, conversation_id, sender, message_type, content, status)
        VALUES (?, ?, ?, ?, ?, 'sent')
    ")->execute([$id, $conversation_id, $sender, $message_type, $content]);

    db()->prepare(
        "UPDATE ai_conversations SET last_activity_at = NOW() WHERE id = ?"
    )->execute([$conversation_id]);

    ok(['id' => $id]);
}

// ── ai_messages_upsert_draft ──────────────────────────────────────────────────

if ($action === 'ai_messages_upsert_draft') {
    $user = requireAuth();
    $b = body();
    $conversation_id  = $b['conversation_id']  ?? '';
    $content          = $b['content']          ?? '';
    $idempotency_key  = $b['idempotency_key']  ?? null;
    $metadata         = $b['metadata']         ?? null;

    if (!$conversation_id || !$content) err('Missing required fields', 400);

    // Idempotency check
    if ($idempotency_key) {
        $stmt = db()->prepare("SELECT id FROM ai_messages WHERE idempotency_key = ?");
        $stmt->execute([$idempotency_key]);
        $existing = $stmt->fetchColumn();
        if ($existing) ok(['id' => $existing, 'created' => false]);
    }

    $id = uuid();
    db()->prepare("
        INSERT INTO ai_messages
            (id, conversation_id, sender, message_type, content, status, idempotency_key, metadata)
        VALUES (?, ?, 'ai', 'draft', ?, 'pending', ?, ?)
    ")->execute([
        $id, $conversation_id, $content,
        $idempotency_key,
        $metadata ? json_encode($metadata) : null,
    ]);

    db()->prepare(
        "UPDATE ai_conversations SET last_activity_at = NOW() WHERE id = ?"
    )->execute([$conversation_id]);

    db()->prepare("
        INSERT INTO ai_audit_log (id, conversation_id, message_id, user_id, action)
        VALUES (?, ?, ?, ?, 'draft_created')
    ")->execute([uuid(), $conversation_id, $id, $user['id']]);

    ok(['id' => $id, 'created' => true]);
}

// ── ai_messages_approve ───────────────────────────────────────────────────────

if ($action === 'ai_messages_approve') {
    $user = requireAuth();
    $b = body();
    $id              = $b['id']      ?? '';
    $edited_content  = $b['content'] ?? null;
    if (!$id) err('Missing id', 400);

    $stmt = db()->prepare("SELECT * FROM ai_messages WHERE id = ? AND status = 'pending'");
    $stmt->execute([$id]);
    $msg = $stmt->fetch();
    if (!$msg) err('Draft not found or not pending', 404);

    if ($edited_content) {
        db()->prepare("
            UPDATE ai_messages
            SET status = 'sent', approved_by = ?, approved_at = NOW(), content = ?
            WHERE id = ?
        ")->execute([$user['id'], $edited_content, $id]);
    } else {
        db()->prepare("
            UPDATE ai_messages
            SET status = 'sent', approved_by = ?, approved_at = NOW()
            WHERE id = ?
        ")->execute([$user['id'], $id]);
    }

    db()->prepare(
        "UPDATE ai_conversations SET last_activity_at = NOW() WHERE id = ?"
    )->execute([$msg['conversation_id']]);

    db()->prepare("
        INSERT INTO ai_audit_log
            (id, conversation_id, message_id, user_id, action, details)
        VALUES (?, ?, ?, ?, 'draft_approved', ?)
    ")->execute([
        uuid(), $msg['conversation_id'], $id, $user['id'],
        json_encode(['edited' => !is_null($edited_content)]),
    ]);

    ok(['id' => $id]);
}

// ── ai_messages_reject ────────────────────────────────────────────────────────

if ($action === 'ai_messages_reject') {
    $user = requireAuth();
    $b = body();
    $id   = $b['id']   ?? '';
    $note = $b['note'] ?? null;
    if (!$id) err('Missing id', 400);

    $stmt = db()->prepare("SELECT * FROM ai_messages WHERE id = ? AND status = 'pending'");
    $stmt->execute([$id]);
    $msg = $stmt->fetch();
    if (!$msg) err('Draft not found or not pending', 404);

    db()->prepare("
        UPDATE ai_messages
        SET status = 'rejected', rejected_by = ?, rejected_at = NOW(), rejection_note = ?
        WHERE id = ?
    ")->execute([$user['id'], $note, $id]);

    db()->prepare("
        INSERT INTO ai_audit_log
            (id, conversation_id, message_id, user_id, action, details)
        VALUES (?, ?, ?, ?, 'draft_rejected', ?)
    ")->execute([
        uuid(), $msg['conversation_id'], $id, $user['id'],
        json_encode(['note' => $note]),
    ]);

    ok(['id' => $id]);
}

// ── ai_agent_settings_get ─────────────────────────────────────────────────────

if ($action === 'ai_agent_settings_get') {
    requireAuth();
    $company_id = $_GET['company_id'] ?? null;

    if ($company_id) {
        $stmt = db()->prepare("SELECT * FROM ai_agent_settings WHERE company_id = ?");
        $stmt->execute([$company_id]);
    } else {
        $stmt = db()->query(
            "SELECT * FROM ai_agent_settings ORDER BY created_at ASC LIMIT 1"
        );
    }
    $s = $stmt->fetch();
    if (!$s) ok(null);
    $s['enabled'] = (bool)$s['enabled'];
    ok($s);
}

// ── ai_agent_settings_upsert ──────────────────────────────────────────────────

if ($action === 'ai_agent_settings_upsert') {
    $user = requireAuth();
    if (!ai_is_admin($user)) err('Forbidden', 403);
    $b = body();

    $company_id = $b['company_id'] ?? '';
    if (!$company_id) err('Missing company_id', 400);

    $enabled    = isset($b['enabled']) ? (int)(bool)$b['enabled'] : null;
    $model      = $b['model']          ?? null;
    $sys_prompt = $b['system_prompt']  ?? null;
    $kb         = $b['knowledge_base'] ?? null;
    $temp       = isset($b['temperature']) ? (float)$b['temperature'] : null;
    $max_tok    = isset($b['max_tokens'])  ? (int)$b['max_tokens']   : null;

    $stmt = db()->prepare("SELECT id FROM ai_agent_settings WHERE company_id = ?");
    $stmt->execute([$company_id]);
    $exists = $stmt->fetchColumn();

    if ($exists) {
        $sets = []; $vals = [];
        if (!is_null($enabled))    { $sets[] = 'enabled = ?';       $vals[] = $enabled; }
        if (!is_null($model))      { $sets[] = 'model = ?';         $vals[] = $model; }
        if (!is_null($sys_prompt)) { $sets[] = 'system_prompt = ?'; $vals[] = $sys_prompt; }
        if (!is_null($kb))         { $sets[] = 'knowledge_base = ?';$vals[] = $kb; }
        if (!is_null($temp))       { $sets[] = 'temperature = ?';   $vals[] = $temp; }
        if (!is_null($max_tok))    { $sets[] = 'max_tokens = ?';    $vals[] = $max_tok; }
        if (!$sets) ok(['id' => $exists]);
        $vals[] = $company_id;
        db()->prepare("UPDATE ai_agent_settings SET " . implode(',', $sets) . " WHERE company_id = ?")
             ->execute($vals);
        ok(['id' => $exists]);
    } else {
        $id = uuid();
        db()->prepare("
            INSERT INTO ai_agent_settings
                (id, company_id, enabled, model, system_prompt, knowledge_base, temperature, max_tokens)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            $id, $company_id,
            $enabled  ?? 0,
            $model    ?? 'claude-sonnet-5-20251001',
            $sys_prompt, $kb,
            $temp     ?? 0.30,
            $max_tok  ?? 1024,
        ]);
        ok(['id' => $id]);
    }
}

// ── ai_conversation_create ────────────────────────────────────────────────────

if ($action === 'ai_conversations_create') {
    $user = requireAuth();
    $b = body();

    $lead_id    = $b['lead_id']    ?? null;
    $client_id  = $b['client_id']  ?? null;
    $company_id = $b['company_id'] ?? '00000000-0000-0000-0000-000000000001';
    $channel    = $b['channel']    ?? 'crm';
    $priority   = $b['priority']   ?? 'medium';
    $subject    = $b['subject']    ?? null;

    // Si ya existe una conversación activa para este lead, devolver la existente
    if ($lead_id) {
        $stmt = db()->prepare("SELECT id FROM ai_conversations WHERE lead_id = ? AND status != 'archived' LIMIT 1");
        $stmt->execute([$lead_id]);
        $existing = $stmt->fetchColumn();
        if ($existing) ok(['id' => $existing, 'existing' => true]);
    }

    $id = uuid();
    db()->prepare("
        INSERT INTO ai_conversations
            (id, company_id, lead_id, client_id, channel, priority, subject, status, mode, assigned_user_id, last_activity_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 'ai', ?, NOW(), NOW(), NOW())
    ")->execute([$id, $company_id, $lead_id, $client_id, $channel, $priority, $subject, $user['id']]);

    db()->prepare("INSERT INTO ai_audit_log (id, conversation_id, user_id, action, details, created_at) VALUES (?, ?, ?, 'conversation_created', '{}', NOW())")
       ->execute([uuid(), $id, $user['id']]);

    ok(['id' => $id]);
}
