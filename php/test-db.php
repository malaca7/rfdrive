<?php
$conn = new mysqli('localhost', 'root', '', 'malacaco_rfdrive');
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
echo "Connected successfully!";

$res = $conn->query("SELECT COUNT(*) as cnt FROM corridas");
if ($res) {
    $row = $res->fetch_assoc();
    echo " Total viagens: " . $row['cnt'];
} else {
    echo " Query error: " . $conn->error;
}

$res = $conn->query("SELECT COUNT(*) as cnt FROM users");
if ($res) {
    $row = $res->fetch_assoc();
    echo " Total usuarios: " . $row['cnt'];
}

$conn->close();