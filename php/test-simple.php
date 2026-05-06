<?php
// Simpler test - plain text output
echo "PHP Working! Timestamp: " . time();
echo "\nDB Host: localhost";
echo "\nDB Name: malacaco_rfdrive";

// Try connection
try {
    $conn = new PDO("mysql:host=localhost;dbname=malacaco_rfdrive;charset=utf8mb4", "root", "");
    echo "\nConnection: SUCCESS";
} catch(PDOException $e) {
    echo "\nConnection FAILED: " . $e->getMessage();
}