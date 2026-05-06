<?php
require_once 'config.php';

/**
 * API de Endpoints especializados para funcionalidades complexas
 * Manipula: preços, corridas, notificações, etc.
 */

$rawInput = file_get_contents('php://input');
if (empty($rawInput)) {
    $rawInput = file_get_contents('php://stdin');
}
$input = json_decode($rawInput, true);

if (!$input || !isset($input['endpoint'])) {
    sendResponse(["error" => "Requisição inválida"], 400);
}

$endpoint = $input['endpoint'];

try {
    switch ($endpoint) {
        case 'pricing/calculate':
            handlePricingCalculate($conn, $input);
            break;
        case 'rides/create':
            handleCreateRide($conn, $input);
            break;
        case 'rides/update':
            handleUpdateRide($conn, $input);
            break;
        case 'rides/list':
            handleListRides($conn, $input);
            break;
        case 'rides/getById':
            handleGetRideById($conn, $input);
            break;
        case 'notifications/send':
            handleSendNotification($conn, $input);
            break;
        case 'drivers/available':
            handleAvailableDrivers($conn, $input);
            break;
        case 'drivers/updateLocation':
            handleUpdateDriverLocation($conn, $input);
            break;
        case 'evaluation/create':
            handleCreateEvaluation($conn, $input);
            break;
        case 'evaluation/links':
            handleGetEvaluationLinks($conn, $input);
            break;
        default:
            sendResponse(["error" => "Endpoint não encontrado: $endpoint"], 404);
    }
} catch (Exception $e) {
    sendResponse(["error" => $e->getMessage()], 500);
}

// ==================== PRICING ====================
function handlePricingCalculate($conn, $input) {
    $origem = $input['origem'] ?? null;
    $destino = $input['destino'] ?? null;
    $horario = $input['horario'] ?? date('H:i:s');
    
    // Buscar preço base da rota
    $stmt = $conn->prepare("
        SELECT * FROM `precos_rotas`
        WHERE `origem_id` = :origem AND `destino_id` = :destino
        AND `ativo` = 1
        ORDER BY `prioridade` DESC
        LIMIT 1
    ");
    $stmt->execute([':origem' => $origem, ':destino' => $destino]);
    $rota = $stmt->fetch();
    
    $preco_base = $rota['preco_fixo'] ?? 50; // Valor padrão
    $preco_final = $preco_base;
    
    // Aplicar regras de horário
    $stmt = $conn->prepare("
        SELECT * FROM `regras_horario`
        WHERE `ativo` = 1
        AND TIME(:horario) BETWEEN `hora_inicio` AND `hora_fim`
    ");
    $stmt->execute([':horario' => $horario]);
    $regras = $stmt->fetchAll();
    
    foreach ($regras as $regra) {
        if ($regra['tipo_ajuste'] === 'percentual') {
            $preco_final += $preco_base * ($regra['valor_ajuste'] / 100);
        } else {
            $preco_final += $regra['valor_ajuste'];
        }
    }
    
    sendResponse([
        "preco_base" => $preco_base,
        "preco_final" => round($preco_final, 2),
        "regras_aplicadas" => count($regras),
        "detalhes" => [
            "rota" => $rota,
            "regras" => $regras
        ]
    ]);
}

// ==================== RIDES ====================
function handleCreateRide($conn, $input) {
    if (!isset($input['cliente_id'], $input['origem_texto'], $input['destino_texto'])) {
        sendResponse(["error" => "Dados obrigatórios ausentes"], 400);
    }
    
    $id = uniqid('ride_');
    $stmt = $conn->prepare("
        INSERT INTO `corridas` 
        (id, cliente_id, origem_texto, destino_texto, status, created_at)
        VALUES (:id, :cliente_id, :origem_texto, :destino_texto, 'em_analise', NOW())
    ");
    
    $stmt->execute([
        ':id' => $id,
        ':cliente_id' => $input['cliente_id'],
        ':origem_texto' => $input['origem_texto'],
        ':destino_texto' => $input['destino_texto']
    ]);
    
    sendResponse(["success" => true, "id" => $id]);
}

function handleUpdateRide($conn, $input) {
    if (!isset($input['ride_id'])) {
        sendResponse(["error" => "ID da corrida obrigatório"], 400);
    }
    
    $updates = [];
    $params = [':id' => $input['ride_id']];
    
    foreach (['status', 'motorista_id', 'valor', 'observacao_motorista'] as $field) {
        if (isset($input[$field])) {
            $updates[] = "`$field` = :$field";
            $params[":$field"] = $input[$field];
        }
    }
    
    if (empty($updates)) {
        sendResponse(["error" => "Nenhum campo para atualizar"], 400);
    }
    
    $sql = "UPDATE `corridas` SET " . implode(", ", $updates) . " WHERE `id` = :id";
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    
    sendResponse(["success" => true]);
}

function handleListRides($conn, $input) {
    $filtro = $input['filters'] ?? [];
    $sql = "SELECT * FROM `corridas`";
    $params = [];
    
    if (isset($filtro['cliente_id'])) {
        $sql .= " WHERE `cliente_id` = :cliente_id";
        $params[':cliente_id'] = $filtro['cliente_id'];
    } else if (isset($filtro['motorista_id'])) {
        $sql .= " WHERE `motorista_id` = :motorista_id";
        $params[':motorista_id'] = $filtro['motorista_id'];
    }
    
    $sql .= " ORDER BY `created_at` DESC LIMIT 100";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    
    sendResponse($stmt->fetchAll());
}

function handleGetRideById($conn, $input) {
    if (!isset($input['ride_id'])) {
        sendResponse(["error" => "ID da corrida obrigatório"], 400);
    }
    
    $stmt = $conn->prepare("SELECT * FROM `corridas` WHERE `id` = :id");
    $stmt->execute([':id' => $input['ride_id']]);
    $ride = $stmt->fetch();
    
    if (!$ride) {
        sendResponse(["error" => "Corrida não encontrada"], 404);
    }
    
    sendResponse($ride);
}

// ==================== NOTIFICATIONS ====================
function handleSendNotification($conn, $input) {
    if (!isset($input['user_id'], $input['message'])) {
        sendResponse(["error" => "Usuário e mensagem obrigatórios"], 400);
    }
    
    // Aqui você integraria com seu serviço de push notifications
    // Por enquanto, apenas registrar na DB
    
    sendResponse(["success" => true, "message_sent" => true]);
}

// ==================== DRIVERS ====================
function handleAvailableDrivers($conn, $input) {
    $latitude = $input['latitude'] ?? null;
    $longitude = $input['longitude'] ?? null;
    $raio = $input['raio_km'] ?? 5;
    
    if (!$latitude || !$longitude) {
        sendResponse(["error" => "Localização obrigatória"], 400);
    }
    
    // Buscar motoristas com cálculo de distância (simplificado)
    $stmt = $conn->prepare("
        SELECT u.*, lm.latitude, lm.longitude,
               (6371 * acos(cos(radians(:latitude)) * cos(radians(lm.latitude)) 
               * cos(radians(lm.longitude) - radians(:longitude)) 
               + sin(radians(:latitude)) * sin(radians(lm.latitude)))) 
               AS distancia_km
        FROM `users` u
        LEFT JOIN `localizacao_motorista` lm ON u.id = lm.motorista_id
        WHERE u.tipo = 'motorista' AND u.ativo = 1 AND u.status = 'ativo'
        HAVING distancia_km <= :raio
        ORDER BY distancia_km ASC
        LIMIT 20
    ");
    
    $stmt->execute([
        ':latitude' => $latitude,
        ':longitude' => $longitude,
        ':raio' => $raio
    ]);
    
    sendResponse($stmt->fetchAll());
}

function handleUpdateDriverLocation($conn, $input) {
    if (!isset($input['motorista_id'], $input['latitude'], $input['longitude'])) {
        sendResponse(["error" => "ID, latitude e longitude obrigatórios"], 400);
    }
    
    $stmt = $conn->prepare("
        INSERT INTO `localizacao_motorista` (motorista_id, latitude, longitude, atualizado_em)
        VALUES (:motorista_id, :latitude, :longitude, NOW())
        ON DUPLICATE KEY UPDATE
            latitude = VALUES(latitude),
            longitude = VALUES(longitude),
            atualizado_em = NOW()
    ");
    
    $stmt->execute([
        ':motorista_id' => $input['motorista_id'],
        ':latitude' => $input['latitude'],
        ':longitude' => $input['longitude']
    ]);
    
    sendResponse(["success" => true]);
}

// ==================== EVALUATIONS ====================
function handleCreateEvaluation($conn, $input) {
    if (!isset($input['corrida_id'], $input['cliente_id'], $input['motorista_id'], $input['nota'])) {
        sendResponse(["error" => "Dados obrigatórios ausentes"], 400);
    }
    
    $id = uniqid('eval_');
    $stmt = $conn->prepare("
        INSERT INTO `avaliacoes`
        (id, corrida_id, cliente_id, motorista_id, nota, comentario, created_at)
        VALUES (:id, :corrida_id, :cliente_id, :motorista_id, :nota, :comentario, NOW())
    ");
    
    $stmt->execute([
        ':id' => $id,
        ':corrida_id' => $input['corrida_id'],
        ':cliente_id' => $input['cliente_id'],
        ':motorista_id' => $input['motorista_id'],
        ':nota' => $input['nota'],
        ':comentario' => $input['comentario'] ?? null
    ]);
    
    sendResponse(["success" => true, "id" => $id]);
}

function handleGetEvaluationLinks($conn, $input) {
    $filtro = [];
    $sql = "SELECT * FROM `evaluation_links`";
    $params = [];
    
    if (isset($input['motorista_id'])) {
        $sql .= " WHERE `motorista_id` = :motorista_id";
        $params[':motorista_id'] = $input['motorista_id'];
    }
    
    $sql .= " ORDER BY `created_at` DESC";
    
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    
    sendResponse($stmt->fetchAll());
}
