<?php
// Extrae lugares únicos das rotas e inserta na tabela localidades
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'config.php';

echo "=== Extración de Lugares das Rutas ===\n";

$rotas = [
  ["origem" => "Águia American Club Br-101", "destino" => "T.I Centro do Cabo", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Praça Theo Silva Centro do Cabo", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Rua São João Centro do Cabo", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Hospital Mendo Sampaio (Mista)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Clínica Amor & Saúde", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Hospital Infantil Centro do Cabo", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Hospital InfantoJuvenil Centro do Cabo", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Câmara dos Vereadores do Centro do Cabo", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Mauriti", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Torrinha Baixa", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Torrinha Alta", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Malaquias Baixo (inclui R. 5,9)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Malaquias Alto Área da IEADPE", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Malaquias Alto (R. 4,7,10...)", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Terminal de Ônibus da Cohab", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Posto de Saúde na Cohab", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "UPA24h na Cohab", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Rua do Açude Cohab", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Rua Cristo Rei Cohab", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Bairro São Francisco PRAÇA", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Bairro São Francisco Alto dos Mirandas", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Bairro São Francisco Caixa D'água", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Bairro São Francisco Rua do Bicudo", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Bairro São Francisco Rua 53", "valor" => 25.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Bairro São Francisco Rua da Aurora", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Bela Vista Alta", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Bela Vista Baixa", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Cruzeiro", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Toca", "valor" => 25.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Rua 25 da Bela Vista", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Charnequinha Baixa", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Charnequinha Alta", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Charnequinha (Área da quadra e arredores)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Charnequinha (R. 2 após área da quadra)", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Sapucaia", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Destilaria", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Comunidade da Destilaria", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Clube da Destilaria", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Vila Social", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Rua do Dique (Vila Social)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Motel Intense Prime", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Condomínio em frente ao Intense", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "SAFPE PE-60", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "ATACADÃO PE-60", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "ASSAÍ PE-60", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "AD Seara PE-60", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Igreja do Amor PE-60", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Universal PE-60", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Santo Inácio", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Pentecostal Filhos de Sião Santo Inácio", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Vila Roca", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Vila Roca Armazém Cusino", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Vila Claudete Antiga", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Casinhas 1ª Etapa (Até Marcelino Reboque)", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Casinhas 1ª Etapa (Direita após SENAI)", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Casinhas 2ª Etapa", "valor" => 29.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Garapú 1 (1º Modelo Até Nova Era)", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Garapú Espaço Cidadania", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Garapú 2 (Nova Era Até 2º Modelo)", "valor" => 29.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Garapú Campo de Aranha", "valor" => 29.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Garapú 3 (2º Modelo Até Flamenguinho)", "valor" => 32.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Garapú 3 Após Flamenguinho", "valor" => 34.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Garapú Em frente ao Shopping", "valor" => 34.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Lote Garapú 2 (Lote Dona Amara)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Garapú VILA DA CONEST", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Comunidade Madri Iva (Subida do Shopping)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Rosário", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "SEST-SENAT (Rosário)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Agodoais Sentido Ipojuca", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Agodoais Sentido Praia", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Serraria", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Serraria Pista", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Fábrica Tephane (Centro)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Fábrica PepsiCo", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Fábrica Ball (antiga REXAM)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Fábrica Camil (Próx. a SOLAR)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Fábrica Urbano (Próx. a PepsiCo)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Fábrica Amcor (Próx. a PepsiCo)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Fábrica Coca-Cola Solar Suape", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Massangana", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Pista Preta (Vila Harmínio)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Pista Preta (Alto Macaíba)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Burrama/Lote 7/Quilombola", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Engenho Novo Até a STATUS", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Engenho Novo Até o Posto", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Engenho Novo Até a SETRE", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Engenho Novo RECANTO DO PARAÍSO", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Águia American Club Br-101", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Charneca Parte Baixa", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Charneca Parte Alta", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Charneca Corgo", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Charneca Cajueiro", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Novo Horizonte (Principais)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Novo Horizonte (Difícil Acesso)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Alto dos Funcionários", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Fazenda Casa Branca - Pirapama", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Pirapama Parte Baixa", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Pirapama Rua da Barragem", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Pirapama Parte Alta", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Pirapama CIDA PARK", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Pirapama Mangueirinha", "valor" => 34.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Pirapama TURURU", "valor" => 34.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Barbalho 1 e 2", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Barbalho em frente a lagoa", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Empresa Bauminas Estrada de Pirapama", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Empresa CONEGE Estrada de Pirapama (Antiga Uninassau)", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Granja Pajeú", "valor" => 29.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Castelo Recepções", "valor" => 29.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "SESI Cabo", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Vila do SESI", "valor" => 24.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Rosa do Vento/Chácara SHEKINÁ", "valor" => 26.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "CONE antes do Armazém", "valor" => 29.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Hospital Dom Hélder Câmara", "valor" => 29.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Armazém em frente ao Dom Hélder", "valor" => 29.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Loginvest (TUPAN) BR-101", "valor" => 39.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Americanas BR-101", "valor" => 39.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "AMAZON BR-101", "valor" => 39.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "FortLev Ponte dos Carvalhos", "valor" => 39.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "CONE Ponte dos Carvalhos", "valor" => 39.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Ponte dos Carvalhos", "valor" => 39.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Ponte dos Carvalhos Vila Nova por trás da FortLev", "valor" => 44.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Ponte dos Carvalhos Terminal de ônibus Nova Era", "valor" => 44.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Ponte dos Carvalhos Praça Marcos Freire", "valor" => 39.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Ponte dos Carvalhos Cemitério", "valor" => 44.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Ponte dos Carvalhos Alto do Sol", "valor" => 44.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Ponte dos Carvalhos Santo Estevão", "valor" => 39.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Ponte dos Carvalhos Maternidade", "valor" => 39.99, "regiao" => "Cabo"],
  ["origem" => "Águia American Club Br-101", "destino" => "Pontezinha", "valor" => 44.99, "regiao" => "Cabo"],
];

try {
    require_once 'config.php';
    echo "Conexión: OK\n";
    
    // Extraer lugarse únicos
    $lugares = [];
    foreach ($rotas as $rota) {
        $lugares[$rota["origem"]] = "origem";
        $lugares[$rota["destino"]] = "destino";
    }
    echo "Lugares atopados: " . count($lugares) . "\n";
    
    // Limpar e inserir na tabela localidades
    $conn->query("DELETE FROM localidades");
    echo "Lugares anteriores eliminados.\n";
    
    $stmt = $conn->prepare("INSERT INTO localidades (nome, tipo, ativo) VALUES (?, ?, 1)");
    
    $inseridos = 0;
    foreach ($lugares as $nome => $tipo) {
        $stmt->bind_param("ss", $nome, $tipo);
        $stmt->execute();
        $inseridos++;
    }
    
    echo "Total de lugares insertados: $inseridos\n";
    echo "Lugares actualizados con éxito!\n";
    
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage() . "\n";
}