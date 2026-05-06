<?php
$source = __DIR__ . '/../uploads';
$dest = __DIR__ . '/uploads';
if (file_exists($source)) {
    rename($source, $dest);
    echo "Moved";
} else {
    echo "Source not found";
}
?>
