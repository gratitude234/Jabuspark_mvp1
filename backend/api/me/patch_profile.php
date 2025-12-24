<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'PATCH') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$user = require_auth($pdo);
$body = read_json();

$facultyId = array_key_exists('facultyId', $body) ? $body['facultyId'] : null;
$departmentId = array_key_exists('departmentId', $body) ? $body['departmentId'] : null;
$level = array_key_exists('level', $body) ? $body['level'] : null;
$courseIds = array_key_exists('courseIds', $body) ? $body['courseIds'] : null;

try {
  $pdo->beginTransaction();

  // Ensure profile exists
  $pdo->prepare('INSERT IGNORE INTO profiles (user_id, faculty_id, department_id, level) VALUES (:uid,NULL,NULL,NULL)')
      ->execute([':uid'=>$user['id']]);

  if ($facultyId !== null || $departmentId !== null || $level !== null) {
    $fields = [];
    $params = [':uid'=>$user['id']];

    if ($facultyId !== null) { $fields[] = 'faculty_id = :f'; $params[':f'] = $facultyId; }
    if ($departmentId !== null) { $fields[] = 'department_id = :d'; $params[':d'] = $departmentId; }
    if ($level !== null) { $fields[] = 'level = :l'; $params[':l'] = (int)$level; }

    $sql = 'UPDATE profiles SET ' . implode(', ', $fields) . ' WHERE user_id = :uid';
    $pdo->prepare($sql)->execute($params);
  }

  if (is_array($courseIds)) {
    $pdo->prepare('DELETE FROM user_courses WHERE user_id = :uid')->execute([':uid'=>$user['id']]);
    $ins = $pdo->prepare('INSERT INTO user_courses (user_id, course_id) VALUES (:uid, :cid)');
    foreach ($courseIds as $cid) {
      $cid = (string)$cid;
      if ($cid === '') continue;
      $ins->execute([':uid'=>$user['id'], ':cid'=>$cid]);
    }
  }

  $pdo->commit();
  json_response(['success'=>true,'data'=>['user'=>safe_user($pdo, $user)]]);
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  json_response(['success'=>false,'error'=>'Profile update failed'],500);
}
