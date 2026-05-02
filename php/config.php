<?php
/**
 * Configuração de conexão com o banco de dados MySQL
 */

// Habilitar CORS para permitir que o React acesse a API
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Authorization, Content-Type, x-client-info, apikey");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Tratar requisições OPTIONS (Preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configurações do Banco de Dados - PREENCHA COM SEUS DADOS DO CPANEL
define('DB_HOST', 'localhost');
define('DB_NAME', 'malacaco_rfdrive'); // Nome do banco criado no cPanel
define('DB_USER', 'root'); // Usuário do banco criado no cPanel
define('DB_PASS', ''); // Senha do usuário

try {
    $conn = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch(PDOException $e) {
    die(json_encode(["error" => "Falha na conexão: " . $e->getMessage()]));
}

/**
 * Função utilitária para enviar resposta JSON
 */
function sendResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit();
}
