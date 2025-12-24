<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$me = require_auth($pdo);
$body = read_json();
require_fields($body, ['kind','id']);

$kind = (string)$body['kind'];
$itemId = (string)$body['id'];

$allowed = ['pastQuestions','materials','questions'];
if (!in_array($kind, $allowed, true)) json_response(['success'=>false,'error'=>'Invalid kind'],422);
if ($itemId === '') json_response(['success'=>false,'error'=>'Invalid id'],422);

$check = $pdo->prepare('SELECT 1 FROM saved_items WHERE user_id = :uid AND kind = :k AND item_id = :id LIMIT 1');
$check->execute([':uid'=>$me['id'], ':k'=>$kind, ':id'=>$itemId]);

if ($check->fetch()) {
  $pdo->prepare('DELETE FROM saved_items WHERE user_id = :uid AND kind = :k AND item_id = :id')
      ->execute([':uid'=>$me['id'], ':k'=>$kind, ':id'=>$itemId]);
  json_response(['success'=>true,'data'=>['saved'=>false]]);
} else {
  $pdo->prepare('INSERT INTO saved_items (user_id, kind, item_id, created_at) VALUES (:uid,:k,:id,UTC_TIMESTAMP())')
      ->execute([':uid'=>$me['id'], ':k'=>$kind, ':id'=>$itemId]);
  json_response(['success'=>true,'data'=>['saved'=>true]]);
}
