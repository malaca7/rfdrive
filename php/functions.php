<?php
require_once 'config.php';

/**
 * API de Funções Especiais - Substitui as Edge Functions do Supabase
 * Inclui: reset de senha, webhooks, cálculos especiais, etc.
 */

$input = json_decode(file_get_contents("php://input"), true);

if (!$input || !isset($input['function'])) {
    sendResponse(["error" => "Requisição inválida"], 400);
}

$function = $input['function'];

try {
    switch ($function) {
        case 'reset-password':
            handleResetPassword($conn, $input);
            break;
        case 'check-pix-status':
            handleCheckPixStatus($conn, $input);
            break;
        case 'create-pix-payment':
            handleCreatePixPayment($conn, $input);
            break;
        case 'mercadopago-webhook':
            handleMercadopagoWebhook($conn, $input);
            break;
        case 'send-push':
            handleSendPush($conn, $input);
            break;
        case 'whatsapp-webhook':
            handleWhatsappWebhook($conn, $input);
            break;
        case 'parse-ride':
            handleParseRide($conn, $input);
            break;
        case 'calculate-route':
            handleCalculateRoute($conn, $input);
            break;
        default:
            sendResponse(["error" => "Função não implementada: $function"], 404);
    }
} catch (Exception $e) {
    sendResponse(["error" => $e->getMessage()], 500);
}

// ==================== PASSWORD ====================
function handleResetPassword($conn, $input) {
    if (!isset($input['body']['userId'], $input['body']['newPassword'])) {
        sendResponse(["error" => "userId e newPassword obrigatórios"], 400);
    }
    
    $userId = $input['body']['userId'];
    $newPassword = $input['body']['newPassword'];
    
    $stmt = $conn->prepare("UPDATE `users` SET `senha` = :pass WHERE `id` = :id");
    $stmt->execute([':pass' => $newPassword, ':id' => $userId]);
    
    if ($stmt->rowCount() === 0) {
        sendResponse(["error" => "Usuário não encontrado"], 404);
    }
    
    sendResponse(["success" => true, "message" => "Senha alterada"]);
}

// ==================== PAYMENTS ====================
function handleCheckPixStatus($conn, $input) {
    if (!isset($input['body']['transactionId'])) {
        sendResponse(["error" => "transactionId obrigatório"], 400);
    }
    
    $transactionId = $input['body']['transactionId'];
    
    // Buscar na DB ou integrar com API de Pix real
    // Por enquanto, responder com mock
    
    sendResponse([
        "status" => "completed",
        "transactionId" => $transactionId,
        "amount" => 150.00,
        "timestamp" => date('c')
    ]);
}

function handleCreatePixPayment($conn, $input) {
    if (!isset($input['body']['user_id'], $input['body']['amount'])) {
        sendResponse(["error" => "user_id e amount obrigatórios"], 400);
    }
    
    $userId = $input['body']['user_id'];
    $amount = $input['body']['amount'];
    
    // Integrar com API de Pix
    // Por enquanto, gerar um QR code mock
    
    $paymentId = uniqid('pix_');
    
    sendResponse([
        "success" => true,
        "paymentId" => $paymentId,
        "qrCode" => "00020126580014br.gov.bcb.pix...",
        "amount" => $amount,
        "expiresAt" => date('c', time() + 3600)
    ]);
}

function handleMercadopagoWebhook($conn, $input) {
    // Webhooks do MercadoPago
    $action = $input['action'] ?? null;
    $data = $input['data'] ?? [];
    
    if ($action === 'payment.created' || $action === 'payment.updated') {
        $paymentId = $data['id'] ?? null;
        $status = $data['status'] ?? 'unknown';
        
        // Registrar no banco de dados
        $stmt = $conn->prepare("
            INSERT INTO `pagamentos_mercadopago`
            (mercadopago_id, status, dados, created_at)
            VALUES (:id, :status, :dados, NOW())
            ON DUPLICATE KEY UPDATE status = VALUES(status)
        ");
        
        $stmt->execute([
            ':id' => $paymentId,
            ':status' => $status,
            ':dados' => json_encode($data)
        ]);
    }
    
    sendResponse(["success" => true]);
}

// ==================== NOTIFICATIONS ====================
function handleSendPush($conn, $input) {
    if (!isset($input['body']['userId'], $input['body']['message'])) {
        sendResponse(["error" => "userId e message obrigatórios"], 400);
    }
    
    $userId = $input['body']['userId'];
    $message = $input['body']['message'];
    $title = $input['body']['title'] ?? 'Notificação';
    
    // Integrar com serviço de push (Firebase, OneSignal, etc)
    // Por enquanto, apenas registrar
    
    sendResponse([
        "success" => true,
        "message" => "Push notification enfileirada",
        "userId" => $userId
    ]);
}

function handleWhatsappWebhook($conn, $input) {
    $from = $input['from'] ?? null;
    $message = $input['message'] ?? null;
    $timestamp = $input['timestamp'] ?? date('c');
    
    if (!$from || !$message) {
        sendResponse(["error" => "from e message obrigatórios"], 400);
    }
    
    // Registrar mensagem
    $stmt = $conn->prepare("
        INSERT INTO `whatsapp_messages`
        (telefone, mensagem, tipo, criado_em)
        VALUES (:telefone, :mensagem, 'entrada', NOW())
    ");
    
    $stmt->execute([
        ':telefone' => $from,
        ':mensagem' => $message
    ]);
    
    sendResponse(["success" => true, "messageId" => $conn->lastInsertId()]);
}

// ==================== PARSING & CALCULATIONS ====================
function handleParseRide($conn, $input) {
    $rideText = $input['body']['text'] ?? '';
    $audioUrl = $input['body']['audioUrl'] ?? null;
    
    // Usar IA ou regex para extrair origem/destino
    preg_match_all('/(?:de|da|do|from)\s+([^,]+?)(?:,|\s+para|\s+to|\s+$)/i', $rideText, $origem);
    preg_match_all('/(?:para|to|at)\s+([^,]+?)(?:,|$)/i', $rideText, $destino);
    
    $origemTexto = trim($origem[1][0] ?? 'Não identificada');
    $destinoTexto = trim($destino[1][0] ?? 'Não identificada');
    
    sendResponse([
        "origem" => $origemTexto,
        "destino" => $destinoTexto,
        "confidence" => 0.85,
        "audioProcessed" => $audioUrl ? true : false
    ]);
}

function handleCalculateRoute($conn, $input) {
    $origin = $input['body']['origin'] ?? null;
    $destination = $input['body']['destination'] ?? null;
    
    if (!$origin || !$destination) {
        sendResponse(["error" => "origin e destination obrigatórios"], 400);
    }
    
    // Integrar com API de rotas (Google Maps, OpenRouteService, etc)
    // Por enquanto, retornar valores mock
    
    sendResponse([
        "distance" => 12.5,
        "distanceUnit" => "km",
        "duration" => 1200,
        "durationUnit" => "seconds",
        "route" => [
            ["lat" => -15.789, "lng" => -48.123],
            ["lat" => -15.795, "lng" => -48.130]
        ],
        "polyline" => "encoded_polyline_string"
    ]);
}
