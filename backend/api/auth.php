<?php
// public_html/jabuspark_api/auth.php
declare(strict_types=1);

require_once __DIR__ . '/response.php';
require_once __DIR__ . '/helpers.php';

/**
 * Sessions are opaque tokens stored hashed in DB.
 * Client sends: Authorization: Bearer <token>
 */

function token_hash(string $token): string {
  // constant-time hash; store hex
  return hash('sha256', $token, false);
}

function create_session(PDO $pdo, array $user): array {
  $token = bin2hex(random_bytes(32));
  $hash = token_hash($token);
  $sid = uuidv4();
  $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
  $expires = $now->modify('+' . SESSION_TTL_DAYS . ' days');

  $stmt = $pdo->prepare('INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, ip, user_agent)
                         VALUES (:id, :uid, :th, :ca, :ea, :ip, :ua)');
  $stmt->execute([
    ':id' => $sid,
    ':uid' => $user['id'],
    ':th' => $hash,
    ':ca' => $now->format('Y-m-d H:i:s'),
    ':ea' => $expires->format('Y-m-d H:i:s'),
    ':ip' => substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64),
    ':ua' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
  ]);

  return ['token' => $token, 'expiresAt' => $expires->format('c')];
}

function find_user_by_session(PDO $pdo, string $token): ?array {
  $hash = token_hash($token);
  $stmt = $pdo->prepare('SELECT u.* FROM sessions s
                         JOIN users u ON u.id = s.user_id
                         WHERE s.token_hash = :th AND s.expires_at > UTC_TIMESTAMP()
                         LIMIT 1');
  $stmt->execute([':th' => $hash]);
  $u = $stmt->fetch();
  return $u ?: null;
}

function require_auth(PDO $pdo): array {
  $token = bearer_token();
  if (!$token) json_response(['success' => false, 'error' => 'Unauthorized'], 401);

  $u = find_user_by_session($pdo, $token);
  if (!$u) json_response(['success' => false, 'error' => 'Invalid or expired session'], 401);

  return $u;
}

function require_admin(array $user): void {
  if (($user['role'] ?? '') !== 'admin') {
    json_response(['success' => false, 'error' => 'Admin only'], 403);
  }
}

function safe_user(PDO $pdo, array $user): array {
  // Attach profile + courses
  $profile = [
    'facultyId' => null,
    'departmentId' => null,
    'level' => null,
    'courseIds' => [],
  ];

  $stmt = $pdo->prepare('SELECT faculty_id, department_id, level FROM profiles WHERE user_id = :uid LIMIT 1');
  $stmt->execute([':uid' => $user['id']]);
  $p = $stmt->fetch();
  if ($p) {
    $profile['facultyId'] = $p['faculty_id'];
    $profile['departmentId'] = $p['department_id'];
    $profile['level'] = $p['level'] !== null ? (int)$p['level'] : null;
  }

  $stmt = $pdo->prepare('SELECT course_id FROM user_courses WHERE user_id = :uid');
  $stmt->execute([':uid' => $user['id']]);
  $profile['courseIds'] = array_values(array_map(fn($r) => $r['course_id'], $stmt->fetchAll() ?: []));

  return [
    'id' => $user['id'],
    'email' => $user['email'],
    'fullName' => $user['full_name'],
    'role' => $user['role'],
    'createdAt' => $user['created_at'],
    'profile' => $profile
  ];
}
