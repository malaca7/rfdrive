<?php
// Adiciona coluna ordem se não existir
require_once 'config.php';

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
$conn->set_charset('utf8mb4');

$result = $conn->query("SHOW COLUMNS FROM regioes_precos LIKE 'ordem'");
if ($result->num_rows === 0) {
    $conn->query("ALTER TABLE regioes_precos ADD COLUMN ordem INT DEFAULT 0");
    echo "Coluna 'ordem' adicionada!\n";
} else {
    echo "Coluna 'ordem' já existe.\n";
}

$conn->close();