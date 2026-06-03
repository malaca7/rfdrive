<?php
require_once 'config.php';

$name = 'Plataforma';
$slogan = '';
$logoUrl = 'app-icon.png';
$themeColor = '#1f2937';

$result = $conn->query("SELECT nome_plataforma, slogan, logo_url, cor_primaria FROM config_plataforma LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
  if (!empty($row['nome_plataforma'])) $name = $row['nome_plataforma'];
  if (!empty($row['slogan'])) $slogan = $row['slogan'];
  if (!empty($row['cor_primaria'])) $themeColor = $row['cor_primaria'];
  if (!empty($row['logo_url'])) {
    $logoUrl = $row['logo_url'];
    if (!preg_match('/^https?:\/\//i', $logoUrl)) {
      $rootPath = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/');
      if ($logoUrl[0] === '/') {
        if ($rootPath !== '' && strpos($logoUrl, $rootPath) !== 0) {
          $logoUrl = $rootPath . $logoUrl;
        }
      } else {
        $logoUrl = $rootPath . '/' . $logoUrl;
      }
    }
  }
}

$conn->close();

header('Content-Type: application/json; charset=UTF-8');
echo json_encode([
  'name' => $name,
  'short_name' => $name,
  'description' => $slogan ? ($name . ' - ' . $slogan) : $name,
  'start_url' => '.',
  'display' => 'standalone',
  'background_color' => '#fafafa',
  'theme_color' => $themeColor,
  'orientation' => 'portrait-primary',
  'icons' => [
    ['src' => $logoUrl . '?v=' . time(), 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any maskable'],
    ['src' => $logoUrl . '?v=' . time(), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any maskable'],
  ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
