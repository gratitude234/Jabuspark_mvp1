<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$token = bearer_token();
if (!$token) json_response(['success'=>true,'data'=>['loggedOut'=>true]]);

$hash = hash('sha256', $token, false);
$stmt = $pdo->prepare('DELETE FROM sessions WHERE token_hash = :th');
$stmt->execute([':th'=>$hash]);

json_response(['success'=>true,'data'=>['loggedOut'=>true]]);
