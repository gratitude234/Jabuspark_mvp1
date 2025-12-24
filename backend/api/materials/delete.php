<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'DELETE') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$me = require_auth($pdo);
require_admin($me);

$id = (string)($_GET['id'] ?? '');
if ($id === '') json_response(['success'=>false,'error'=>'Missing id'],422);

$stmt = $pdo->prepare('SELECT file_path FROM materials WHERE id = :id LIMIT 1');
$stmt->execute([':id'=>$id]);
$row = $stmt->fetch();
if (!$row) json_response(['success'=>false,'error'=>'Not found'],404);

$pdo->prepare('DELETE FROM materials WHERE id = :id')->execute([':id'=>$id]);

$fp = (string)$row['file_path'];
$abs = __DIR__ . '/..' . $fp;
if (is_file($abs)) @unlink($abs);

json_response(['success'=>true,'data'=>['deleted'=>true]]);
