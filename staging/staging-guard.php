<?php
/**
 * staging-guard.php — Bloqueo de comunicaciones externas para entorno staging
 * Incluido al inicio de cada PHP de staging.
 * NO subir a producción. NO modificar sin autorización de Gerencia.
 */

if (!defined('STAGING_MODE')) {
    define('STAGING_MODE', true);
}

/**
 * Lanza RuntimeException si el servicio externo está bloqueado en staging.
 * Registra el intento en el error_log del servidor.
 *
 * @param string $service  'whatsapp' | 'claude' | 'self_call_prod'
 */
function staging_block(string $service): void {
    $caller = '';
    $bt = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2);
    if (isset($bt[1])) {
        $caller = ($bt[1]['class'] ?? '') . ($bt[1]['type'] ?? '') . ($bt[1]['function'] ?? '') . ':' . ($bt[0]['line'] ?? '?');
    }

    $label = [
        'whatsapp'      => 'WhatsApp Business API (graph.facebook.com)',
        'claude'        => 'Anthropic Claude API (api.anthropic.com)',
        'self_call_prod'=> 'Self-call a producción (transccl.cl/crm-api.php)',
    ][$service] ?? $service;

    error_log("[STAGING BLOCK] Llamada a $label bloqueada. Origen: $caller");

    throw new RuntimeException(
        "[staging] Comunicación externa bloqueada: $service. " .
        "Esta función no opera en el entorno de pruebas."
    );
}
