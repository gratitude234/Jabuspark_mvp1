<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$body = read_json();
require_fields($body, ['email','password']);

$email = strtolower(trim((string)$body['email']));
$pass  = (string)$body['password'];

$stmt = $pdo->prepare('SELECT * FROM users WHERE email = :e LIMIT 1');
$stmt->execute([':e'=>$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($pass, (string)$user['password_hash'])) {
  json_response(['success'=>false,'error'=>'Invalid email or password'],401);
}

$sess = create_session($pdo, $user);

json_response(['success'=>true,'data'=>[
  'token'=>$sess['token'],
  'expiresAt'=>$sess['expiresAt'],
  'user'=>safe_user($pdo, $user)
]]);
