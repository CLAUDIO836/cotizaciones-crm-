<?php
// Fix: mensajes salientes con status='received' (default incorrecto) → 'sent'
// EJECUTAR UNA VEZ, luego neutralizar
$_s = '/home/transccl/crm-secrets.php';
if (file_exists($_s)) require_once $_s;

$pdo = new PDO(
    'mysql:host=localhost;dbname=transccl_crm;charset=utf8mb4',
    'transccl_crm_user',
    defined('CRM_DB_PASSWORD') ? CRM_DB_PASSWORD : getenv('CRM_DB_PASSWORD')
);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$stmt = $pdo->prepare("UPDATE wa_cloud_messages SET status='sent' WHERE direction='out' AND status='received'");
$stmt->execute();
$affected = $stmt->rowCount();

echo "✅ Corregidos: $affected mensajes salientes status=received → sent\n";
