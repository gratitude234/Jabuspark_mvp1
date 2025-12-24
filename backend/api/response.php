<?php
declare(strict_types=1);

/**
 * Send CORS headers for browser requests.
 * Supports env var override:
 *   JABUSPARK_CORS_ORIGIN="http://localhost:5173,https://your-frontend.vercel.app"
 */
function cors_headers(): void
{
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

  // Default allowed origins (dev + production)
  $defaultAllowed = 'http://localhost:5173,https://jabumarket.com.ng,https://jabuspark-mvp1.vercel.app';

  $allowed = getenv('JABUSPARK_CORS_ORIGIN') ?: $defaultAllowed;

  // If allowed is "*", allow all
  if (trim($allowed) === '*') {
    header('Access-Control-Allow-Origin: *');
    header('Vary: Origin');
  } else {
    $list = array_values(array_filter(array_map('trim', explode(',', $allowed))));

    // Reflect exact origin only if it is in allowed list
    if ($origin && in_array($origin, $list, true)) {
      header('Access-Control-Allow-Origin: ' . $origin);
      header('Vary: Origin');
    } else {
      // Fallback to first allowed origin (helps some clients)
      header('Access-Control-Allow-Origin: ' . ($list[0] ?? ''));
      header('Vary: Origin');
    }
  }

  header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
  header('Access-Control-Max-Age: 86400');

  // If you ever use cookies/sessions across origins, then:
  // - You MUST set a specific origin (not "*")
  // - And enable:
  // header('Access-Control-Allow-Credentials: true');
}

function json_response(array $payload, int $status = 200): void
{
  if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
  }
  http_response_code($status);
  echo json_encode($payload, JSON_UNESCAPED_SLASHES);
  exit;
}

function read_json(): array
{
  $raw = file_get_contents('php://input');
  if ($raw === false || trim($raw) === '') return [];
  $data = json_decode($raw, true);
  if (!is_array($data)) {
    json_response(['success' => false, 'error' => 'Invalid JSON body'], 400);
  }
  return $data;
}
