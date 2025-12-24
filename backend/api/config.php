<?php
// public_html/jabuspark_api/config.php
declare(strict_types=1);

// 1. SUPPRESS ON-SCREEN ERRORS (Crucial for API/CORS)
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(E_ALL); // Errors still happen, but they go to error_log, not screen.

// 2. USE REQUIRE_ONCE
require_once __DIR__ . '/response.php';

// 3. SAFE DEFINE HELPER
// This prevents "Constant already defined" warnings if file is loaded twice
if (!function_exists('safe_define')) {
    function safe_define($name, $value) {
        if (!defined($name)) {
            define($name, $value);
        }
    }
}

// --------------------------------------------------
// ENV / Config
// --------------------------------------------------

safe_define('APP_NAME', 'JabuSpark API');

// IMPORTANT: set this to your frontend origin (Vercel URL) in production.
safe_define('CORS_ORIGIN', getenv('JABUSPARK_CORS_ORIGIN') ?: '*');

// Database (MySQL)
safe_define('DB_HOST', getenv('JABUSPARK_DB_HOST') ?: 'localhost');
safe_define('DB_NAME', getenv('JABUSPARK_DB_NAME') ?: 'hrfjgoot_jabuspark');
safe_define('DB_USER', getenv('JABUSPARK_DB_USER') ?: 'hrfjgoot_Gratitude');
safe_define('DB_PASS', getenv('JABUSPARK_DB_PASS') ?: '@kP2G7AhxTt4t4M');

// Sessions
safe_define('SESSION_TTL_DAYS', 30);

// Setup key
safe_define('SETUP_KEY', getenv('JABUSPARK_SETUP_KEY') ?: 'CHANGE_ME_SETUP_KEY');

// File uploads
safe_define('UPLOAD_DIR', __DIR__ . '/uploads');
safe_define('PUBLIC_BASE', getenv('JABUSPARK_PUBLIC_BASE') ?: '');

// Optional overrides
$local = __DIR__ . '/config.local.php';
if (is_file($local)) { require_once $local; }

// --------------------------------------------------
// PDO
// --------------------------------------------------
// Only connect if $pdo isn't already set
if (!isset($pdo)) {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (Throwable $e) {
        // If response.php is loaded, use json_response, otherwise raw JSON
        if (function_exists('json_response')) {
            json_response(['success' => false, 'error' => 'Database connection failed'], 500);
        } else {
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database connection failed']);
            exit;
        }
    }
}