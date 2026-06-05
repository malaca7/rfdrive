<?php
header('Content-Type: text/plain');
echo "Running git checkout...\n";
$out = shell_exec("git checkout -- d:\\dev\\web\\ride-ai\\src\\components\\AdminTabelaPrecos.tsx 2>&1");
echo "Result: " . ($out ? $out : "Success") . "\n";
?>
