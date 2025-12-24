<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$me = require_auth($pdo);
require_admin($me);

$body = read_json();
require_fields($body, ['courseId','title','mode','questions']);

$courseId = trim((string)$body['courseId']);
$title = trim((string)$body['title']);
$mode = trim((string)$body['mode']);
$questions = $body['questions'];

if ($courseId === '' || $title === '' || $mode === '') json_response(['success'=>false,'error'=>'Invalid payload'],422);
if (!is_array($questions) || count($questions) < 1) json_response(['success'=>false,'error'=>'questions must be a non-empty array'],422);

$bid = uuidv4();

try {
  $pdo->beginTransaction();

  $pdo->prepare('INSERT INTO banks (id, course_id, title, mode, created_by, created_at)
                 VALUES (:id,:c,:t,:m,:cb,UTC_TIMESTAMP())')
      ->execute([':id'=>$bid,':c'=>$courseId,':t'=>$title,':m'=>$mode,':cb'=>$me['id']]);

  $ins = $pdo->prepare('INSERT INTO questions (id, bank_id, prompt, options, answer_index, explanation, sort_order)
                        VALUES (:id,:bid,:p,:o,:ai,:ex,:so)');

  $i = 0;
  foreach ($questions as $q) {
    $i++;
    $qid = isset($q['id']) && (string)$q['id'] !== '' ? (string)$q['id'] : uuidv4();
    // Accept both legacy keys (prompt/explain) and current keys (question/explanation)
    $prompt = trim((string)($q['question'] ?? $q['prompt'] ?? ''));
    $options = $q['options'] ?? [];
    $answerIndex = (int)($q['answerIndex'] ?? 0);
    $explain = (string)($q['explanation'] ?? $q['explain'] ?? '');

    if ($prompt === '' || !is_array($options) || count($options) < 2) {
      json_response(['success'=>false,'error'=>'Invalid question at index ' . ($i-1)],422);
    }
    if ($answerIndex < 0 || $answerIndex >= count($options)) {
      json_response(['success'=>false,'error'=>'answerIndex out of range at index ' . ($i-1)],422);
    }

    $ins->execute([
      ':id'=>$qid,
      ':bid'=>$bid,
      ':p'=>$prompt,
      ':o'=>json_encode(array_values($options), JSON_UNESCAPED_UNICODE),
      ':ai'=>$answerIndex,
      ':ex'=>$explain,
      ':so'=>$i
    ]);
  }

  $pdo->commit();

  json_response(['success'=>true,'data'=>['bankId'=>$bid]],201);
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  json_response(['success'=>false,'error'=>'Failed to create bank'],500);
}
