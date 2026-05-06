<?php
/**
 * Gera um arquivo SQL para importar no phpMyAdmin
 * Usa a tabela existente `tabela_precos` (origem/destino como strings)
 * Lê o TabelaRF.json e processa ambos os formatos:
 *   Formato 1: {"origem": "X", "destino": "Y", "valor": Z, "regiao": "..."}
 *   Formato 2: {"Destino": {"origens": ["X","Y",...], "valor": Z}, ...}
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Ler JSON
$jsonPath = __DIR__ . '/../src/data/TabelaRF.json';
$jsonContent = file_get_contents($jsonPath);
$rawData = json_decode($jsonContent, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    die("Erro JSON: " . json_last_error_msg() . "\n");
}

echo "Lendo JSON: " . count($rawData) . " itens brutos\n";

// Normalizar ambos os formatos
$rotas = [];
$fmt1 = 0; $fmt2 = 0;

foreach ($rawData as $item) {
    if (!is_array($item)) continue;

    // Formato 1
    if (isset($item['origem']) && isset($item['destino']) && isset($item['valor'])) {
        $rotas[] = [
            'origem'  => trim($item['origem']),
            'destino' => trim($item['destino']),
            'valor'   => floatval($item['valor']),
            'regiao'  => trim($item['regiao'] ?? 'Geral'),
        ];
        $fmt1++;
        continue;
    }

    // Formato 2: objeto onde chave = destino, valor = {origens:[], valor:N}
    foreach ($item as $destino => $entry) {
        if (is_array($entry) && isset($entry['origens']) && is_array($entry['origens']) && isset($entry['valor'])) {
            $valor  = floatval($entry['valor']);
            $regiao = trim($entry['regiao'] ?? 'Geral');
            foreach ($entry['origens'] as $origem) {
                $origem = trim($origem);
                if (!empty($origem)) {
                    $rotas[] = [
                        'origem'  => $origem,
                        'destino' => trim($destino),
                        'valor'   => $valor,
                        'regiao'  => $regiao,
                    ];
                    $fmt2++;
                }
            }
        }
    }
}

echo "Formato 1: $fmt1 | Formato 2 expandido: $fmt2\n";

// Deduplicar por origem+destino (mantém primeiro encontrado)
$seen = [];
$unique = [];
foreach ($rotas as $r) {
    $key = $r['origem'] . '|||' . $r['destino'];
    if (!isset($seen[$key])) {
        $seen[$key] = true;
        $unique[] = $r;
    }
}
echo "Total após dedup: " . count($unique) . "\n";

// Extrair regiões únicas
$regioes = [];
foreach ($unique as $r) {
    $reg = $r['regiao'] ?: 'Geral';
    $regioes[$reg] = true;
}
echo "Regiões: " . implode(', ', array_keys($regioes)) . "\n";

// UUID
function uuid() {
    return sprintf('%08x-%04x-%04x-%04x-%012x',
        mt_rand(), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff) | 0x4000, mt_rand());
}

// Escapar para SQL
function esc($str) {
    return str_replace("'", "''", $str);
}

// Gerar SQL
$outputPath = __DIR__ . '/import_rotas_completo.sql';
$f = fopen($outputPath, 'w');

fwrite($f, "-- =============================================\n");
fwrite($f, "-- Importação completa de rotas RF Drive\n");
fwrite($f, "-- Tabela: tabela_precos\n");
fwrite($f, "-- Gerado em " . date('Y-m-d H:i:s') . "\n");
fwrite($f, "-- Formatos processados: Formato 1 + Formato 2\n");
fwrite($f, "-- Total de rotas: " . count($unique) . "\n");
fwrite($f, "-- Regiões: " . implode(', ', array_keys($regioes)) . "\n");
fwrite($f, "-- =============================================\n\n");

fwrite($f, "SET NAMES 'utf8mb4';\n\n");

// Limpar tabela
fwrite($f, "-- =============================================\n");
fwrite($f, "-- 1. LIMPAR DADOS EXISTENTES\n");
fwrite($f, "-- =============================================\n\n");
fwrite($f, "DELETE FROM `tabela_precos`;\n\n");

// Inserir rotas em lotes
fwrite($f, "-- =============================================\n");
fwrite($f, "-- 2. INSERIR ROTAS (" . count($unique) . ")\n");
fwrite($f, "-- =============================================\n\n");

$batch = [];
$batchSize = 50;
$count = 0;

foreach ($unique as $r) {
    $id = uuid();
    $origem = esc($r['origem']);
    $destino = esc($r['destino']);
    $valor = number_format($r['valor'], 2, '.', '');
    $regiao = esc($r['regiao']);

    $batch[] = "('" . $id . "', '" . $origem . "', '" . $destino . "', $valor, '" . $regiao . "')";
    $count++;

    if (count($batch) >= $batchSize || $count === count($unique)) {
        fwrite($f, "INSERT INTO `tabela_precos` (`id`, `origem`, `destino`, `valor`, `regiao`) VALUES\n");
        fwrite($f, implode(",\n", $batch) . ";\n\n");
        $batch = [];
    }
}

fwrite($f, "-- =============================================\n");
fwrite($f, "-- IMPORTAÇÃO CONCLUÍDA!\n");
fwrite($f, "-- Total de rotas inseridas: " . count($unique) . "\n");
fwrite($f, "-- Regiões: " . implode(', ', array_keys($regioes)) . "\n");
fwrite($f, "-- =============================================\n");

fclose($f);

$fileSize = round(filesize($outputPath) / 1024, 1);
echo "\n✅ Arquivo SQL gerado: $outputPath ($fileSize KB)\n";
echo "→ Importe no phpMyAdmin: Aba 'Importar' → Selecione o arquivo → Executar\n";
