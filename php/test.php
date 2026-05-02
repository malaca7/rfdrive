<?php
require_once 'config.php';

echo "<h1>Relatório de Diagnóstico RF Drive</h1>";

// 1. Testar Conexão
echo "<h3>1. Testando Conexão com o Banco de Dados:</h3>";
if ($conn) {
    echo "<p style='color: green;'>✅ Conexão estabelecida com sucesso!</p>";
} else {
    echo "<p style='color: red;'>❌ Falha na conexão (Verifique o config.php).</p>";
}

// 2. Testar Tabela Users
echo "<h3>2. Verificando Tabela 'users':</h3>";
try {
    $stmt = $conn->query("SELECT COUNT(*) FROM `users`");
    $count = $stmt->fetchColumn();
    echo "<p style='color: green;'>✅ Tabela 'users' encontrada! Total de registros: $count</p>";
} catch (Exception $e) {
    echo "<p style='color: red;'>❌ Erro ao acessar tabela 'users': " . $e->getMessage() . "</p>";
}

// 3. Testar Busca de Usuário (Exemplo)
echo "<h3>3. Testando busca de usuários:</h3>";
try {
    $stmt = $conn->query("SELECT nome, telefone, senha FROM `users` LIMIT 5");
    $users = $stmt->fetchAll();
    echo "<ul>";
    foreach ($users as $u) {
        echo "<li>Nome: " . $u['nome'] . " | Tel: " . $u['telefone'] . " | Senha: " . $u['senha'] . "</li>";
    }
    echo "</ul>";
} catch (Exception $e) {
    echo "<p style='color: red;'>❌ Erro ao listar usuários.</p>";
}

echo "<hr><p>Acesse este arquivo no seu navegador em: <b>" . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'] . "</b></p>";
