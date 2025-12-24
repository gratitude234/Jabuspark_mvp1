<?php
// public_html/api/index.php
declare(strict_types=1);

require_once __DIR__ . '/response.php';
require_once __DIR__ . '/helpers.php';

// Always set CORS headers
cors_headers();

// Preflight should NOT touch DB
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// DB only for real requests
require_once __DIR__ . '/config.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

// Request path (no querystring)
$uri  = (string)($_SERVER['REQUEST_URI'] ?? '/');
$path = (string)(parse_url($uri, PHP_URL_PATH) ?: '/');

// Base folder of this script (e.g. "/api")
$base = rtrim(dirname((string)($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($base !== '' && $base !== '.' && strpos($path, $base) === 0) {
  $path = substr($path, strlen($base));
}
$path = '/' . ltrim($path, '/');

// ✅ Support both "/api/xxx" and "/xxx"
if (strpos($path, '/api/') === 0) {
  $path = substr($path, 4); // remove "/api"
  $path = '/' . ltrim($path, '/');
}

// Sub path becomes the route matcher
$sub = '/' . trim($path, '/');
if ($sub === '/') $sub = '/';

$routes = [
  // auth
  'POST /auth/register' => __DIR__ . '/auth/register.php',
  'POST /auth/login'    => __DIR__ . '/auth/login.php',
  'POST /auth/logout'   => __DIR__ . '/auth/logout.php',

  // health
  'GET /health'          => __DIR__ . '/health.php',

  // me
  'GET /me'             => __DIR__ . '/me/get.php',
  'PATCH /me/profile'   => __DIR__ . '/me/patch_profile.php',

  // catalog
  'GET /catalog/faculties'   => __DIR__ . '/catalog/faculties.php',
  'GET /catalog/departments' => __DIR__ . '/catalog/departments.php',
  'GET /catalog/courses'     => __DIR__ . '/catalog/courses.php',

  // materials
  'GET /materials'      => __DIR__ . '/materials/list.php',
  'POST /materials'     => __DIR__ . '/materials/create.php',
  'DELETE /materials'   => __DIR__ . '/materials/delete.php',

  // past questions
  'GET /pastquestions'     => __DIR__ . '/pastquestions/list.php',
  'POST /pastquestions'    => __DIR__ . '/pastquestions/create.php',
  'DELETE /pastquestions'  => __DIR__ . '/pastquestions/delete.php',

  // banks
  'GET /banks'          => __DIR__ . '/banks/list.php',
  'GET /banks/get'      => __DIR__ . '/banks/get.php',
  'POST /banks'         => __DIR__ . '/banks/create.php',
  'DELETE /banks'       => __DIR__ . '/banks/delete.php',

  // practice
  'POST /practice/submit' => __DIR__ . '/practice/submit.php',
  'POST /practice/reset'  => __DIR__ . '/practice/reset.php',

  // progress
  'GET /progress'       => __DIR__ . '/progress/get.php',

  // saved items
  'POST /save/toggle'   => __DIR__ . '/save/toggle.php',
];

// Friendly path: /banks/<id> -> /banks/get?id=<id>
$key = $method . ' ' . $sub;
if ($method === 'GET' && preg_match('#^/banks/([A-Za-z0-9._-]+)$#', $sub, $mm)) {
  $_GET['id'] = $mm[1];
  $key = 'GET /banks/get';
}

if (!isset($routes[$key])) {
  $debug = (getenv('JABUSPARK_DEBUG') === '1');
  if ($debug) {
    json_response([
      'success' => false,
      'error' => 'Not found',
      'debug' => [
        'method' => $method,
        'path' => $path,
        'sub' => $sub,
        'key' => $key
      ]
    ], 404);
  }
  json_response(['success' => false, 'error' => 'Not found'], 404);
}

require $routes[$key];
