<?php
require_once 'config.php';

$name = 'RF Drive';
$slogan = 'Seu transporte inteligente';
$logoUrl = 'app-icon.png';

$result = $conn->query("SELECT nome_plataforma, slogan, logo_url FROM config_plataforma LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
  if (!empty($row['nome_plataforma'])) $name = $row['nome_plataforma'];
  if (!empty($row['slogan'])) $slogan = $row['slogan'];
  if (!empty($row['logo_url'])) {
    $logoUrl = $row['logo_url'];
    if (!preg_match('/^https?:\/\//i', $logoUrl) && $logoUrl[0] !== '/') {
      $logoUrl = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/' . $logoUrl;
    }
  }
}

$conn->close();

header('Content-Type: application/json; charset=UTF-8');
echo json_encode([
  'name' => $name,
  'short_name' => $name,
  'description' => $name . ' - ' . $slogan,
  'start_url' => '.',
  'display' => 'standalone',
  'background_color' => '#fafafa',
  'theme_color' => '#086AB8',
  'orientation' => 'portrait-primary',
  'icons' => [
    ['src' => $logoUrl, 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any maskable'],
    ['src' => $logoUrl, 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any maskable'],
  ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
