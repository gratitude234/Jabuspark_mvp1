<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$rows = $pdo->query('SELECT id, name FROM faculties ORDER BY name')->fetchAll() ?: [];
json_response(['success'=>true,'data'=>['faculties'=>$rows]]);
