<?php
require_once 'config.php';

/**
 * API Principal para operações de Banco de Dados
 * Aceita requisições POST com JSON contendo:
 * {
 *   "table": "nome_da_tabela",
 *   "action": "select|insert|update|delete",
 *   "data": { ... },
 *   "filters": { "coluna": "valor" }
 * }
 */

$input = json_decode(file_get_contents("php://input"), true);

if (!$input || !isset($input['table']) || !isset($input['action'])) {
    sendResponse(["error" => "Requisição inválida"], 400);
}

$table = preg_replace('/[^a-zA-Z0-9_]/', '', $input['table']);
$action = $input['action'];

switch ($action) {
    case 'select':
        handleSelect($conn, $table, $input);
        break;
    case 'insert':
        handleInsert($conn, $table, $input);
        break;
    case 'update':
        handleUpdate($conn, $table, $input);
        break;
    case 'delete':
        handleDelete($conn, $table, $input);
        break;
    case 'upsert':
        handleUpsert($conn, $table, $input);
        break;
    case 'function':
        handleFunction($conn, $input);
        break;
    default:
        sendResponse(["error" => "Ação desconhecida"], 400);
}

function handleFunction($conn, $input) {
    $name = $input['name'];
    $body = $input['body'];

    if ($name === 'reset-password') {
        $userId = $body['userId'];
        $newPassword = $body['newPassword'];
        
        $stmt = $conn->prepare("UPDATE `users` SET `senha` = :pass WHERE `id` = :id");
        $stmt->execute([':pass' => $newPassword, ':id' => $userId]);
        
        sendResponse(["success" => true]);
    } else {
        sendResponse(["error" => "Função '$name' não implementada"], 404);
    }
}

function handleUpsert($conn, $table, $input) {
    if (!isset($input['data'])) sendResponse(["error" => "Dados ausentes"], 400);
    $rows = is_array($input['data']) && isset($input['data'][0]) ? $input['data'] : [$input['data']];
    foreach ($rows as $data) {
        $columns = array_keys($data);
        $placeholders = array_map(function($col) { return ":$col"; }, $columns);
        $updates = array_map(function($col) { return "`$col` = VALUES(`$col`)"; }, $columns);
        $sql = "INSERT INTO `$table` (`" . implode("`, `", $columns) . "`) VALUES (" . implode(", ", $placeholders) . ") ON DUPLICATE KEY UPDATE " . implode(", ", $updates);
        $stmt = $conn->prepare($sql);
        foreach ($data as $col => $val) { $stmt->bindValue(":$col", $val); }
        $stmt->execute();
    }
    sendResponse(["success" => true]);
}

function handleSelect($conn, $table, $input) {
    $sql = "SELECT * FROM `$table`";
    $params = [];
    $where = [];
    
    if (isset($input['filters']) && is_array($input['filters'])) {
        foreach ($input['filters'] as $col => $val) {
            $pureCol = preg_replace('/[^a-zA-Z0-9_]/', '', str_replace('_gte', '', $col));
            
            // Especial para telefone: tenta busca flexível
            if ($pureCol === 'telefone') {
                $valDigits = preg_replace('/\D/', '', $val);
                $where[] = "(REPLACE(REPLACE(REPLACE(REPLACE(`$pureCol`, '(', ''), ')', ''), '-', ''), ' ', '') = :$pureCol OR `$pureCol` = :{$pureCol}_orig)";
                $params[":$pureCol"] = $valDigits;
                $params[":{$pureCol}_orig"] = $val;
            } else if (strpos($col, '_gte') !== false) {
                $where[] = "`$pureCol` >= :$pureCol";
                $params[":$pureCol"] = $val;
            } else {
                $where[] = "`$pureCol` = :$pureCol";
                $params[":$pureCol"] = $val;
            }
        }
    }
    
    if (!empty($where)) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }

    // Log para depuração (opcional, pode remover depois)
    // file_put_contents("debug.log", date('Y-m-d H:i:s') . " SQL: $sql | Params: " . json_encode($params) . "\n", FILE_APPEND);

    if (isset($input['order'])) {
        $col = preg_replace('/[^a-zA-Z0-9_]/', '', $input['order']['column']);
        $dir = strtoupper($input['order']['direction']) === 'DESC' ? 'DESC' : 'ASC';
        $sql .= " ORDER BY `$col` $dir";
    }

    if (isset($input['limit'])) {
        $sql .= " LIMIT " . intval($input['limit']);
    }

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    sendResponse($stmt->fetchAll());
}

function handleInsert($conn, $table, $input) {
    if (!isset($input['data'])) sendResponse(["error" => "Dados ausentes"], 400);
    
    $columns = array_keys($input['data']);
    $placeholders = array_map(function($col) { return ":$col"; }, $columns);
    
    $sql = "INSERT INTO `$table` (`" . implode("`, `", $columns) . "`) VALUES (" . implode(", ", $placeholders) . ")";
    
    $stmt = $conn->prepare($sql);
    foreach ($input['data'] as $col => $val) {
        $stmt->bindValue(":$col", $val);
    }
    
    $stmt->execute();
    sendResponse(["success" => true, "id" => $conn->lastInsertId()]);
}

function handleUpdate($conn, $table, $input) {
    if (!isset($input['data']) || !isset($input['filters'])) sendResponse(["error" => "Dados ou filtros ausentes"], 400);
    
    $sets = [];
    foreach ($input['data'] as $col => $val) {
        $col = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
        $sets[] = "`$col` = :data_$col";
    }
    
    $where = [];
    foreach ($input['filters'] as $col => $val) {
        $col = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
        $where[] = "`$col` = :filter_$col";
    }
    
    $sql = "UPDATE `$table` SET " . implode(", ", $sets) . " WHERE " . implode(" AND ", $where);
    
    $stmt = $conn->prepare($sql);
    foreach ($input['data'] as $col => $val) {
        $stmt->bindValue(":data_$col", $val);
    }
    foreach ($input['filters'] as $col => $val) {
        $stmt->bindValue(":filter_$col", $val);
    }
    
    $stmt->execute();
    sendResponse(["success" => true]);
}

function handleDelete($conn, $table, $input) {
    if (!isset($input['filters'])) sendResponse(["error" => "Filtros ausentes"], 400);
    
    $where = [];
    foreach ($input['filters'] as $col => $val) {
        $col = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
        $where[] = "`$col` = :$col";
    }
    
    $sql = "DELETE FROM `$table` WHERE " . implode(" AND ", $where);
    
    $stmt = $conn->prepare($sql);
    foreach ($input['filters'] as $col => $val) {
        $stmt->bindValue(":$col", $val);
    }
    
    $stmt->execute();
    sendResponse(["success" => true]);
}
