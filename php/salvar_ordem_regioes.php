<?php
// Salva a ordem das regiões
require_once 'config.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$ordem = $data['ordem'] ?? [];

if (empty($ordem)) {
    http_response_code(400);
    echo json_encode(['error' => 'Nenhuma ordem informada']);
    exit;
}

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
$conn->set_charset('utf8mb4');

// Verificar se coluna ordem existe
$result = $conn->query("SHOW COLUMNS FROM regioes_precos LIKE 'ordem'");
if ($result->num_rows === 0) {
    $conn->query("ALTER TABLE regioes_precos ADD COLUMN ordem INT DEFAULT 0");
}

// Atualizar ordem
$stmt = $conn->prepare("UPDATE regioes_precos SET ordem = ? WHERE id = ?");
foreach ($ordem as $item) {
    $stmt->bind_param("is", $item['ordem'], $item['id']);
    $stmt->execute();
}

$conn->close();

echo json_encode(['success' => true]);