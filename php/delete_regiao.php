<?php
// Deleta região com segurança (desvincula lugares primeiro)
require_once 'config.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$nome = trim($data['nome'] ?? '');

if (empty($nome)) {
    http_response_code(400);
    echo json_encode(['error' => 'Nome da região é obrigatório']);
    exit;
}

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
$conn->set_charset('utf8mb4');

// Buscar ID da região
$result = $conn->query("SELECT id FROM regioes_precos WHERE nome = '$nome'");
$regiao = $result->fetch_assoc();

if (!$regiao) {
    http_response_code(404);
    echo json_encode(['error' => 'Região não encontrada']);
    exit;
}

$regiaoId = $regiao['id'];

// 1. Atualizar lugares para desvincular
$stmt = $conn->prepare("UPDATE localidades SET regiao_id = NULL WHERE regiao_id = ?");
$stmt->bind_param("s", $regiaoId);
$stmt->execute();

// 2. Deletar região
$stmt = $conn->prepare("DELETE FROM regioes_precos WHERE id = ?");
$stmt->bind_param("s", $regiaoId);
$stmt->execute();

$conn->close();

echo json_encode(['success' => true, 'message' => "Região '$nome' removida com sucesso"]);