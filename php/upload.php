<?php
require_once 'config.php';

/**
 * API de Upload de Arquivos
 * POST multipart/form-data
 */

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(["error" => "Método não permitido"], 405);
}

if (!isset($_FILES['file'])) {
    sendResponse(["error" => "Nenhum arquivo enviado"], 400);
}

$file = $_FILES['file'];
$targetDir = "../uploads/";

if (!file_exists($targetDir)) {
    mkdir($targetDir, 0777, true);
}

$fileExt = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$fileName = uniqid() . '.' . $fileExt;
$targetPath = $targetDir . $fileName;

// Validar tipos permitidos
$allowed = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'mp3', 'wav', 'ogg'];
if (!in_array($fileExt, $allowed)) {
    sendResponse(["error" => "Tipo de arquivo não permitido"], 400);
}

if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    // Retornar a URL pública (ajuste conforme seu domínio)
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
    $host = $_SERVER['HTTP_HOST'];
    $baseUrl = "$protocol://$host/rfdrive/uploads/";
    
    sendResponse([
        "success" => true,
        "url" => $baseUrl . $fileName,
        "path" => "uploads/" . $fileName
    ]);
} else {
    sendResponse(["error" => "Falha ao mover arquivo"], 500);
}
