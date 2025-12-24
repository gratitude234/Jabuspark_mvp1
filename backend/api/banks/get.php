<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
  json_response([
    'success' => false,
    'error' => 'Method not allowed'
  ], 405);
}

$id = (string)($_GET['id'] ?? '');
if ($id === '') {
  json_response([
    'success' => false,
    'error' => 'Missing id'
  ], 422);
}

$stmt = $pdo->prepare(
  'SELECT id, course_id AS courseId, title, mode
   FROM banks
   WHERE id = :id
   LIMIT 1'
);
$stmt->execute([':id' => $id]);

$bank = $stmt->fetch();
if (!$bank) {
  json_response([
    'success' => false,
    'error' => 'Not found'
  ], 404);
}

$q = $pdo->prepare(
  'SELECT id,
          prompt AS question,
          options,
          answer_index AS answerIndex,
          explanation AS explanation
   FROM questions
   WHERE bank_id = :id
   ORDER BY sort_order ASC, id ASC'
);
$q->execute([':id' => $id]);

$questions = array_map(static function ($r) {
  $r['options'] = json_decode((string)$r['options'], true) ?: [];
  $r['answerIndex'] = (int)$r['answerIndex'];
  return $r;
}, $q->fetchAll() ?: []);

$bank['questions'] = $questions;

json_response([
  'success' => true,
  'data' => [
    'bank' => $bank
  ]
]);
