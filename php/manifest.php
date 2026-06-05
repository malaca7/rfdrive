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

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header('Content-Type: application/json; charset=UTF-8');

// Build absolute URL for the icon
$baseUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'])), '/');
$absoluteIcon = $logoUrl;
if (!preg_match('/^https?:\/\//i', $absoluteIcon)) {
  $absoluteIcon = $baseUrl . '/' . ltrim($absoluteIcon, '/');
}

// Detect MIME type dynamically based on the logo file extension
$iconType = 'image/png';
$parsedPath = parse_url($absoluteIcon, PHP_URL_PATH);
if ($parsedPath) {
  $ext = strtolower(pathinfo($parsedPath, PATHINFO_EXTENSION));
  if ($ext === 'jpg' || $ext === 'jpeg') {
    $iconType = 'image/jpeg';
  } elseif ($ext === 'svg') {
    $iconType = 'image/svg+xml';
  } elseif ($ext === 'webp') {
    $iconType = 'image/webp';
  }
}

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
    ['src' => $absoluteIcon . '?v=' . time(), 'sizes' => '192x192', 'type' => $iconType, 'purpose' => 'any maskable'],
    ['src' => $absoluteIcon . '?v=' . time(), 'sizes' => '512x512', 'type' => $iconType, 'purpose' => 'any maskable'],
  ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
