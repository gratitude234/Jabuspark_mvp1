<?php
declare(strict_types=1);

require_once __DIR__ . '/../response.php';
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_response(['success'=>false,'error'=>'Method not allowed'],405);

$me = require_auth($pdo);
require_admin($me);

$title = trim((string)($_POST['title'] ?? ''));
$courseId = trim((string)($_POST['courseId'] ?? ''));
$session = trim((string)($_POST['session'] ?? ''));
$semester = trim((string)($_POST['semester'] ?? ''));

if ($title === '' || $courseId === '') json_response(['success'=>false,'error'=>'title and courseId are required'],422);
if ($session === '') $session = 'Unknown';
if ($semester === '') $semester = 'Unknown';

if (!isset($_FILES['file']) || ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
  json_response(['success'=>false,'error'=>'file is required (multipart form-data field: file)'],422);
}

$f = $_FILES['file'];
$orig = (string)($f['name'] ?? 'file.pdf');
$tmp = (string)($f['tmp_name'] ?? '');
$size = (int)($f['size'] ?? 0);

if ($size <= 0) json_response(['success'=>false,'error'=>'Empty file'],422);
if ($size > 50 * 1024 * 1024) json_response(['success'=>false,'error'=>'File too large (max 50MB)'],413);

$ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
if ($ext === '') $ext = 'pdf';

$dir = UPLOAD_DIR . '/pastquestions';
if (!is_dir($dir)) @mkdir($dir, 0775, true);

$fname = safe_filename(pathinfo($orig, PATHINFO_FILENAME));
$final = $fname . '_' . substr(hash('sha1', random_bytes(16)), 0, 10) . '.' . $ext;

$dest = $dir . '/' . $final;
if (!move_uploaded_file($tmp, $dest)) {
  json_response(['success'=>false,'error'=>'Failed to save file'],500);
}

$id = uuidv4();
$relPath = '/uploads/pastquestions/' . $final;

$stmt = $pdo->prepare('INSERT INTO past_questions (id, course_id, session, semester, title, file_path, uploaded_at, created_by)
                       VALUES (:id,:c,:s,:sem,:t,:fp,UTC_DATE(),:cb)');
$stmt->execute([
  ':id'=>$id, ':c'=>$courseId, ':s'=>$session, ':sem'=>$semester, ':t'=>$title, ':fp'=>$relPath, ':cb'=>$me['id']
]);

json_response(['success'=>true,'data'=>[
  'pastQuestion'=>[
    'id'=>$id,'courseId'=>$courseId,'session'=>$session,'semester'=>$semester,'title'=>$title,
    'fileUrl'=>public_url($relPath),'uploadedAt'=>gmdate('Y-m-d')
  ]
]],201);
