<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
  json_response([
    'success' => false,
    'error' => 'Method not allowed'
  ], 405);
}

$me = require_auth($pdo);

/**
 * Progress
 */
$stmt = $pdo->prepare(
  'SELECT streak,
          accuracy,
          total_answered AS totalAnswered,
          correct_answered AS correctAnswered,
          study_seconds AS studySeconds,
          last_active AS lastActive
   FROM user_progress
   WHERE user_id = :uid
   LIMIT 1'
);
$stmt->execute([':uid' => $me['id']]);

$p = $stmt->fetch() ?: [
  'streak' => 1,
  'accuracy' => 0,
  'totalAnswered' => 0,
  'correctAnswered' => 0,
  'studySeconds' => 0,
  'lastActive' => gmdate('Y-m-d'),
];

$p = [
  'streak' => (int)$p['streak'],
  'accuracy' => (int)$p['accuracy'],
  'totalAnswered' => (int)$p['totalAnswered'],
  'correctAnswered' => (int)$p['correctAnswered'],
  'studySeconds' => (int)$p['studySeconds'],
  'lastActive' => (string)$p['lastActive'],
];

/**
 * Saved items
 */
$saved = [
  'pastQuestions' => [],
  'materials' => [],
  'questions' => [],
];

$s = $pdo->prepare(
  'SELECT kind, item_id
   FROM saved_items
   WHERE user_id = :uid
   ORDER BY created_at DESC'
);
$s->execute([':uid' => $me['id']]);

foreach ($s->fetchAll() ?: [] as $r) {
  $kind = (string)$r['kind'];
  if (array_key_exists($kind, $saved)) {
    $saved[$kind][] = (string)$r['item_id'];
  }
}

/**
 * Bank stats
 */
$answers = [];
$b = $pdo->prepare(
  'SELECT bank_id, answered_ids, correct_ids
   FROM user_bank_stats
   WHERE user_id = :uid'
);
$b->execute([':uid' => $me['id']]);

foreach ($b->fetchAll() ?: [] as $r) {
  $answers[(string)$r['bank_id']] = [
    'answeredIds' => json_decode((string)$r['answered_ids'], true) ?: [],
    'correctIds' => json_decode((string)$r['correct_ids'], true) ?: [],
  ];
}

json_response([
  'success' => true,
  'data' => [
    'progress' => array_merge($p, ['saved' => $saved]),
    'answers' => $answers,
  ]
]);
