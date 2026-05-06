<?php
// Script para ver a estrutura da tabela localidades

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'config.php';

echo "=== Estrutura da tabela localidades ===\n";

$result = $conn->query("DESCRIBE localidades");
while ($row = $result->fetch_assoc()) {
    echo $row['Field'] . " - " . $row['Type'] . "\n";
}

echo "\n=== Dados actuais ===\n";
$result = $conn->query("SELECT * FROM localidades LIMIT 10");
while ($row = $result->fetch_assoc()) {
    echo $row['nome'] . "\n";
}