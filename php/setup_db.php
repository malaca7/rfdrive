<?php
// Setup script for Ride-AI database
require_once 'config.php';

try {
    // 1. Create Users Table if not exists
    $conn->query("CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY,
        nome TEXT NOT NULL,
        telefone TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        token VARCHAR(255),
        tipo TEXT NOT NULL DEFAULT 'cliente',
        status TEXT NOT NULL DEFAULT 'ativo',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB");
    echo "Tabela 'users' verificada/criada.<br>";

    // 2. Ensure Corridas table has necessary columns
    $conn->query("CREATE TABLE IF NOT EXISTS corridas (
        id CHAR(36) PRIMARY KEY,
        cliente_id CHAR(36) NOT NULL,
        motorista_id CHAR(36),
        origem_texto TEXT NOT NULL,
        destino_texto TEXT NOT NULL,
        valor DECIMAL(10,2) DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pendente',
        concluida_at TIMESTAMP NULL,
        observacao_motorista TEXT,
        observacoes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB");
    echo "Tabela 'corridas' verificada/atualizada.<br>";

    // Add missing columns if table already existed
    $cols = ['valor' => 'DECIMAL(10,2) DEFAULT 0', 'concluida_at' => 'TIMESTAMP NULL', 'observacao_motorista' => 'TEXT', 'observacoes' => 'TEXT'];
    foreach ($cols as $col => $def) {
        $res = $conn->query("SHOW COLUMNS FROM `corridas` LIKE '$col'");
        if ($res->num_rows == 0) {
            $conn->query("ALTER TABLE corridas ADD COLUMN $col $def");
            echo "Coluna '$col' adicionada em corridas.<br>";
        }
    }

    echo "<br><strong>Configuração do Ride-AI concluída!</strong>";

} catch (Exception $e) {
    die("Erro: " . $e->getMessage());
}
?>
