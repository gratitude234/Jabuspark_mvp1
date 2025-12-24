<?php
// public_html/jabuspark_api/helpers.php
declare(strict_types=1);

/**
 * CORS HEADERS
 * Must run BEFORE any output
 */
if (!function_exists('cors_headers')) {

function cors_headers(): void {
  $allowedOrigins = [
    'https://jabuspark-mvp1.vercel.app',
  ];

  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
    header("Vary: Origin");
  }

  header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Authorization');
}
}


/**
 * Utility helpers
 */

function now_iso(): string {
  return gmdate('c');
}

function today_iso_date(): string {
  return gmdate('Y-m-d');
}

function uuidv4(): string {
  $data = random_bytes(16);
  $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
  $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
  $hex = bin2hex($data);
  return sprintf(
    '%s-%s-%s-%s-%s',
    substr($hex, 0, 8),
    substr($hex, 8, 4),
    substr($hex, 12, 4),
    substr($hex, 16, 4),
    substr($hex, 20, 12)
  );
}

function require_fields(array $body, array $fields): void {
  foreach ($fields as $f) {
    if (!array_key_exists($f, $body) || $body[$f] === null || $body[$f] === '') {
      json_response([
        'success' => false,
        'error' => 'Missing field: ' . $f
      ], 422);
    }
  }
}

function bearer_token(): ?string {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['Authorization'] ?? '';
  if (!$h) return null;
  if (stripos($h, 'Bearer ') === 0) {
    return trim(substr($h, 7));
  }
  return null;
}

function public_url(string $pathFromApiRoot): string {
  $base = rtrim((string)PUBLIC_BASE, '/');
  if ($base === '') return $pathFromApiRoot;
  return $base . $pathFromApiRoot;
}

function safe_filename(string $name): string {
  $name = preg_replace('/[^A-Za-z0-9._-]+/', '_', $name) ?? 'file';
  $name = trim($name, '_');
  return $name === '' ? 'file' : $name;
}

function json_get(?string $json, $fallback) {
  if (!$json) return $fallback;
  $d = json_decode($json, true);
  return is_array($d) || is_object($d) ? $d : $fallback;
}
