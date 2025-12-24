<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../helpers.php';

// response.php already handles OPTIONS and exits 204

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

// DB only needed for real POST
require __DIR__ . '/../config.php';

$body = read_json();
require_fields($body, ['email', 'password']);

$email = strtolower(trim((string)($body['email'] ?? '')));
$pass  = (string)($body['password'] ?? '');
$full  = trim((string)($body['fullName'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  json_response(['success' => false, 'error' => 'Invalid email'], 422);
}
if (strlen($pass) < 6) {
  json_response(['success' => false, 'error' => 'Password must be at least 6 characters'], 422);
}

if ($full === '') {
  $guess = explode('@', $email)[0] ?? 'JABU STUDENT';
  $guess = preg_replace('/[._-]+/', ' ', $guess);
  $full = strtoupper(trim((string)$guess));
}

try {
  // check exists
  $exists = $pdo->prepare('SELECT id FROM users WHERE email = :e LIMIT 1');
  $exists->execute([':e' => $email]);
  if ($exists->fetch()) {
    json_response(['success' => false, 'error' => 'Email already registered'], 409);
  }

  $uid  = uuidv4();
  $hash = password_hash($pass, PASSWORD_DEFAULT);

  $pdo->beginTransaction();

  $pdo->prepare(
    'INSERT INTO users (id,email,password_hash,full_name,role,created_at)
     VALUES (:id,:e,:ph,:fn,:r,UTC_TIMESTAMP())'
  )->execute([
    ':id' => $uid,
    ':e'  => $email,
    ':ph' => $hash,
    ':fn' => $full,
    ':r'  => 'student',
  ]);

  $pdo->prepare(
    'INSERT INTO profiles (user_id, faculty_id, department_id, level)
     VALUES (:uid, NULL, NULL, NULL)'
  )->execute([':uid' => $uid]);

  $pdo->prepare(
    'INSERT INTO user_progress (user_id, streak, accuracy, total_answered, correct_answered, study_seconds, last_active)
     VALUES (:uid, 1, 0, 0, 0, 0, :d)'
  )->execute([
    ':uid' => $uid,
    ':d'   => today_iso_date()
  ]);

  $pdo->commit();

  // Create token/session
  require_once __DIR__ . '/../auth.php';
  $user = [
    'id' => $uid,
    'email' => $email,
    'full_name' => $full,
    'role' => 'student',
    'created_at' => gmdate('Y-m-d H:i:s')
  ];

  $sess = create_session($pdo, $user);

  json_response(['success' => true, 'data' => [
    'token' => $sess['token'],
    'expiresAt' => $sess['expiresAt'],
    'user' => safe_user($pdo, $user),
  ]], 201);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
  error_log('[register] ' . $e->getMessage());
  json_response(['success' => false, 'error' => 'Registration failed'], 500);
}
