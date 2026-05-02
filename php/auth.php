<?php
require_once 'config.php';

/**
 * API de Autenticação
 * POST { "action": "login", "telefone": "...", "senha": "..." }
 * POST { "action": "me", "token": "..." }
 */

$input = json_decode(file_get_contents("php://input"), true);

if (!$input || !isset($input['action'])) {
    sendResponse(["error" => "Requisição inválida"], 400);
}

$action = $input['action'];

switch ($action) {
    case 'login':
        handleLogin($conn, $input);
        break;
    case 'me':
        handleMe($conn, $input);
        break;
    default:
        sendResponse(["error" => "Ação de auth desconhecida"], 400);
}

function handleLogin($conn, $input) {
    if (!isset($input['telefone']) || !isset($input['senha'])) {
        sendResponse(["error" => "Telefone e senha obrigatórios"], 400);
    }

    $telefone = preg_replace('/\D/', '', $input['telefone']);
    $senha = $input['senha'];

    $stmt = $conn->prepare("SELECT * FROM `users` WHERE `telefone` = :tel OR `telefone` = :tel_orig LIMIT 1");
    $stmt->execute([':tel' => $telefone, ':tel_orig' => $input['telefone']]);
    $user = $stmt->fetch();

    if (!$user) {
        sendResponse(["error" => "Usuário não encontrado. Buscado: $telefone"], 401);
    }

    if ($user['senha'] !== $senha) {
        sendResponse(["error" => "Senha incorreta para o usuário " . $user['nome']], 401);
    }

    if ($user['status'] === 'banido') {
        sendResponse(["error" => "Sua conta está desativada"], 403);
    }

    // Gerar um token simples (em produção use JWT)
    $token = base64_encode(json_encode(['id' => $user['id'], 'exp' => time() + (86400 * 30)]));

    sendResponse([
        "user" => $user,
        "token" => $token,
        "session" => [
            "access_token" => $token,
            "user" => $user
        ]
    ]);
}

function handleMe($conn, $input) {
    if (!isset($input['token'])) {
        sendResponse(["error" => "Token ausente"], 401);
    }

    try {
        $payload = json_decode(base64_decode($input['token']), true);
        if (!$payload || !isset($payload['id'])) throw new Exception("Token inválido");

        $stmt = $conn->prepare("SELECT * FROM `users` WHERE `id` = :id LIMIT 1");
        $stmt->execute([':id' => $payload['id']]);
        $user = $stmt->fetch();

        if (!$user) sendResponse(["error" => "Usuário não encontrado"], 404);

        sendResponse($user);
    } catch (Exception $e) {
        sendResponse(["error" => "Sessão expirada"], 401);
    }
}
