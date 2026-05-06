<?php
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "http://localhost:8080/rfdrive/php/auth.php");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, '{"action":"check_auth","telefone":"11999999999"}');
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$resp = curl_exec($ch);
curl_close($ch);
echo $resp;