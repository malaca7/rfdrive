<?php
// Script para importar rotas do JSON diretamente no banco
// Tabela: tabela_precos (origem, destino, valor, regiao)
// Suporta dois formatos:
//   Formato 1: {"origem": "X", "destino": "Y", "valor": Z, "regiao": "..."}
//   Formato 2: {"Destino": {"origens": ["X","Y",...], "valor": Z}, ...}
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once 'config.php';

function generateUuid() {
    return sprintf('%08x-%04x-%04x-%04x-%012x', mt_rand(), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff) | 0x4000, mt_rand());
}

echo "===Importação de Rotas para tabela_precos===\n\n";

// Ler o arquivo JSON
$possiblePaths = [
    __DIR__ . '/../src/data/TabelaRF.json',
    'D:/dev/web/Tabela-oficial-RFDriver-main/data/TabelaRF.json',
];
$jsonPath = null;
foreach ($possiblePaths as $path) {
    if (file_exists($path)) {
        $jsonPath = $path;
        break;
    }
}
if (!$jsonPath) {
    die("Erro: arquivo TabelaRF.json não encontrado\n");
}
echo "Lendo arquivo: $jsonPath\n";

$jsonContent = file_get_contents($jsonPath);
$rawData = json_decode($jsonContent, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    die("Erro JSON: " . json_last_error_msg() . "\n");
}

echo "Total de itens brutos: " . count($rawData) . "\n";

// Normalizar ambos os formatos
$rotasNormalizadas = [];
$countFmt1 = 0;
$countFmt2 = 0;

foreach ($rawData as $item) {
    if (!is_array($item)) continue;

    // Formato 1: item simples com origem/destino/valor
    if (isset($item['origem']) && isset($item['destino']) && isset($item['valor'])) {
        $rotasNormalizadas[] = [
            'origem'  => trim($item['origem']),
            'destino' => trim($item['destino']),
            'valor'   => floatval($item['valor']),
            'regiao'  => trim($item['regiao'] ?? 'Geral'),
        ];
        $countFmt1++;
        continue;
    }

    // Formato 2: objeto onde cada chave é um destino com origens[] + valor
    foreach ($item as $destino => $entry) {
        if (is_array($entry) && isset($entry['origens']) && is_array($entry['origens']) && isset($entry['valor'])) {
            $valor  = floatval($entry['valor']);
            $regiao = trim($entry['regiao'] ?? 'Geral');
            foreach ($entry['origens'] as $origem) {
                if (!empty(trim($origem))) {
                    $rotasNormalizadas[] = [
                        'origem'  => trim($origem),
                        'destino' => trim($destino),
                        'valor'   => $valor,
                        'regiao'  => $regiao,
                    ];
                    $countFmt2++;
                }
            }
        }
    }
}

echo "  → Formato 1: $countFmt1 registros\n";
echo "  → Formato 2 expandido: $countFmt2 registros\n";

// Remover duplicatas (mesmo origem+destino)
$seen = [];
$unique = [];
foreach ($rotasNormalizadas as $r) {
    $key = $r['origem'] . '|||' . $r['destino'];
    if (!isset($seen[$key])) {
        $seen[$key] = true;
        $unique[] = $r;
    }
}
echo "Total após dedup: " . count($unique) . "\n";

// Conectar ao banco
$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    die("Erro na conexão: " . $conn->connect_error . "\n");
}
$conn->query("SET NAMES 'utf8mb4'");
echo "\nConexão estabelecida\n";

// Limpar tabela
echo "\n1. Limpando tabela_precos...\n";
$conn->query("DELETE FROM tabela_precos");
echo "   Tabela limpa\n";

// Inserir rotas
echo "\n2. Inserindo rotas...\n";
$stmt = $conn->prepare("INSERT INTO tabela_precos (id, origem, destino, valor, regiao) VALUES (?, ?, ?, ?, ?)");
$inserted = 0;

foreach ($unique as $r) {
    $id = generateUuid();
    $stmt->bind_param("sssds", $id, $r['origem'], $r['destino'], $r['valor'], $r['regiao']);
    $stmt->execute();
    $inserted++;

    if ($inserted % 500 == 0) {
        echo "   Inseridas $inserted rotas...\n";
    }
}

echo "   Total inseridas: $inserted\n";

// Verificar
echo "\n3. Verificando...\n";
$result = $conn->query("SELECT COUNT(*) as total FROM tabela_precos");
$row = $result->fetch_assoc();
echo "   Total na tabela_precos: " . $row['total'] . "\n";

$result = $conn->query("SELECT DISTINCT regiao, COUNT(*) as qty FROM tabela_precos GROUP BY regiao");
while ($row = $result->fetch_assoc()) {
    echo "   Região '{$row['regiao']}': {$row['qty']} rotas\n";
}

$conn->close();
echo "\n===Importação concluída!===\n";