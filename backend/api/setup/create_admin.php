<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET' && ($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  json_response(['success'=>false,'error'=>'Method not allowed'],405);
}

$key = (string)($_GET['key'] ?? ($_POST['key'] ?? ''));
if ($key !== (string)SETUP_KEY) {
  json_response(['success'=>false,'error'=>'Invalid setup key'],403);
}

// Accept POST (JSON) or GET query params for quick setup
$body = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' ? read_json() : [];
$email = (string)($body['email'] ?? ($_GET['email'] ?? 'admin@jabuspark.com'));
$password = (string)($body['password'] ?? ($_GET['password'] ?? 'Admin@12345'));
$fullName = (string)($body['fullName'] ?? ($_GET['fullName'] ?? 'JabuSpark Admin'));

$email = strtolower(trim($email));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_response(['success'=>false,'error'=>'Invalid email'],422);
if (strlen($password) < 8) json_response(['success'=>false,'error'=>'Password must be at least 8 characters'],422);

$stmt = $pdo->prepare('SELECT id, role FROM users WHERE email = :e LIMIT 1');
$stmt->execute([':e'=>$email]);
$existing = $stmt->fetch();

if ($existing) {
  if (($existing['role'] ?? '') === 'admin') {
    json_response(['success'=>true,'data'=>['message'=>'Admin already exists', 'email'=>$email]]);
  }
  // promote to admin
  $pdo->prepare('UPDATE users SET role = "admin" WHERE id = :id')->execute([':id'=>$existing['id']]);
  json_response(['success'=>true,'data'=>['message'=>'User promoted to admin', 'email'=>$email]]);
}

$uid = uuidv4();
$hash = password_hash($password, PASSWORD_DEFAULT);

$pdo->beginTransaction();
$pdo->prepare('INSERT INTO users (id,email,password_hash,full_name,role,created_at)
               VALUES (:id,:e,:ph,:fn,"admin",UTC_TIMESTAMP())')
    ->execute([':id'=>$uid,':e'=>$email,':ph'=>$hash,':fn'=>$fullName]);

$pdo->prepare('INSERT INTO profiles (user_id, faculty_id, department_id, level) VALUES (:uid,NULL,NULL,NULL)')
    ->execute([':uid'=>$uid]);

$pdo->prepare('INSERT INTO user_progress (user_id, streak, accuracy, total_answered, correct_answered, study_seconds, last_active)
               VALUES (:uid, 1, 0, 0, 0, 0, :d)')
    ->execute([':uid'=>$uid,':d'=>today_iso_date()]);
$pdo->commit();

json_response(['success'=>true,'data'=>[
  'message'=>'Admin created',
  'email'=>$email,
  'password'=>$password,
  'note'=>'Change the password after first login.'
]],201);
