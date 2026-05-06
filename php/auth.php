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
    case 'check_auth':
        handleCheckAuth($conn, $input);
        break;
    case 'login':
        handleLogin($conn, $input);
        break;
    case 'me':
        handleMe($conn, $input);
        break;
    default:
        sendResponse(["error" => "Ação de auth desconhecida"], 400);
}

function handleCheckAuth($conn, $input) {
    if (!isset($input['telefone'])) {
        sendResponse(["error" => "Telefone obrigatório"], 400);
    }
    $telefone = preg_replace('/\D/', '', $input['telefone']);
    
    $stmt = $conn->prepare("SELECT id FROM `users` WHERE `telefone` = ? LIMIT 1");
    $stmt->bind_param("s", $telefone);
    $stmt->execute();
    $result = $stmt->get_result();
    $exists = $result->fetch_assoc();
    
    sendResponse(["exists" => !!$exists]);
}

function handleLogin($conn, $input) {
    if (!isset($input['telefone'])) {
        sendResponse(["error" => "Telefone obrigatório"], 400);
    }

    $telefone = preg_replace('/\D/', '', $input['telefone']);
    $password = $input['senha'] ?? null;
    $token = $input['token'] ?? null;
    $nome = $input['nome'] ?? null;

    $stmt = $conn->prepare("SELECT * FROM `users` WHERE `telefone` = ? LIMIT 1");
    $stmt->bind_param("s", $telefone);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();

    if ($user) {
        // Usuário existe, validar token (estilo Snake Game) ou senha
        if ($token) {
            // Se o token for fornecido, validamos ele (ou a senha, dependendo da preferência)
            // Aqui vamos aceitar o token gravado na coluna 'senha' ou uma nova coluna 'token'
            // Para simplicidade seguindo o pedido do usuário, vamos tratar o campo 'senha' como o token se ele for alfanumérico longo
            if ($user['senha'] === $token || (isset($user['token']) && $user['token'] === $token)) {
                $sessionToken = base64_encode(json_encode(['id' => $user['id'], 'exp' => time() + (86400 * 30)]));
                sendResponse([
                    "user" => $user,
                    "token" => $sessionToken,
                    "permanent_token" => $user['token'] ?? $user['senha']
                ]);
            } else {
                sendResponse(["error" => "token_invalido", "message" => "Token de acesso incorreto."], 401);
            }
        } else {
            // Existe mas não enviou token, pedir token
            sendResponse(["error" => "needs_token", "message" => "Este telefone já está registrado. Por favor, insira seu token de acesso."], 401);
        }
    } else {
        // Novo usuário, criar e gerar token
        if (empty($nome)) {
            sendResponse(["error" => "nome_obrigatorio", "message" => "Informe seu nome para criar a conta."], 400);
        }
        
        $newToken = strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)) . '-' . rand(1000, 9999);
        $userId = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );

        $stmt = $conn->prepare("INSERT INTO `users` (id, nome, telefone, senha, token, tipo, status) VALUES (?, ?, ?, ?, ?, 'cliente', 'ativo')");
        $stmt->bind_param("sssss", $userId, $nome, $telefone, $newToken, $newToken);
        
        if ($stmt->execute()) {
            $sessionToken = base64_encode(json_encode(['id' => $userId, 'exp' => time() + (86400 * 30)]));
            sendResponse([
                "user" => ["id" => $userId, "nome" => $nome, "telefone" => $telefone, "tipo" => "cliente"],
                "token" => $sessionToken,
                "permanent_token" => $newToken,
                "is_new" => true
            ]);
        } else {
            sendResponse(["error" => "falha_registro", "message" => "Erro ao criar usuário."], 500);
        }
    }
}

function handleMe($conn, $input) {
    if (!isset($input['token'])) {
        sendResponse(["error" => "Token ausente"], 401);
    }

    try {
        $payload = json_decode(base64_decode($input['token']), true);
        if (!$payload || !isset($payload['id'])) throw new Exception("Token inválido");

        $stmt = $conn->prepare("SELECT * FROM `users` WHERE `id` = ? LIMIT 1");
        $stmt->bind_param("s", $payload['id']);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();

        if (!$user) sendResponse(["error" => "Usuário não encontrado"], 404);

        sendResponse($user);
    } catch (Exception $e) {
        sendResponse(["error" => "Sessão expirada"], 401);
    }
}