<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$me = require_auth($pdo);
$body = read_json();
require_fields($body, ['bankId','questionId','selectedIndex']);

$bankId = (string)$body['bankId'];
$qid = (string)$body['questionId'];
$selectedIndex = (int)$body['selectedIndex'];
$secondsSpent = isset($body['secondsSpent']) ? (int)$body['secondsSpent'] : 0;

$q = $pdo->prepare('SELECT id, prompt AS question, options, answer_index AS answerIndex, explanation AS explanation FROM questions WHERE bank_id = :bid AND id = :id LIMIT 1');
$q->execute([':bid'=>$bankId, ':id'=>$qid]);
$row = $q->fetch();
if (!$row) json_response(['success'=>false,'error'=>'Question not found'],404);

$options = json_decode((string)$row['options'], true) ?: [];
$answerIndex = (int)$row['answerIndex'];
$isCorrect = ($selectedIndex === $answerIndex);

try {
  $pdo->beginTransaction();

  // ---- user_bank_stats upsert
  $stmt = $pdo->prepare('SELECT answered_ids, correct_ids FROM user_bank_stats WHERE user_id = :uid AND bank_id = :bid LIMIT 1');
  $stmt->execute([':uid'=>$me['id'],':bid'=>$bankId]);
  $s = $stmt->fetch();

  $answered = $s ? (json_decode((string)$s['answered_ids'], true) ?: []) : [];
  $correct = $s ? (json_decode((string)$s['correct_ids'], true) ?: []) : [];

  if (!in_array($qid, $answered, true)) $answered[] = $qid;
  if ($isCorrect && !in_array($qid, $correct, true)) $correct[] = $qid;

  if ($s) {
    $pdo->prepare('UPDATE user_bank_stats SET answered_ids = :a, correct_ids = :c, updated_at = UTC_TIMESTAMP()
                   WHERE user_id = :uid AND bank_id = :bid')
        ->execute([
          ':a'=>json_encode(array_values($answered), JSON_UNESCAPED_UNICODE),
          ':c'=>json_encode(array_values($correct), JSON_UNESCAPED_UNICODE),
          ':uid'=>$me['id'], ':bid'=>$bankId
        ]);
  } else {
    $pdo->prepare('INSERT INTO user_bank_stats (user_id, bank_id, answered_ids, correct_ids, updated_at)
                   VALUES (:uid,:bid,:a,:c,UTC_TIMESTAMP())')
        ->execute([
          ':uid'=>$me['id'], ':bid'=>$bankId,
          ':a'=>json_encode(array_values($answered), JSON_UNESCAPED_UNICODE),
          ':c'=>json_encode(array_values($correct), JSON_UNESCAPED_UNICODE),
        ]);
  }

  // ---- user_progress upsert
  $p = $pdo->prepare('SELECT streak, total_answered, correct_answered, study_seconds, last_active FROM user_progress WHERE user_id = :uid LIMIT 1');
  $p->execute([':uid'=>$me['id']]);
  $pr = $p->fetch();

  $today = today_iso_date();
  $yesterday = (new DateTimeImmutable($today, new DateTimeZone('UTC')))->modify('-1 day')->format('Y-m-d');

  $streak = 1;
  $totalAnswered = 0;
  $correctAnswered = 0;
  $studySeconds = 0;
  $lastActive = $today;

  if ($pr) {
    $streak = (int)$pr['streak'];
    $totalAnswered = (int)$pr['total_answered'];
    $correctAnswered = (int)$pr['correct_answered'];
    $studySeconds = (int)$pr['study_seconds'];
    $lastActive = (string)$pr['last_active'];
  } else {
    $pdo->prepare('INSERT INTO user_progress (user_id, streak, accuracy, total_answered, correct_answered, study_seconds, last_active)
                   VALUES (:uid, 1, 0, 0, 0, 0, :d)')
        ->execute([':uid'=>$me['id'], ':d'=>$today]);
  }

  if ($lastActive !== $today) {
    if ($lastActive === $yesterday) $streak = max(1, $streak + 1);
    else $streak = 1;
  }

  $totalAnswered += 1;
  if ($isCorrect) $correctAnswered += 1;
  $studySeconds += max(0, $secondsSpent);

  $accuracy = $totalAnswered ? (int)round(($correctAnswered / $totalAnswered) * 100) : 0;

  $pdo->prepare('UPDATE user_progress
                 SET streak = :s, accuracy = :a, total_answered = :t, correct_answered = :c,
                     study_seconds = :ss, last_active = :d
                 WHERE user_id = :uid')
      ->execute([
        ':s'=>$streak, ':a'=>$accuracy, ':t'=>$totalAnswered, ':c'=>$correctAnswered,
        ':ss'=>$studySeconds, ':d'=>$today, ':uid'=>$me['id']
      ]);

  $pdo->commit();

  json_response(['success'=>true,'data'=>[
    'result'=>[
      'bankId'=>$bankId,
      'questionId'=>$qid,
      'selectedIndex'=>$selectedIndex,
      'answerIndex'=>$answerIndex,
      'isCorrect'=>$isCorrect,
      'explanation'=>$row['explanation'] ?? '',
    ],
    'progress'=>[
      'streak'=>$streak,
      'accuracy'=>$accuracy,
      'totalAnswered'=>$totalAnswered,
      'correctAnswered'=>$correctAnswered,
      'studySeconds'=>$studySeconds,
      'lastActive'=>$today,
    ],
    'bankStats'=>[
      'answeredIds'=>$answered,
      'correctIds'=>$correct,
    ]
  ]]);
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  json_response(['success'=>false,'error'=>'Failed to submit answer'],500);
}
