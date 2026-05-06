<?php
require_once 'config.php';

header("Content-Type: application/json");
echo json_encode(["status" => "ok", "message" => "PHP working", "time" => date("Y-m-d H:i:s")]);