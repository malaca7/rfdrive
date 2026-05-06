<?php
// Cria regiões baseadas nos lugares e associa regiões aos lugares
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'config.php';

function generateUuid() {
    return sprintf('%08x-%04x-%04x-%04x-%012x', mt_rand(), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff) | 0x4000, mt_rand());
}

echo "===Criação de Regiões e Associação===\n\n";

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die("Erro na conexão: " . $conn->connect_error . "\n");
}

$conn->query("SET NAMES 'utf8mb4'");
$conn->query("SET FOREIGN_KEY_CHECKS = 0");

echo "Conexão estabelecida\n";

// Verificar estrutura atual da tabela localidades
$result = $conn->query("DESCRIBE localidades");
$hasRegiao = false;
while ($row = $result->fetch_assoc()) {
    if ($row['Field'] === 'regiao_id') {
        $hasRegiao = true;
        break;
    }
}

if (!$hasRegiao) {
    echo "Adicionando coluna regiao_id...\n";
    $conn->query("ALTER TABLE localidades ADD COLUMN regiao_id VARCHAR(36) DEFAULT NULL");
    $conn->query("ALTER TABLE localidades ADD INDEX idx_regiao (regiao_id)");
    $conn->query("ALTER TABLE localidades ADD FOREIGN KEY (regiao_id) REFERENCES regioes_precos(id)");
    echo "   Coluna adicionada\n";
}

// Verificar se regioes_precos tem estrutura adequada
$result = $conn->query("DESCRIBE regioes_precos");
$hasDescricao = false;
while ($row = $result->fetch_assoc()) {
    if ($row['Field'] === 'descricao') {
        $hasDescricao = true;
        break;
    }
}

if (!$hasDescricao) {
    echo "Adicionando coluna descricao...\n";
    $conn->query("ALTER TABLE regioes_precos ADD COLUMN descricao TEXT DEFAULT NULL");
}

// Definir regiões baseadas nos padrões dos lugares
$regioes = [
    'Cabo' => [
        'descricao' => 'Cabo de Santo Agostinho - Área principal',
        'padroes' => ['Centro do Cabo', 'Cohab', 'São Francisco', 'Bela Vista', 'Charnequinha', 'Garapú', 'Pirapama', 'Ponte dos Carvalhos', 'Xaréu', 'Gaibú', 'Suape', 'Mercês', 'Ipojuca', 'Águia']
    ],
    'Zona Urbana' => [
        'descricao' => 'Zona urbana do Cabo',
        'padroes' => ['T.I Centro', 'Praça Theo', 'Rua São', 'Hospital', 'Clínica', 'UPA', 'Terminal', 'Posto de Saúde']
    ],
    'ZPAM' => [
        'descricao' => 'Zona Portuária e Área Industrial',
        'padroes' => ['SUAPE', 'Porto de Suape', 'Industrial', 'Portuária']
    ],
    'Sul' => [
        'descricao' => 'Região Sul - Praias',
        'padroes' => ['Praia de', 'Maracaípe', 'Porto de Galinhas', 'Serrambi', 'Tamandaré', 'Barreiros']
    ]
];

echo "\n1. Inserindo regiões...\n";

// Primeiro, limpar regiões existentes
$conn->query("TRUNCATE TABLE regioes_precos");

$regioesIds = [];
$stmt = $conn->prepare("INSERT INTO regioes_precos (id, nome, descricao, ativo) VALUES (?, ?, ?, 1)");

foreach ($regioes as $nome => $dados) {
    $id = generateUuid();
    $regioesIds[$nome] = $id;
    $descricao = $dados['descricao'];
    
    $stmt->bind_param("sss", $id, $nome, $descricao);
    $stmt->execute();
    echo "   - $nome: $descricao\n";
}

echo "\n2. Associando lugares às regiões...\n";

// Pegar todos os lugares
$result = $conn->query("SELECT id, nome FROM localidades");
$lugares = [];
while ($row = $result->fetch_assoc()) {
    $lugares[$row['id']] = $row['nome'];
}

$stmt = $conn->prepare("UPDATE localidades SET regiao_id = ? WHERE id = ?");

$associados = 0;
foreach ($lugares as $id => $nome) {
    $nomeLower = mb_strtolower($nome);
    $regiaoId = null;
    $regiaoNome = 'Cabo'; // padrão
    
    foreach ($regioes as $nomeRegiao => $dados) {
        foreach ($dados['padroes'] as $padrao) {
            if (mb_stripos($nomeLower, mb_strtolower($padrao)) !== false) {
                $regiaoId = $regioesIds[$nomeRegiao];
                $regiaoNome = $nomeRegiao;
                break 2;
            }
        }
    }
    
    if ($regiaoId) {
        $stmt->bind_param("ss", $regiaoId, $id);
        $stmt->execute();
        $associados++;
    }
}

echo "   Lugares associados: $associados\n";

// Mostrar estatísticas por região
echo "\n3. Estatísticas por região:\n";
$result = $conn->query("
    SELECT r.nome, COUNT(l.id) as total 
    FROM regioes_precos r 
    LEFT JOIN localidades l ON l.regiao_id = r.id 
    GROUP BY r.id 
    ORDER BY total DESC
");

while ($row = $result->fetch_assoc()) {
    echo "   - {$row['nome']}: {$row['total']} lugares\n";
}

$conn->query("SET FOREIGN_KEY_CHECKS = 1");

echo "\n===Concluído!===\n";