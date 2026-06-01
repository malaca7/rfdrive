<?php
header('Content-Type: text/plain');
$src = "C:\\Users\\nullp\\.gemini\\antigravity\\brain\\fa7433cb-afd5-42aa-8c40-0fe48a0432f4\\media__1780356389657.jpg";
$dest = dirname(__DIR__) . DIRECTORY_SEPARATOR . "badge-bg.png";

if (!file_exists($src)) {
    echo "ERROR: Source file does not exist at $src";
    exit;
}

if (copy($src, $dest)) {
    echo "SUCCESS: Copied $src to $dest";
} else {
    echo "ERROR: Failed to copy file";
}
?>
