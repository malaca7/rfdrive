<?php
require 'config.php';

$result = $conn->query('DESCRIBE users');
$cols = $result->fetchAll();

echo "Colunas na tabela users (" . count($cols) . "):\n\n";
foreach($cols as $col) {
    echo "  - " . $col['Field'] . " (" . $col['Type'] . ")\n";
}

echo "\n\nTabelas no banco:\n";
$tables = $conn->query('SHOW TABLES')->fetchAll();
foreach($tables as $table) {
    echo "  - " . $table[0] . "\n";
}

echo "\nTotal de tabelas: " . count($tables) . "\n";
?>
