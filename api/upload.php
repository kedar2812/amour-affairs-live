<?php
/**
 * ============================================================
 * AMOUR AFFAIRS — Image Upload Helper
 * ============================================================
 * Secure image upload with validation and WebP conversion.
 * Supports single-field uploads and multi-file batches
 * (validate everything first, then process file by file).
 * ============================================================
 */

require_once __DIR__ . '/config.php';

/**
 * Normalize $_FILES[$fieldName] into a list of single-file arrays.
 * Handles both `<input name="photo">` and `<input name="photos[]" multiple>`.
 * Returns [] when the field is absent or empty.
 */
function normalizeUploadedFiles(string $fieldName): array {
    if (!isset($_FILES[$fieldName])) {
        return [];
    }

    $field = $_FILES[$fieldName];

    // Single file
    if (!is_array($field['name'])) {
        return $field['error'] === UPLOAD_ERR_NO_FILE ? [] : [$field];
    }

    // Multi-file: PHP transposes the structure — re-assemble per file
    $files = [];
    foreach ($field['name'] as $i => $name) {
        if ($field['error'][$i] === UPLOAD_ERR_NO_FILE) continue;
        $files[] = [
            'name'     => $name,
            'type'     => $field['type'][$i],
            'tmp_name' => $field['tmp_name'][$i],
            'error'    => $field['error'][$i],
            'size'     => $field['size'][$i],
        ];
    }
    return $files;
}


/**
 * Validate a single uploaded file array.
 * Returns an error message string, or null if the file is valid.
 */
function validateImageFile(array $file): ?string {
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errors = [
            UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload limit',
            UPLOAD_ERR_FORM_SIZE  => 'File exceeds form upload limit',
            UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temp directory',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
        ];
        return $errors[$file['error']] ?? 'Upload error';
    }

    if ($file['size'] > MAX_UPLOAD_SIZE) {
        return 'File size exceeds ' . (MAX_UPLOAD_SIZE / 1024 / 1024) . 'MB limit';
    }

    // Validate MIME type using finfo (not the untrusted $_FILES['type'])
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);

    if (!in_array($mimeType, ALLOWED_MIME_TYPES, true)) {
        return 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF';
    }

    // Double-check with getimagesize (prevents disguised files)
    $info = @getimagesize($file['tmp_name']);
    if ($info === false) {
        return 'File is not a valid image';
    }

    // Reject decompression bombs before the expensive decode — getimagesize reads
    // only the header, so this is cheap and runs before any imagecreatefrom* call.
    if (((int)$info[0] * (int)$info[1]) > MAX_IMAGE_PIXELS) {
        return 'Image resolution is too large (max ' . (int)(MAX_IMAGE_PIXELS / 1000000) . ' megapixels)';
    }

    return null;
}


/**
 * Convert a validated upload to WebP + thumbnail and store it.
 * Returns the stored file metadata, or false on processing failure.
 * Call validateImageFile() first — this assumes the file is valid.
 */
function processSingleImageFile(array $file, string $subdir) {
    $imageInfo = @getimagesize($file['tmp_name']);
    if ($imageInfo === false) return false;

    $width = $imageInfo[0];
    $height = $imageInfo[1];

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);

    // Generate unique filename
    $timestamp = time();
    $random = bin2hex(random_bytes(8));
    $filename = "{$timestamp}_{$random}.webp";
    $thumbFilename = "{$timestamp}_{$random}_thumb.webp";

    // Ensure directories exist
    $uploadDir = ensureUploadDir($subdir);

    $filePath = $uploadDir . $filename;
    $thumbPath = $uploadDir . $thumbFilename;

    // Load image based on type
    $srcImage = null;
    switch ($mimeType) {
        case 'image/jpeg':
            $srcImage = @imagecreatefromjpeg($file['tmp_name']);
            break;
        case 'image/png':
            $srcImage = @imagecreatefrompng($file['tmp_name']);
            break;
        case 'image/webp':
            $srcImage = @imagecreatefromwebp($file['tmp_name']);
            break;
        case 'image/gif':
            $srcImage = @imagecreatefromgif($file['tmp_name']);
            break;
    }

    if (!$srcImage) return false;

    // Preserve transparency for PNG
    imagealphablending($srcImage, true);
    imagesavealpha($srcImage, true);

    // Auto-rotate based on EXIF data (JPEG only)
    if ($mimeType === 'image/jpeg' && function_exists('exif_read_data')) {
        $exif = @exif_read_data($file['tmp_name']);
        if ($exif && isset($exif['Orientation'])) {
            switch ($exif['Orientation']) {
                case 3:
                    $srcImage = imagerotate($srcImage, 180, 0);
                    break;
                case 6:
                    $srcImage = imagerotate($srcImage, -90, 0);
                    [$width, $height] = [$height, $width];
                    break;
                case 8:
                    $srcImage = imagerotate($srcImage, 90, 0);
                    [$width, $height] = [$height, $width];
                    break;
            }
        }
    }

    // Downscale oversized images to MAX_IMAGE_DIMENSION on the longest edge.
    // Keeps stored files web-sized — big savings in disk, CPU and bandwidth.
    $scale = min(MAX_IMAGE_DIMENSION / $width, MAX_IMAGE_DIMENSION / $height);
    if ($scale < 1) {
        $scaledWidth = max(1, (int)round($width * $scale));
        $scaledHeight = max(1, (int)round($height * $scale));
        $scaledImage = imagecreatetruecolor($scaledWidth, $scaledHeight);
        imagealphablending($scaledImage, false);
        imagesavealpha($scaledImage, true);
        imagecopyresampled($scaledImage, $srcImage, 0, 0, 0, 0, $scaledWidth, $scaledHeight, $width, $height);
        imagedestroy($srcImage);
        $srcImage = $scaledImage;
        $width = $scaledWidth;
        $height = $scaledHeight;
    }

    // Save as WebP (main image)
    if (!imagewebp($srcImage, $filePath, WEBP_QUALITY)) {
        imagedestroy($srcImage);
        return false;
    }

    // Create thumbnail
    $thumbWidth = THUMBNAIL_MAX_WIDTH;
    $thumbHeight = THUMBNAIL_MAX_HEIGHT;
    $ratio = min($thumbWidth / $width, $thumbHeight / $height);

    if ($ratio < 1) {
        $newWidth = (int)round($width * $ratio);
        $newHeight = (int)round($height * $ratio);
    } else {
        $newWidth = $width;
        $newHeight = $height;
    }

    $thumbImage = imagecreatetruecolor($newWidth, $newHeight);
    imagealphablending($thumbImage, false);
    imagesavealpha($thumbImage, true);
    imagecopyresampled($thumbImage, $srcImage, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
    imagewebp($thumbImage, $thumbPath, WEBP_QUALITY);
    imagedestroy($thumbImage);

    // Get final file size
    $fileSize = filesize($filePath);

    // Clean up
    imagedestroy($srcImage);

    // Return relative paths (for storage in DB)
    $relPath = UPLOAD_URL_PREFIX . $subdir . $filename;
    $relThumbPath = UPLOAD_URL_PREFIX . $subdir . $thumbFilename;

    return [
        'file_path'      => $relPath,
        'thumbnail_path' => $relThumbPath,
        'width'          => $width,
        'height'         => $height,
        'file_size'      => $fileSize,
        'original_name'  => $file['name'],
    ];
}


/**
 * Process and store a single uploaded image from a form field.
 * Returns [file_path, thumbnail_path, width, height, file_size] or sends error.
 * Returns [] when the field is absent (optional upload).
 */
function processImageUpload(string $fieldName, string $subdir): array {
    $files = normalizeUploadedFiles($fieldName);
    if (empty($files)) {
        return [];
    }

    $file = $files[0];

    $error = validateImageFile($file);
    if ($error !== null) {
        sendError($error, 400);
    }

    $result = processSingleImageFile($file, $subdir);
    if ($result === false) {
        sendError('Failed to process image', 500);
    }

    return $result;
}


/**
 * Process and store a single uploaded PDF document from a form field.
 * Returns ['file_path' => ..., 'original_name' => ...] or sends an error.
 * Returns [] when the field is absent (optional upload).
 */
function processDocumentUpload(string $fieldName, string $subdir): array {
    $files = normalizeUploadedFiles($fieldName);
    if (empty($files)) {
        return [];
    }

    $file = $files[0];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        sendError('Upload error', 400);
    }
    if ($file['size'] > MAX_UPLOAD_SIZE) {
        sendError('File size exceeds ' . (MAX_UPLOAD_SIZE / 1024 / 1024) . 'MB limit', 400);
    }

    // Validate the real MIME type — only PDFs are accepted as lead magnets
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);
    if ($mimeType !== 'application/pdf') {
        sendError('Invalid file type. Only PDF documents are allowed.', 400);
    }

    $timestamp = time();
    $random = bin2hex(random_bytes(8));
    $filename = "{$timestamp}_{$random}.pdf";

    $uploadDir = ensureUploadDir($subdir);
    $destPath = $uploadDir . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        sendError('Failed to store document', 500);
    }

    return [
        'file_path'     => UPLOAD_URL_PREFIX . $subdir . $filename,
        'original_name' => $file['name'],
    ];
}


/**
 * Remove the responsive copies api/img.php made of an upload
 * (/uploads/_w/<width>/<path>), so deleted photos leave nothing behind.
 */
function deleteSizedCopies(?string $filePath): void {
    if (!$filePath || strpos($filePath, UPLOAD_URL_PREFIX) !== 0) return;
    $rel = substr($filePath, strlen(UPLOAD_URL_PREFIX));
    if ($rel === '' || strpos($rel, '..') !== false) return;
    foreach (glob(UPLOAD_DIR . '_w/*', GLOB_ONLYDIR) ?: array() as $sizeDir) {
        $copy = $sizeDir . '/' . $rel;
        if (is_file($copy)) @unlink($copy);
    }
}


/**
 * Delete a stored file (by its /uploads/... URL path) from disk.
 */
function deleteStoredFile(?string $filePath): void {
    if (!$filePath) return;
    $fullPath = dirname(__DIR__) . $filePath;
    if (is_file($fullPath)) {
        unlink($fullPath);
    }
    deleteSizedCopies($filePath);
}


/**
 * Delete an image file and its thumbnail from disk
 */
function deleteImageFiles(string $filePath, ?string $thumbnailPath = null): void {
    // Convert URL paths back to filesystem paths
    $basePath = dirname(__DIR__);

    if ($filePath) {
        $fullPath = $basePath . $filePath;
        if (file_exists($fullPath)) {
            unlink($fullPath);
        }
        deleteSizedCopies($filePath);
    }

    if ($thumbnailPath) {
        $fullPath = $basePath . $thumbnailPath;
        if (file_exists($fullPath)) {
            unlink($fullPath);
        }
    }
}
