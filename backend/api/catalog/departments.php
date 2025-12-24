<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$facultyId = isset($_GET['facultyId']) ? (string)$_GET['facultyId'] : '';
if ($facultyId !== '') {
  $stmt = $pdo->prepare('SELECT id, faculty_id AS facultyId, name FROM departments WHERE faculty_id = :f ORDER BY name');
  $stmt->execute([':f'=>$facultyId]);
  $rows = $stmt->fetchAll() ?: [];
} else {
  $rows = $pdo->query('SELECT id, faculty_id AS facultyId, name FROM departments ORDER BY name')->fetchAll() ?: [];
}

json_response(['success'=>true,'data'=>['departments'=>$rows]]);
