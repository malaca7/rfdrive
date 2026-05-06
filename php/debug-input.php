<?php
$input = json_decode(file_get_contents('php://stdin'), true);
echo "php://stdin result: ";
print_r($input);
echo "\n\nphp://input result: ";
$input2 = json_decode(file_get_contents('php://input'), true);
print_r($input2);