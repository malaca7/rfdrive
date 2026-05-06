<?php
require_once 'config.php';

$input = json_decode(file_get_contents("php://input"), true);

header("Content-Type: application/json");
echo json_encode([
    'received' => $input,
    'raw' => file_get_contents("php://input"),
    'content_type' => $_SERVER['CONTENT_TYPE'] ?? 'none'
]);