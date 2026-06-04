<?php
require_once 'config.php';
$result = $conn->query("SELECT nome_plataforma, logo_url, cor_primaria FROM config_plataforma LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
    echo json_encode($row);
} else {
    echo json_encode(["error" => "No config found"]);
}
$conn->close();
?>
