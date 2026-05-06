<?php
// Cria mais regiões baseadas nos lugares e associa todas
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'config.php';

function generateUuid() {
    return sprintf('%08x-%04x-%04x-%04x-%012x', mt_rand(), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff) | 0x4000, mt_rand());
}

echo "===Criação Avançada de Regiões===\n\n";

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die("Erro na conexão: " . $conn->connect_error . "\n");
}

$conn->query("SET NAMES 'utf8mb4'");
$conn->query("SET FOREIGN_KEY_CHECKS = 0");

// Verificar lugares existentes
$result = $conn->query("SELECT nome FROM localidades ORDER BY nome");
$lugares = [];
while ($row = $result->fetch_assoc()) {
    $lugares[] = mb_strtolower($row['nome']);
}

echo "Total de lugares no banco: " . count($lugares) . "\n\n";

// Definir regiões detalhadas baseadas nos padrões
$regioes = [
    'Cabo Centro' => [
        'descricao' => 'Centro do Cabo de Santo Agostinho',
        'padroes' => ['centro do cabo', 't.i centro', 'praça theo', 'rua são joão', 'hospital mendo', 'clínica amor', 'hospital infantil', 'hospital infanto', 'câmara', 'mauriti']
    ],
    'Cohab' => [
        'descricao' => 'Conjunto Habitacional',
        'padroes' => ['cohab', 'terminal de ônibus', 'posto de saúde', 'upa24h', 'rua do açude', 'rua cristo']
    ],
    'São Francisco' => [
        'descricao' => 'Bairro São Francisco',
        'padroes' => ['são francisco']
    ],
    'Bela Vista' => [
        'descricao' => 'Bairro Bela Vista',
        'padroes' => ['bela vista']
    ],
    'Charnequinha' => [
        'descricao' => 'Charnequinha',
        'padroes' => ['charnequinha']
    ],
    'Garapú' => [
        'descricao' => 'Garapú',
        'padroes' => ['garapú']
    ],
    'Pirapama' => [
        'descricao' => 'Pirapama',
        'padroes' => ['pirapama']
    ],
    'Ponte dos Carvalhos' => [
        'descricao' => 'Ponte dos Carvalhos',
        'padroes' => ['ponte dos carvalhos', 'pontezinha']
    ],
    'Xaréu' => [
        'descricao' => 'Praia do Xaréu',
        'padroes' => ['xaréu']
    ],
    'Gaibú' => [
        'descricao' => 'Praia do Gaibú',
        'padroes' => ['gaibú']
    ],
    'Suape' => [
        'descricao' => 'Complexo Portuário de Suape',
        'padroes' => ['suape']
    ],
    'Ipojuca' => [
        'descricao' => 'Ipojuca',
        'padroes' => ['ipojuca']
    ],
    'Mercês' => [
        'descricao' => 'Distrito dos Mercês',
        'padroes' => ['mercês']
    ],
    'ZPAM' => [
        'descricao' => 'Zona Portuária e Área Industrial',
        'padroes' => ['suape', 'porto de', 'portuária', 'industrial']
    ],
    'Sul' => [
        'descricao' => 'Região Sul - Praias',
        'padroes' => ['praia de', 'maracaípe', 'porto de galinhas', 'serrambi', 'tamandaré', 'barreiros', 'sirinhaém']
    ],
    'Águia' => [
        'descricao' => 'Águia American Club',
        'padroes' => ['águia', 'american club']
    ],
    'Malaquias' => [
        'descricao' => 'Malaquias',
        'padroes' => ['malaquias']
    ],
    'Torrinha' => [
        'descricao' => 'Torrinha',
        'padroes' => ['torrinha']
    ],
    'Santo Inácio' => [
        'descricao' => 'Santo Inácio',
        'padroes' => ['santo inácio', 'pentecostal']
    ],
    'Destilaria' => [
        'descricao' => 'Destilaria',
        'padroes' => ['destilaria']
    ],
    'Engenho Novo' => [
        'descricao' => 'Engenho Novo',
        'padroes' => ['engenho novo']
    ],
    'Charneca' => [
        'descricao' => 'Charneca',
        'padroes' => ['charneca']
    ],
    'Barbalho' => [
        'descricao' => 'Barbalho',
        'padroes' => ['barbalho']
    ],
    'Rosário' => [
        'descricao' => 'Rosário',
        'padroes' => ['rosário', 'sest-senat']
    ],
    'Agodoais' => [
        'descricao' => 'Agodoais',
        'padroes' => ['agodoais']
    ],
    'Serraria' => [
        'descricao' => 'Serraria',
        'padroes' => ['serraria']
    ],
    'Massangana' => [
        'descricao' => 'Massangana',
        'padroes' => ['massangana']
    ],
    'Pista Preta' => [
        'descricao' => 'Pista Preta',
        'padroes' => ['pista preta']
    ],
    'Novo Horizonte' => [
        'descricao' => 'Novo Horizonte',
        'padroes' => ['novo horizonte']
    ],
    'Fábricas' => [
        'descricao' => 'Área Industrial - Fábricas',
        'padroes' => ['fábrica', 'ball', 'rexam', 'camil', 'urbano', 'amcor', 'coca-cola', 'pepsico', 'tephane']
    ],
    'PE-60' => [
        'descricao' => 'Rodovia PE-60',
        'padroes' => ['pe-60', 'safpe', 'atacadão', 'assaí']
    ]
];

// Limpar regiões existentes
$conn->query("TRUNCATE TABLE regioes_precos");
echo "1. Inserindo " . count($regioes) . " regiões...\n";

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

// Pegar todos os lugares com ID
$result = $conn->query("SELECT id, nome FROM localidades");
$lugaresDb = [];
while ($row = $result->fetch_assoc()) {
    $lugaresDb[$row['id']] = mb_strtolower($row['nome']);
}

$stmt = $conn->prepare("UPDATE localidades SET regiao_id = ? WHERE id = ?");

$associados = 0;
foreach ($lugaresDb as $id => $nome) {
    $regiaoId = null;
    
    foreach ($regioes as $nomeRegiao => $dados) {
        foreach ($dados['padroes'] as $padrao) {
            if (mb_stripos($nome, $padrao) !== false) {
                $regiaoId = $regioesIds[$nomeRegiao];
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
    SELECT r.nome, r.descricao, COUNT(l.id) as total 
    FROM regioes_precos r 
    LEFT JOIN localidades l ON l.regiao_id = r.id 
    GROUP BY r.id 
    ORDER BY total DESC
");

while ($row = $result->fetch_assoc()) {
    echo "   - {$row['nome']}: {$row['total']} lugares\n";
}

$conn->query("SET FOREIGN_KEY_CHECKS = 1");
$conn->close();

echo "\n===Concluído!===\n";