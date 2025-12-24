<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$departmentId = isset($_GET['departmentId']) ? (string)$_GET['departmentId'] : '';
$level = isset($_GET['level']) ? (int)$_GET['level'] : 0;

$params = [];
$where = [];

$sql = 'SELECT c.id, c.code, c.title, c.level
        FROM courses c';

if ($departmentId !== '') {
  $sql .= ' JOIN course_departments cd ON cd.course_id = c.id';
  $where[] = 'cd.department_id = :d';
  $params[':d'] = $departmentId;
}
if ($level > 0) {
  $where[] = 'c.level = :l';
  $params[':l'] = $level;
}

if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
$sql .= ' ORDER BY c.level, c.code';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll() ?: [];

json_response(['success'=>true,'data'=>['courses'=>$rows]]);
