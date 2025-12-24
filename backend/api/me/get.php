<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
  json_response([
    'success' => false,
    'error' => 'Method not allowed'
  ], 405);
}

/**
 * IMPORTANT:
 * require_auth() MUST NOT redirect.
 * It must throw JSON 401 internally.
 */
$user = require_auth($pdo);

json_response([
  'success' => true,
  'data' => [
    'user' => safe_user($pdo, $user)
  ]
]);
