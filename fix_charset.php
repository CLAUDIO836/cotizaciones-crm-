<?php
// Script one-time: convierte columnas de texto a utf8mb4 (sin tocar columnas FK)
$_s = '/home/transccl/crm-secrets.php';
if (file_exists($_s)) require_once $_s;

$pdo = new PDO('mysql:host=localhost;dbname=transccl_crm;charset=utf8mb4',
    'transccl_crm_user',
    getenv('CRM_DB_PASSWORD') ?: 'Claudio@1978',
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
     PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);

$tables = ['quotation_items', 'quotations', 'clients', 'contacts',
           'quotation_notes', 'quotation_activities', 'contracts',
           'approval_letters', 'quotation_approvals', 'quotation_pdfs'];

// Recopilar columnas que son parte de FK (ambos lados) para saltarlas
$fkCols = [];
try {
    $stmt = $pdo->query("
        SELECT kcu.TABLE_NAME, kcu.COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE kcu
        JOIN information_schema.TABLE_CONSTRAINTS tc
            ON kcu.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
            AND kcu.CONSTRAINT_NAME  = tc.CONSTRAINT_NAME
            AND kcu.TABLE_NAME       = tc.TABLE_NAME
        WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
          AND kcu.CONSTRAINT_SCHEMA = 'transccl_crm'
        UNION
        SELECT kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE kcu
        WHERE kcu.CONSTRAINT_SCHEMA = 'transccl_crm'
          AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ");
    foreach ($stmt->fetchAll() as $r) {
        $fkCols[$r['TABLE_NAME'] . '.' . $r['COLUMN_NAME']] = true;
    }
} catch (PDOException $e) {
    // Si falla info_schema, continuar igual (las columnas FK suelen ser INT/UUID)
}

$results = [];
foreach ($tables as $table) {
    $results[$table] = [];

    // 1. Cambiar charset por defecto de la tabla
    try {
        $pdo->exec("ALTER TABLE `$table` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $results[$table]['__default'] = 'OK';
    } catch (PDOException $e) {
        $results[$table]['__default'] = 'SKIP: ' . $e->getMessage();
    }

    // 2. Obtener columnas de texto de esta tabla
    $colStmt = $pdo->prepare("
        SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = 'transccl_crm'
          AND TABLE_NAME   = ?
          AND DATA_TYPE IN ('char','varchar','tinytext','text','mediumtext','longtext')
        ORDER BY ORDINAL_POSITION
    ");
    $colStmt->execute([$table]);

    foreach ($colStmt->fetchAll() as $col) {
        $colKey = "$table.{$col['COLUMN_NAME']}";
        if (isset($fkCols[$colKey])) {
            $results[$table][$col['COLUMN_NAME']] = 'SKIPPED (FK column)';
            continue;
        }

        $nullable = $col['IS_NULLABLE'] === 'YES' ? 'NULL' : 'NOT NULL';
        $default  = '';
        if ($col['COLUMN_DEFAULT'] !== null) {
            $escaped = str_replace("'", "''", $col['COLUMN_DEFAULT']);
            $default = "DEFAULT '$escaped'";
        }
        $extra = $col['EXTRA'] ? ' ' . $col['EXTRA'] : '';
        $type  = $col['COLUMN_TYPE'];

        $sql = "ALTER TABLE `$table` MODIFY COLUMN `{$col['COLUMN_NAME']}` "
             . "$type CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci "
             . "$nullable $default$extra";

        try {
            $pdo->exec($sql);
            $results[$table][$col['COLUMN_NAME']] = 'OK';
        } catch (PDOException $e) {
            $results[$table][$col['COLUMN_NAME']] = 'ERROR: ' . $e->getMessage();
        }
    }
}

header('Content-Type: application/json');
echo json_encode(['results' => $results], JSON_PRETTY_PRINT);
