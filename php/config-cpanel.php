<?php
/**
 * Configuração de conexão com o banco de dados MySQL - cPanel
 */
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Habilitar CORS para permitir que o React acessa a API
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Authorization, Content-Type, x-client-info, apikey");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Tratar requisições OPTIONS (Preflight)
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configurações do Banco de Dados cPanel
define('DB_HOST', 'localhost');
define('DB_NAME', 'malacaco_rfdrive');
define('DB_USER', 'root');
define('DB_PASS', '');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    header("Content-Type: application/json");
    echo json_encode(["error" => "Falha na conexão: " . $conn->connect_error]);
    exit();
}
$conn->set_charset("utf8mb4");

/**
 * Função utilitária para enviar resposta JSON
 */
function sendResponse($data, $status = 200) {
    http_response_code($status);
    header("Content-Type: application/json; charset=UTF-8");
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false) {
        echo json_encode(["error" => "Erro de codificação JSON: " . json_last_error_msg()]);
    } else {
        echo $json;
    }
    exit();
}