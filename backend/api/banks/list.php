<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
  json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$courseId = isset($_GET['courseId']) ? (string)$_GET['courseId'] : '';

$sql =
  'SELECT b.id,
          b.course_id AS courseId,
          b.title,
          b.mode,
          (SELECT COUNT(*) FROM questions q WHERE q.bank_id = b.id) AS questionCount
   FROM banks b';

if ($courseId !== '') {
  $sql .= ' WHERE b.course_id = :c';
}

// Prefer newest first. (If you have a created_at column, feel free to order by it.)
$sql .= ' ORDER BY b.id DESC';

if ($courseId !== '') {
  $stmt = $pdo->prepare($sql);
  $stmt->execute([':c' => $courseId]);
  $rows = $stmt->fetchAll() ?: [];
} else {
  $rows = $pdo->query($sql)->fetchAll() ?: [];
}

$banks = array_map(static function ($r) {
  $r['questionCount'] = (int)($r['questionCount'] ?? 0);
  return $r;
}, $rows);

json_response([
  'success' => true,
  'data' => [
    'banks' => $banks,
  ],
]);
