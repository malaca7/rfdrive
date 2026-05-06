<?php
require_once 'config.php';

/**
 * API Principal para operações de Banco de Dados
 * Usando mysqli ao invés de PDO
 */

// Processar requisição
$rawInput = file_get_contents('php://input');
if (empty($rawInput)) {
    $rawInput = file_get_contents('php://stdin');
}
$input = json_decode($rawInput, true);
if (!$input || !isset($input['action']) || !isset($input['table'])) {
    sendResponse(["error" => "Dados inválidos", "debug" => $rawInput], 400);
}

try {
    $action = $input['action'];
    $table = preg_replace('/[^a-zA-Z0-9_]/', '', $input['table']);

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
            sendResponse(["error" => "Ação não suportada"], 400);
    }
} catch (Exception $e) {
    sendResponse(["error" => "Exceção no servidor: " . $e->getMessage()], 500);
} catch (Error $e) {
    sendResponse(["error" => "Erro fatal no servidor: " . $e->getMessage()], 500);
}

$conn->close();

function handleFunction($conn, $input) {
    $name = $input['name'];
    $body = $input['body'] ?? [];

    // Funções especiais implementadas manualmente
    if ($name === 'reset-password') {
        $userId = $body['userId'];
        $newPassword = $body['newPassword'];

        $stmt = $conn->prepare("UPDATE `users` SET `senha` = ? WHERE `id` = ?");
        $stmt->bind_param("ss", $newPassword, $userId);
        $stmt->execute();

        sendResponse(["success" => true]);
    } 
    //mark_expired_eval_links
    elseif ($name === 'mark_expired_eval_links') {
        $stmt = $conn->prepare("UPDATE evaluation_links SET status = 'expirada', updated_at = NOW() WHERE status = 'ativa' AND expira_em < NOW()");
        $stmt->execute();
        sendResponse(["success" => true, "affected" => $stmt->affected_rows]);
    }
    else {
        sendResponse(["error" => "Função '$name' não implementada"], 404);
    }
}

function handleUpsert($conn, $table, $input) {
    if (!isset($input['data'])) sendResponse(["error" => "Dados ausentes"], 400);
    $rows = is_array($input['data']) && isset($input['data'][0]) ? $input['data'] : [$input['data']];
    foreach ($rows as $data) {
        // Gerar UUID se não fornecido
        if (!isset($data['id'])) {
            $data['id'] = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000,
                mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
            );
        }

        foreach ($data as $key => &$val) {
            if (is_array($val) || is_object($val)) $val = json_encode($val, JSON_UNESCAPED_UNICODE);
            elseif (is_bool($val)) $val = $val ? 1 : 0;
        }
        $columns = array_keys($data);
        $placeholders = array_map(function($col) { return "?"; }, $columns);
        $updates = array_map(function($col) { return "`$col` = VALUES(`$col`)"; }, $columns);
        $sql = "INSERT INTO `$table` (`" . implode("`, `", $columns) . "`) VALUES (" . implode(", ", $placeholders) . ") ON DUPLICATE KEY UPDATE " . implode(", ", $updates);
        $stmt = $conn->prepare($sql);
        $types = str_repeat("s", count($data));
        $values = array_values($data);
        $stmt->bind_param($types, ...$values);
        $stmt->execute();
    }
    sendResponse(["success" => true]);
}

function buildWhereClause($filters) {
    $where = [];
    $params = [];
    $types = "";

    if (isset($filters) && is_array($filters)) {
        foreach ($filters as $col => $val) {
            $pureCol = preg_replace('/[^a-zA-Z0-9_]/', '', str_replace(['_gte', '_lte', '_ne', '_in'], '', $col));

            if ($pureCol === 'telefone') {
                $valDigits = preg_replace('/\D/', '', $val);
                $where[] = "(REPLACE(REPLACE(REPLACE(REPLACE(`$pureCol`, '(', ''), ')', ''), '-', ''), ' ', '') = ? OR `$pureCol` = ?)";
                $params[] = $valDigits;
                $params[] = $val;
                $types .= "ss";
            } else if (strpos($col, '_gte') !== false) {
                $where[] = "`$pureCol` >= ?";
                $params[] = $val;
                $types .= "s";
            } else if (strpos($col, '_lte') !== false) {
                $where[] = "`$pureCol` <= ?";
                $params[] = $val;
                $types .= "s";
            } else if (strpos($col, '_ne') !== false) {
                $where[] = "`$pureCol` != ?";
                $params[] = $val;
                $types .= "s";
            } else if (strpos($col, '_in') !== false) {
                if (is_array($val) && !empty($val)) {
                    $placeholders = array_map(function() { return "?"; }, $val);
                    $where[] = "`$pureCol` IN (" . implode(", ", $placeholders) . ")";
                    $params = array_merge($params, $val);
                    $types .= str_repeat("s", count($val));
                }
            } else {
                $where[] = "`$pureCol` = ?";
                $params[] = $val;
                $types .= "s";
            }
        }
    }

    return [$where, $params, $types];
}

function handleSelect($conn, $table, $input) {
    $sql = "SELECT * FROM `$table`";
    list($where, $params, $types) = buildWhereClause($input['filters'] ?? []);

    if (!empty($where)) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }

    if (isset($input['order'])) {
        $col = preg_replace('/[^a-zA-Z0-9_]/', '', $input['order']['column']);
        $dir = strtoupper($input['order']['direction']) === 'DESC' ? 'DESC' : 'ASC';
        $sql .= " ORDER BY `$col` $dir";
    }

    if (isset($input['limit'])) {
        $sql .= " LIMIT " . intval($input['limit']);
    }

    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = $result->fetch_all(MYSQLI_ASSOC);
    sendResponse($rows);
}

function handleInsert($conn, $table, $input) {
    if (!isset($input['data'])) sendResponse(["error" => "Dados ausentes"], 400);

    $data = $input['data'];
    
    // Gerar UUID se não fornecido e se a tabela espera um ID string (maioria no sistema)
    if (!isset($data['id'])) {
        $data['id'] = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    foreach ($data as $key => &$val) {
        if (is_array($val) || is_object($val)) $val = json_encode($val, JSON_UNESCAPED_UNICODE);
        elseif (is_bool($val)) $val = $val ? 1 : 0;
    }

    $columns = array_keys($data);
    $placeholders = array_map(function($col) { return "?"; }, $columns);

    $sql = "INSERT INTO `$table` (`" . implode("`, `", $columns) . "`) VALUES (" . implode(", ", $placeholders) . ")";

    $stmt = $conn->prepare($sql);
    if (!$stmt) sendResponse(["error" => "Erro ao preparar SQL: " . $conn->error], 500);

    $types = str_repeat("s", count($data));
    $values = array_values($data);
    $stmt->bind_param($types, ...$values);
    
    if (!$stmt->execute()) {
        sendResponse(["error" => "Erro ao executar SQL: " . $stmt->error], 500);
    }
    
    sendResponse(["success" => true, "id" => $data['id']]);
}

function handleUpdate($conn, $table, $input) {
    if (!isset($input['data']) || !isset($input['filters'])) sendResponse(["error" => "Dados ou filtros ausentes"], 400);

    $data = $input['data'];
    foreach ($data as $key => &$val) {
        if (is_array($val) || is_object($val)) $val = json_encode($val, JSON_UNESCAPED_UNICODE);
        elseif (is_bool($val)) $val = $val ? 1 : 0;
    }

    $sets = [];
    $setValues = [];
    $setTypes = "";
    foreach ($data as $col => $val) {
        $col = preg_replace('/[^a-zA-Z0-9_]/', '', $col);
        $sets[] = "`$col` = ?";
        $setValues[] = $val;
        $setTypes .= "s";
    }

    list($where, $whereValues, $whereTypes) = buildWhereClause($input['filters']);

    if (empty($where)) sendResponse(["error" => "Filtros de update vazios"], 400);

    $sql = "UPDATE `$table` SET " . implode(", ", $sets) . " WHERE " . implode(" AND ", $where);

    $stmt = $conn->prepare($sql);
    $allValues = array_merge($setValues, $whereValues);
    $allTypes = $setTypes . $whereTypes;
    $stmt->bind_param($allTypes, ...$allValues);
    if (!$stmt->execute()) {
        sendResponse(["error" => "Erro ao atualizar registro: " . $stmt->error], 500);
    }

    sendResponse(["success" => true, "affected" => $stmt->affected_rows]);
}

function handleDelete($conn, $table, $input) {
    if (!isset($input['filters'])) sendResponse(["error" => "Filtros ausentes"], 400);

    list($where, $params, $types) = buildWhereClause($input['filters']);
    
    if (empty($where)) sendResponse(["error" => "Filtros de delete vazios"], 400);

    $sql = "DELETE FROM `$table` WHERE " . implode(" AND ", $where);
    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    if (!$stmt->execute()) {
        sendResponse(["error" => "Erro ao excluir registro: " . $stmt->error], 500);
    }

    sendResponse(["success" => true, "affected" => $stmt->affected_rows]);
}