<?php
// Prevent caching of this wrapper script by intermediate proxies
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

// Load the dynamic database config
require_once 'php/config.php';

$name = 'Plataforma';
$slogan = '';
$logoUrl = 'app-icon.png';
$corPrimaria = '';

$result = $conn->query("SELECT nome_plataforma, slogan, logo_url, cor_primaria FROM config_plataforma LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
  if (!empty($row['nome_plataforma'])) $name = $row['nome_plataforma'];
  if (!empty($row['slogan'])) $slogan = $row['slogan'];
  if (!empty($row['logo_url'])) {
    $logoUrl = $row['logo_url'];
    if (!preg_match('/^https?:\/\//i', $logoUrl)) {
      $rootPath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
      if ($logoUrl[0] === '/') {
        if ($rootPath !== '' && strpos($logoUrl, $rootPath) !== 0) {
          $logoUrl = $rootPath . $logoUrl;
        }
      } else {
        $logoUrl = $rootPath . '/' . $logoUrl;
      }
    }
  }
  if (!empty($row['cor_primaria'])) $corPrimaria = $row['cor_primaria'];
}
$conn->close();

// Read built index.html
$html = file_get_contents('index.html');

if ($html !== false) {
  // 1. Replace document title
  $html = str_replace(
    '<title>Plataforma de Mobilidade</title>',
    '<title>' . htmlspecialchars($slogan ? $name . ' | ' . $slogan : $name) . '</title>',
    $html
  );

  // 2. Replace static OpenGraph Title
  $html = str_replace(
    '<meta property="og:title" content="Plataforma de Mobilidade" />',
    '<meta property="og:title" content="' . htmlspecialchars($name) . '" />',
    $html
  );

  // 3. Replace static OpenGraph Description
  $html = str_replace(
    '<meta property="og:description" content="Sua plataforma de mobilidade urbana inteligente" />',
    '<meta property="og:description" content="' . htmlspecialchars($slogan ?: $name) . '" />',
    $html
  );

  // 4. Replace static Author
  $html = str_replace(
    '<meta name="author" content="Plataforma de Mobilidade" />',
    '<meta name="author" content="' . htmlspecialchars($name) . '" />',
    $html
  );

  // 5. Replace static apple-mobile-web-app-title
  $html = str_replace(
    '<meta name="apple-mobile-web-app-title" id="appTitle" content="Mobilidade" />',
    '<meta name="apple-mobile-web-app-title" id="appTitle" content="' . htmlspecialchars($name) . '" />',
    $html
  );

  // 6. Replace static OpenGraph and Twitter images if database has a custom logo
  if (!empty($logoUrl)) {
    $html = str_replace(
      '<meta property="og:image" content="app-icon.png" />',
      '<meta property="og:image" content="' . htmlspecialchars($logoUrl) . '" />',
      $html
    );
    $html = str_replace(
      '<meta name="twitter:image" content="app-icon.png" />',
      '<meta name="twitter:image" content="' . htmlspecialchars($logoUrl) . '" />',
      $html
    );
    
    // Replace default apple-touch-icon and favicons as well for initial preloads
    $version = time();
    $html = str_replace('href="app-icon.png"', 'href="' . htmlspecialchars($logoUrl) . '?v=' . $version . '"', $html);
    $html = str_replace('href="favicon.png"', 'href="' . htmlspecialchars($logoUrl) . '?v=' . $version . '"', $html);
    
    // Add cache buster to PWA manifest link
    $html = str_replace('href="php/manifest.php"', 'href="php/manifest.php?v=' . $version . '"', $html);
  }

  // 7. Inject primary color dynamically into HSL variables if defined (prevents any default color flash)
  if (!empty($corPrimaria)) {
    $hex = str_replace('#', '', $corPrimaria);
    if (strlen($hex) === 6) {
      $r = hexdec(substr($hex, 0, 2)) / 255;
      $g = hexdec(substr($hex, 2, 2)) / 255;
      $b = hexdec(substr($hex, 4, 2)) / 255;
      $max = max($r, $g, $b);
      $min = min($r, $g, $b);
      $h = 0; $s = 0; $l = ($max + min) / 2;
      if ($max != $min) {
        $d = $max - min;
        $s = $l > 0.5 ? $d / (2 - $max - min) : $d / ($max + min);
        switch ($max) {
          case $r: $h = ($g - $b) / $d + ($g < $b ? 6 : 0); break;
          case $g: $h = ($b - $r) / $d + 2; break;
          case $b: $h = ($r - $g) / $d + 4; break;
        }
        $h /= 6;
      }
      $hDeg = round($h * 360);
      $sPct = round($s * 100) . '%';
      $lPct = round($l * 100) . '%';
      $hslStr = "$hDeg $sPct $lPct";

      // Inject custom styling variables directly inside head to overwrite CSS defaults
      $styleInjection = "\n    <style>
      :root {
        --primary: $hslStr !important;
        --accent: $hslStr !important;
        --ring: $hslStr !important;
        --sidebar-primary: $hslStr !important;
        --sidebar-ring: $hslStr !important;
        --theme-primary-hex: $corPrimaria !important;
      }
    </style>\n";
      $html = str_replace('</head>', $styleInjection . '</head>', $html);
    }
  }

  echo $html;
} else {
  http_response_code(500);
  echo "Erro ao carregar index.html";
}
