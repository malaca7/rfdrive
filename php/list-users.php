<?php
require_once 'config.php';
$r = $conn->query('SELECT id, nome, telefone, tipo FROM users LIMIT 10');
while ($u = $r->fetch_assoc()) {
    echo $u['telefone'] . ' | ' . $u['nome'] . ' | ' . $u['tipo'] . "\n";
}