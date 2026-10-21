<?php
// Script one-time: crea tabla outbound_calls
// ELIMINAR después de ejecutar
$pdo = new PDO('mysql:host=localhost;dbname=transccl_crm;charset=utf8mb4', 'transccl_crm_user', 'Claudio@1978', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec("CREATE TABLE IF NOT EXISTS outbound_calls (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id    CHAR(36) NOT NULL,
    to_number  VARCHAR(30) NOT NULL,
    called_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_to_number (to_number),
    INDEX idx_called_at (called_at)
)");
echo json_encode(['ok' => true, 'msg' => 'Tabla outbound_calls creada']);
