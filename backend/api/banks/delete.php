<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'DELETE') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$me = require_auth($pdo);
require_admin($me);

$id = (string)($_GET['id'] ?? '');
if ($id === '') json_response(['success'=>false,'error'=>'Missing id'],422);

$stmt = $pdo->prepare('SELECT id FROM banks WHERE id = :id LIMIT 1');
$stmt->execute([':id'=>$id]);
if (!$stmt->fetch()) json_response(['success'=>false,'error'=>'Not found'],404);

$pdo->beginTransaction();
$pdo->prepare('DELETE FROM questions WHERE bank_id = :id')->execute([':id'=>$id]);
$pdo->prepare('DELETE FROM banks WHERE id = :id')->execute([':id'=>$id]);
$pdo->commit();

json_response(['success'=>true,'data'=>['deleted'=>true]]);
