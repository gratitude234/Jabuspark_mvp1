<?php
declare(strict_types=1);

require_once __DIR__ . '/response.php';
require __DIR__ . '/config.php';

json_response(['success'=>true,'data'=>['name'=>APP_NAME,'status'=>'ok','time'=>gmdate('c')]]);
