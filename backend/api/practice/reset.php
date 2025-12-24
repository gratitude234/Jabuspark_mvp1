<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$me = require_auth($pdo);
$body = read_json();
require_fields($body, ['bankId']);
$bankId = (string)$body['bankId'];

$pdo->prepare('DELETE FROM user_bank_stats WHERE user_id = :uid AND bank_id = :bid')
    ->execute([':uid'=>$me['id'], ':bid'=>$bankId]);

json_response(['success'=>true,'data'=>['reset'=>true]]);
