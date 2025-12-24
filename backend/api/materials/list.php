<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$courseId = isset($_GET['courseId']) ? (string)$_GET['courseId'] : '';

if ($courseId !== '') {
  $stmt = $pdo->prepare('SELECT id, course_id AS courseId, title, type, file_path, uploaded_at AS uploadedAt, tags
                         FROM materials WHERE course_id = :c ORDER BY uploaded_at DESC');
  $stmt->execute([':c'=>$courseId]);
  $rows = $stmt->fetchAll() ?: [];
} else {
  $rows = $pdo->query('SELECT id, course_id AS courseId, title, type, file_path, uploaded_at AS uploadedAt, tags
                       FROM materials ORDER BY uploaded_at DESC')->fetchAll() ?: [];
}

$items = array_map(function($r){
  $r['fileUrl'] = public_url((string)$r['file_path']);
  unset($r['file_path']);
  $r['tags'] = json_get($r['tags'] ?? null, []);
  return $r;
}, $rows);

json_response(['success'=>true,'data'=>['materials'=>$items]]);
