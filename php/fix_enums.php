<?php
require_once 'config.php';

try {
    echo "Atualizando enums de status...\n";
    
    // Corridas status
    $sql1 = "ALTER TABLE `corridas` MODIFY COLUMN `status` ENUM('em_analise', 'aprovada', 'nao_realizada', 'em_progresso', 'concluida', 'cancelada', 'sem_atendimento') DEFAULT 'em_analise'";
    if ($conn->query($sql1)) {
        echo "Tabela 'corridas' atualizada com sucesso.\n";
    } else {
        echo "Erro ao atualizar 'corridas': " . $conn->error . "\n";
    }
    
    // Aprovacoes status
    $sql2 = "ALTER TABLE `aprovacoes` MODIFY COLUMN `status_admin` ENUM('aprovada', 'nao_realizada', 'recusada', 'sem_atendimento') DEFAULT 'aprovada'";
    if ($conn->query($sql2)) {
        echo "Tabela 'aprovacoes' atualizada com sucesso.\n";
    } else {
        echo "Erro ao atualizar 'aprovacoes': " . $conn->error . "\n";
    }
    
    echo "Operação concluída.\n";
} catch (Exception $e) {
    echo "Exceção: " . $e->getMessage() . "\n";
}

$conn->close();
?>
