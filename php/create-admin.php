<?php
require_once 'config.php';

echo "<h1>Criador de Administrador RF Drive</h1>";

$id = "admin-" . time();
$nome = "Admin Mestre";
$telefone = "11999999999";
$senha = "123456";
$tipo = "ceo";

try {
    $stmt = $conn->prepare("INSERT INTO `users` (`id`, `nome`, `telefone`, `senha`, `tipo`, `status`) 
                            VALUES (:id, :nome, :tel, :pass, :tipo, 'ativo')
                            ON DUPLICATE KEY UPDATE `senha` = :pass, `tipo` = :tipo");
    
    $stmt->execute([
        ':id' => $id,
        ':nome' => $nome,
        ':tel' => $telefone,
        ':pass' => $senha,
        ':tipo' => $tipo
    ]);

    echo "<p style='color: green; font-size: 20px;'>✅ <b>USUÁRIO CRIADO COM SUCESSO!</b></p>";
    echo "<ul>
            <li><b>Telefone:</b> $telefone</li>
            <li><b>Senha:</b> $senha</li>
            <li><b>Nível:</b> CEO</li>
          </ul>";
    echo "<p>Agora você já pode voltar para o site e fazer login com esses dados.</p>";

} catch (Exception $e) {
    echo "<p style='color: red;'>❌ Erro ao criar usuário: " . $e->getMessage() . "</p>";
}
