<?php
require_once 'config.php';

$r = $conn->query('SELECT COUNT(*) as total FROM tabela_precos');
$row = $r->fetch_assoc();
echo "Total de rutas: " . $row['total'] . "\n";

$r = $conn->query('SELECT DISTINCT origem FROM tabela_precos ORDER BY origem');
echo "Orixes dispoñibles:\n";
while ($row = $r->fetch_assoc()) {
    echo "  - " . $row['origem'] . "\n";
}

$r = $conn->query('SELECT DISTINCT destino FROM tabela_precos ORDER BY destino LIMIT 20');
echo "\nPrimeiros 20 destinos:\n";
while ($row = $r->fetch_assoc()) {
    echo "  - " . $row['destino'] . "\n";
}