<?php
header("Content-Type: text/plain; charset=utf-8");

$host = "localhost";
$user = "malacaco_rfdrive";
$pass = "rfdrive098765";
$db = "malacaco_rfdrive";

echo "Testing with:\n";
echo "Host: $host\n";
echo "User: $user\n";
echo "DB: $db\n\n";

try {
    $conn = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "SUCCESS! Connected!\n";
    
    $stmt = $conn->query("SELECT DATABASE() as db");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Current DB: " . $result['db'] . "\n";
    
} catch (PDOException $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}