<?php
/**
 * SCRIPT DE TESTE - Validar Configuração MySQL
 * 
 * Executa: php test-setup.php
 * Ou acesse: http://localhost:8000/rfdrive/php/test-setup.php
 */

// Cores para terminal
const GREEN = "\033[92m";
const RED = "\033[91m";
const YELLOW = "\033[93m";
const RESET = "\033[0m";
const BOLD = "\033[1m";

echo BOLD . "\n🔧 TESTE DE CONFIGURAÇÃO - RIDE-AI + MySQL\n" . RESET;
echo str_repeat("=", 60) . "\n\n";

$tests = [];
$total_passed = 0;
$total_failed = 0;

// ==================== TESTE 1: Arquivo config.php ====================
echo BOLD . "1️⃣  Verificando config.php" . RESET . "\n";
$config_file = __DIR__ . '/config.php';
if (file_exists($config_file)) {
    echo GREEN . "   ✅ config.php encontrado\n" . RESET;
    $tests[] = ['Arquivo config.php', 'PASS'];
    $total_passed++;
} else {
    echo RED . "   ❌ config.php NÃO ENCONTRADO\n" . RESET;
    $tests[] = ['Arquivo config.php', 'FAIL'];
    $total_failed++;
}

// ==================== TESTE 2: Verificar constantes ====================
echo BOLD . "\n2️⃣  Verificando constantes PHP" . RESET . "\n";
require_once 'config.php';

if (defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER')) {
    echo GREEN . "   ✅ Constantes definidas:\n" . RESET;
    echo "      HOST: " . DB_HOST . "\n";
    echo "      BANCO: " . DB_NAME . "\n";
    echo "      USER: " . DB_USER . "\n";
    $tests[] = ['Constantes PHP', 'PASS'];
    $total_passed++;
} else {
    echo RED . "   ❌ Constantes não definidas\n" . RESET;
    $tests[] = ['Constantes PHP', 'FAIL'];
    $total_failed++;
}

// ==================== TESTE 3: Conexão PDO ====================
echo BOLD . "\n3️⃣  Testando conexão PDO com MySQL" . RESET . "\n";
try {
    $test_query = $conn->query("SELECT 1");
    if ($test_query) {
        echo GREEN . "   ✅ Conexão PDO estabelecida\n" . RESET;
        $tests[] = ['Conexão PDO', 'PASS'];
        $total_passed++;
    }
} catch(Exception $e) {
    echo RED . "   ❌ Erro de conexão: " . $e->getMessage() . "\n" . RESET;
    $tests[] = ['Conexão PDO', 'FAIL'];
    $total_failed++;
    echo RED . "\n   Possíveis soluções:\n";
    echo "   1. Verificar se MySQL está rodando\n";
    echo "   2. Confirmar credenciais em config.php\n";
    echo "   3. Verificar se banco 'malacaco_rfdrive' existe\n" . RESET;
}

// ==================== TESTE 4: Banco de dados ====================
echo BOLD . "\n4️⃣  Verificando banco de dados" . RESET . "\n";
try {
    $result = $conn->query("SELECT COUNT(*) as total FROM information_schema.tables WHERE table_schema = 'malacaco_rfdrive'");
    $row = $result->fetch();
    $total_tables = $row['total'];
    
    if ($total_tables >= 21) {
        echo GREEN . "   ✅ Banco 'malacaco_rfdrive' encontrado\n";
        echo "   ✅ Total de tabelas: " . $total_tables . " (esperado: 21+)\n" . RESET;
        $tests[] = ['Banco de dados', 'PASS'];
        $total_passed++;
    } else if ($total_tables > 0) {
        echo YELLOW . "   ⚠️  Banco encontrado, mas com poucas tabelas: " . $total_tables . "\n";
        echo "   📝 Talvez schema.sql ainda não foi importado\n" . RESET;
        $tests[] = ['Banco de dados', 'WARNING'];
    } else {
        echo RED . "   ❌ Banco vazio ou não encontrado\n" . RESET;
        $tests[] = ['Banco de dados', 'FAIL'];
        $total_failed++;
    }
} catch(Exception $e) {
    echo RED . "   ❌ Erro ao verificar banco: " . $e->getMessage() . "\n" . RESET;
    $tests[] = ['Banco de dados', 'FAIL'];
    $total_failed++;
}

// ==================== TESTE 5: Tabelas Principais ====================
echo BOLD . "\n5️⃣  Verificando tabelas principais" . RESET . "\n";
$required_tables = ['users', 'corridas', 'avaliacoes', 'precos_rotas', 'localidades'];
$found_tables = 0;

try {
    foreach ($required_tables as $table) {
        $result = $conn->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'malacaco_rfdrive' AND table_name = '$table'");
        $exists = $result->fetchColumn() > 0;
        
        if ($exists) {
            echo GREEN . "   ✅ Tabela '$table' existe\n" . RESET;
            $found_tables++;
        } else {
            echo RED . "   ❌ Tabela '$table' NÃO ENCONTRADA\n" . RESET;
        }
    }
    
    if ($found_tables === count($required_tables)) {
        $tests[] = ['Tabelas principais', 'PASS'];
        $total_passed++;
    } else {
        $tests[] = ['Tabelas principais', 'FAIL'];
        $total_failed++;
    }
} catch(Exception $e) {
    echo RED . "   ❌ Erro: " . $e->getMessage() . "\n" . RESET;
    $tests[] = ['Tabelas principais', 'FAIL'];
    $total_failed++;
}

// ==================== TESTE 6: Estrutura da tabela users ====================
echo BOLD . "\n6️⃣  Verificando estrutura da tabela 'users'" . RESET . "\n";
try {
    $result = $conn->query("DESCRIBE users");
    $columns = $result->fetchAll();
    
    if (count($columns) >= 30) {
        echo GREEN . "   ✅ Tabela 'users' com " . count($columns) . " colunas\n" . RESET;
        echo "   Principais colunas:\n";
        $important_cols = ['id', 'nome', 'telefone', 'senha', 'email', 'tipo', 'roles', 'status'];
        foreach ($columns as $col) {
            if (in_array($col['Field'], $important_cols)) {
                echo "      ✓ " . $col['Field'] . " (" . $col['Type'] . ")\n";
            }
        }
        $tests[] = ['Estrutura users', 'PASS'];
        $total_passed++;
    } else {
        echo RED . "   ❌ Tabela 'users' incompleta (" . count($columns) . " colunas)\n" . RESET;
        $tests[] = ['Estrutura users', 'FAIL'];
        $total_failed++;
    }
} catch(Exception $e) {
    echo RED . "   ❌ Erro: " . $e->getMessage() . "\n" . RESET;
    $tests[] = ['Estrutura users', 'FAIL'];
    $total_failed++;
}

// ==================== TESTE 7: Índices ====================
echo BOLD . "\n7️⃣  Verificando índices do banco" . RESET . "\n";
try {
    $result = $conn->query("
        SELECT COUNT(*) as total FROM information_schema.statistics 
        WHERE table_schema = 'malacaco_rfdrive' AND index_name != 'PRIMARY'
    ");
    $row = $result->fetch();
    $total_indexes = $row['total'];
    
    if ($total_indexes > 10) {
        echo GREEN . "   ✅ " . $total_indexes . " índices encontrados (bom para performance)\n" . RESET;
        $tests[] = ['Índices', 'PASS'];
        $total_passed++;
    } else {
        echo YELLOW . "   ⚠️  Apenas " . $total_indexes . " índices encontrados\n" . RESET;
        $tests[] = ['Índices', 'WARNING'];
    }
} catch(Exception $e) {
    echo YELLOW . "   ⚠️  Não foi possível verificar índices\n" . RESET;
    $tests[] = ['Índices', 'WARNING'];
}

// ==================== TESTE 8: Foreign Keys ====================
echo BOLD . "\n8️⃣  Verificando Foreign Keys" . RESET . "\n";
try {
    $result = $conn->query("
        SELECT COUNT(*) as total FROM information_schema.referential_constraints 
        WHERE constraint_schema = 'malacaco_rfdrive'
    ");
    $row = $result->fetch();
    $total_fks = $row['total'];
    
    if ($total_fks > 5) {
        echo GREEN . "   ✅ " . $total_fks . " Foreign Keys configuradas\n" . RESET;
        $tests[] = ['Foreign Keys', 'PASS'];
        $total_passed++;
    } else {
        echo YELLOW . "   ⚠️  Apenas " . $total_fks . " Foreign Keys encontradas\n" . RESET;
        $tests[] = ['Foreign Keys', 'WARNING'];
    }
} catch(Exception $e) {
    echo YELLOW . "   ⚠️  Não foi possível verificar Foreign Keys\n" . RESET;
    $tests[] = ['Foreign Keys', 'WARNING'];
}

// ==================== TESTE 9: Charset UTF8MB4 ====================
echo BOLD . "\n9️⃣  Verificando Charset (UTF8MB4)" . RESET . "\n";
try {
    $result = $conn->query("SELECT @@character_set_database as charset, @@collation_database as collation");
    $row = $result->fetch();
    
    echo "   Banco: " . $row['charset'] . " / " . $row['collation'] . "\n";
    
    if (strpos($row['charset'], 'utf8mb4') !== false) {
        echo GREEN . "   ✅ UTF8MB4 configurado corretamente\n" . RESET;
        $tests[] = ['Charset UTF8MB4', 'PASS'];
        $total_passed++;
    } else {
        echo YELLOW . "   ⚠️  Charset não é UTF8MB4\n" . RESET;
        $tests[] = ['Charset UTF8MB4', 'WARNING'];
    }
} catch(Exception $e) {
    echo YELLOW . "   ⚠️  Não foi possível verificar charset\n" . RESET;
    $tests[] = ['Charset UTF8MB4', 'WARNING'];
}

// ==================== TESTE 10: Dados na tabela users ====================
echo BOLD . "\n🔟 Verificando dados na tabela 'users'" . RESET . "\n";
try {
    $result = $conn->query("SELECT COUNT(*) as total FROM users");
    $row = $result->fetch();
    $total_users = $row['total'];
    
    if ($total_users > 0) {
        echo GREEN . "   ✅ Tabela 'users' possui " . $total_users . " registro(s)\n" . RESET;
        $tests[] = ['Dados na tabela users', 'PASS'];
        $total_passed++;
    } else {
        echo YELLOW . "   ℹ️  Tabela 'users' está vazia (normal no início)\n" . RESET;
        $tests[] = ['Dados na tabela users', 'WARNING'];
    }
} catch(Exception $e) {
    echo RED . "   ❌ Erro: " . $e->getMessage() . "\n" . RESET;
    $tests[] = ['Dados na tabela users', 'FAIL'];
    $total_failed++;
}

// ==================== RESUMO FINAL ====================
echo "\n" . str_repeat("=", 60) . "\n";
echo BOLD . "📊 RESUMO DOS TESTES\n" . RESET;
echo str_repeat("=", 60) . "\n\n";

echo "Teste                          Status\n";
echo str_repeat("-", 60) . "\n";
foreach ($tests as $test) {
    $status_color = $test[1] === 'PASS' ? GREEN : ($test[1] === 'FAIL' ? RED : YELLOW);
    printf("%-30s %s%s%s\n", $test[0], $status_color, $test[1], RESET);
}

echo "\n" . str_repeat("-", 60) . "\n";
echo "Total: " . GREEN . "$total_passed ✅ PASSOU" . RESET . " | ";
echo RED . "$total_failed ❌ FALHOU" . RESET . "\n";

// ==================== RECOMENDAÇÕES ====================
if ($total_failed > 0) {
    echo "\n" . YELLOW . "⚠️  RECOMENDAÇÕES:\n" . RESET;
    echo "1. Verifique se MySQL está rodando\n";
    echo "2. Confirme credenciais em config.php\n";
    echo "3. Importe schema.sql no phpMyAdmin:\n";
    echo "   - Acesse: http://localhost/phpmyadmin\n";
    echo "   - Selecione banco: malacaco_rfdrive\n";
    echo "   - Aba: Importar\n";
    echo "   - Arquivo: php/schema.sql\n";
    echo "   - Clique: Executar\n";
    echo "4. Re-execute este script após importar\n";
} else {
    echo "\n" . GREEN . BOLD . "✅ TUDO OK! Sistema pronto para uso.\n" . RESET;
}

echo "\n" . str_repeat("=", 60) . "\n\n";
?>
