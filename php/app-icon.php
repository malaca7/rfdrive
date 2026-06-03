<?php
require_once 'config.php';

$logoUrl = '';
$result = $conn->query("SELECT logo_url FROM config_plataforma LIMIT 1");
if ($result && $row = $result->fetch_assoc()) {
  $logoUrl = $row['logo_url'];
}
$conn->close();

if (!empty($logoUrl)) {
  // If logoUrl is a remote URL, fetch and stream it
  if (preg_match('/^https?:\/\//i', $logoUrl)) {
    // Set HTTP context options to fetch safely
    $ctx = stream_context_create([
      "http" => [
        "method" => "GET",
        "header" => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n"
      ]
    ]);
    $imgData = @file_get_contents($logoUrl, false, $ctx);
    if ($imgData !== false) {
      // Parse remote content-type if available, default to image/png
      $contentType = 'image/png';
      if (isset($http_response_header)) {
        foreach ($http_response_header as $header) {
          if (preg_match('/^Content-Type:\s*(image\/[a-z0-9+-]+)/i', $header, $matches)) {
            $contentType = $matches[1];
            break;
          }
        }
      }
      header('Content-Type: ' . $contentType);
      echo $imgData;
      exit;
    }
  } else {
    // Local relative file path (e.g. uploads/...)
    $localFile = dirname(__DIR__) . '/' . ltrim($logoUrl, '/');
    if (file_exists($localFile)) {
      $contentType = mime_content_type($localFile) ?: 'image/png';
      header('Content-Type: ' . $contentType);
      readfile($localFile);
      exit;
    }
  }
}

// Fallback to the default physical icon file
$defaultFile = dirname(__DIR__) . '/app-icon.png';
if (file_exists($defaultFile)) {
  header('Content-Type: image/png');
  readfile($defaultFile);
  exit;
}

http_response_code(404);
echo "Icon not found";
