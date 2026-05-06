<?php
require_once 'config.php';

/**
 * API de Upload de Arquivos
 * POST multipart/form-data para upload com bucket
 * POST JSON com action=delete para remoção
 */

$input = json_decode(file_get_contents("php://input"), true);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(["error" => "Método não permitido"], 405);
}

// Check if this is a delete operation
if (isset($input['action']) && $input['action'] === 'delete') {
    $paths = $input['paths'] ?? [];
    $bucket = $input['bucket'] ?? 'default';
    
    if (!is_array($paths) || empty($paths)) {
        sendResponse(["error" => "Nenhum caminho especificado"], 400);
    }
    
    $deleted = [];
    $errors = [];
    $baseDir = "../uploads/";
    
    foreach ($paths as $path) {
        // Sanitize path and construct full path with bucket
        $cleanPath = str_replace(['../', '..\\', '\\'], '/', $path);
        
        // Remove o bucket do path se ele já começar com o bucket (ex: avatars/avatars/...)
        if (strpos($cleanPath, $bucket . '/') === 0) {
            $cleanPath = substr($cleanPath, strlen($bucket) + 1);
        }
        
        $bucketDir = $baseDir . $bucket . '/';
        $fullPath = $bucketDir . $cleanPath;
        
        if (file_exists($fullPath) && unlink($fullPath)) {
            $deleted[] = $path;
        } else {
            $errors[] = "Arquivo não encontrado ou falha ao remover: $path";
        }
    }
    
    if (empty($errors)) {
        sendResponse(["success" => true, "deleted" => $deleted]);
    } else {
        sendResponse(["success" => true, "deleted" => $deleted, "errors" => $errors]);
    }
}

// Upload handling
if (!isset($_FILES['file']) || !isset($_POST['bucket'])) {
    sendResponse(["error" => "Arquivo e bucket obrigatórios"], 400);
}

$file = $_FILES['file'];
$bucket = preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['bucket']);
$path = $_POST['path'] ?? uniqid() . '.' . strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

// Remove o bucket do path se ele já começar com o bucket
$cleanPath = str_replace(['../', '..\\', '\\'], '/', $path);
if (strpos($cleanPath, $bucket . '/') === 0) {
    $cleanPath = substr($cleanPath, strlen($bucket) + 1);
}

$fileName = $cleanPath;
$fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

if (empty($fileExt)) {
    $fileExt = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!empty($fileExt)) {
        $fileName .= '.' . $fileExt;
    } else {
        $fileExt = 'jpg'; // fallback
        $fileName .= '.jpg';
    }
}

$targetPath = __DIR__ . "/uploads/" . $bucket . "/" . $fileName;
$targetDir = dirname($targetPath);

if (!file_exists($targetDir)) {
    mkdir($targetDir, 0777, true);
}

// Validar tipos permitidos
$allowed = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'mp3', 'wav', 'ogg'];
if (!in_array($fileExt, $allowed)) {
    sendResponse(["error" => "Tipo de arquivo não permitido ($fileExt)"], 400);
}

if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    // Retornar a URL relativa ao projeto
    $baseUrl = "/rfdrive/php/uploads/" . $bucket . "/";
    
    sendResponse([
        "success" => true,
        "url" => $baseUrl . $fileName,
        "path" => $bucket . "/" . $fileName
    ]);
} else {
    sendResponse(["error" => "Falha ao mover arquivo"], 500);
}
