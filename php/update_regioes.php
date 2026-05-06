<?php
// Script para atualizar regiões e lugares na tabela localidades
// Execute: php php/update_regioes.php

error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'config.php';

echo "=== Atualização de Regiões ===\n";

// Lista de regiões/lugares para o autocomplete
$regioes = [
    ["nome" => "Águia American Club Br-101", "tipo" => "origem"],
    ["nome" => "T.I Centro do Cabo", "tipo" => "bairro"],
    ["nome" => "Centro do Cabo", "tipo" => "bairro"],
    ["nome" => "Cohab", "tipo" => "bairro"],
    ["nome" => "São Francisco", "tipo" => "bairro"],
    ["nome" => "Bela Vista", "tipo" => "bairro"],
    ["nome" => "Charnequinha", "tipo" => "bairro"],
    ["nome" => "Garapú", "tipo" => "bairro"],
    ["nome" => "Ponte dos Carvalhos", "tipo" => "bairro"],
    ["nome" => "Pirapama", "tipo" => "bairro"],
    ["nome" => "Massangana", "tipo" => "bairro"],
    ["nome" => "Rosário", "tipo" => "bairro"],
    ["nome" => "Charneca", "tipo" => "bairro"],
    ["nome" => "Novo Horizonte", "tipo" => "bairro"],
    ["nome" => "Malaquias", "tipo" => "bairro"],
    ["nome" => "Pista Preta", "tipo" => "bairro"],
    ["nome" => "Engenho Novo", "tipo" => "bairro"],
    ["nome" => "Barbalho", "tipo" => "bairro"],
    ["nome" => "Destilaria", "tipo" => "bairro"],
    ["nome" => "Santo Inácio", "tipo" => "bairro"],
    ["nome" => "Vila Roca", "tipo" => "bairro"],
    ["nome" => "Casinhas", "tipo" => "bairro"],
    ["nome" => "Serraria", "tipo" => "bairro"],
    ["nome" => "Mauriti", "tipo" => "bairro"],
    ["nome" => "Torrinha", "tipo" => "bairro"],
    ["nome" => "Vila Social", "tipo" => "bairro"],
    ["nome" => "PE-60", "tipo" => "area"],
    ["nome" => "BR-101", "tipo" => "area"],
    // Destinos das rotas
    ["nome" => "Praça Theo Silva Centro do Cabo", "tipo" => "local"],
    ["nome" => "Rua São João Centro do Cabo", "tipo" => "local"],
    ["nome" => "Hospital Mendo Sampaio", "tipo" => "local"],
    ["nome" => "Clínica Amor & Saúde", "tipo" => "local"],
    ["nome" => "Hospital Infantil Centro do Cabo", "tipo" => "local"],
    ["nome" => "UPA24h na Cohab", "tipo" => "local"],
    ["nome" => "Terminal de Ônibus da Cohab", "tipo" => "local"],
    ["nome" => "Hospital Dom Hélder Câmara", "tipo" => "local"],
    ["nome" => "Loginvest TUPAN", "tipo" => "local"],
    ["nome" => "Americanas BR-101", "tipo" => "local"],
    ["nome" => "FortLev", "tipo" => "local"],
    ["nome" => "Pontezinha", "tipo" => "local"],
    ["nome" => "SESI Cabo", "tipo" => "local"],
    ["nome" => "Motel Intense Prime", "tipo" => "local"],
    ["nome" => "ASSAÍ PE-60", "tipo" => "local"],
    ["nome" => "ATACADÃO PE-60", "tipo" => "local"],
    ["nome" => "AD Seara PE-60", "tipo" => "local"],
    ["nome" => "Granja Pajeú", "tipo" => "local"],
    ["nome" => "Castelo Recepções", "tipo" => "local"],
    ["nome" => "Sapucaia", "tipo" => "bairro"],
    ["nome" => "Cruzeiro", "tipo" => "bairro"],
    ["nome" => "Toca", "tipo" => "bairro"],
    ["nome" => "Alto dos Funcionários", "tipo" => "bairro"],
    ["nome" => "Rosa do Vento", "tipo" => "bairro"],
    ["nome" => "SEST-SENAT", "tipo" => "local"],
    ["nome" => "Fábrica Tephane", "tipo" => "local"],
    ["nome" => "Fábrica PepsiCo", "tipo" => "local"],
    ["nome" => "Fábrica Ball", "tipo" => "local"],
    ["nome" => "Fábrica Camil", "tipo" => "local"],
    ["nome" => "Fábrica Coca-Cola", "tipo" => "local"],
    ["nome" => "Burrama", "tipo" => "bairro"],
    ["nome" => "Engenho Novo", "tipo" => "bairro"],
    ["nome" => "Santo Estevão", "tipo" => "bairro"],
    ["nome" => "Maternidade", "tipo" => "local"],
    ["nome" => "Cemitério", "tipo" => "local"],
    ["nome" => "Praça Marcos Freire", "tipo" => "local"],
];

try {
    echo "Conexão: OK\n";
    
    // Limpar todas as localidades existentes
    $conn->query("DELETE FROM localidades");
    echo "Locais anteriores removidos.\n";
    
    // Inserir novas localidades (sem a columna 'regiao')
    $stmt = $conn->prepare("INSERT INTO localidades (nome, tipo, ativo) VALUES (?, ?, 1)");
    
    $inseridos = 0;
    foreach ($regioes as $loc) {
        $stmt->bind_param("ss", $loc["nome"], $loc["tipo"]);
        $stmt->execute();
        $inseridos++;
    }
    
    echo "Total de lugares inseridos: $inseridos\n";
    echo "Locais actualizados con éxito!\n";
    
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}