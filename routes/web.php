<?php

use Illuminate\Support\Facades\Route;
use Symfony\Component\Process\Process;

Route::get('/deploy-bash', function () {
    // Run the deploy.sh script from the project root directory
    $process = Process::fromShellCommandline('bash deploy.sh', base_path());
    $process->setTimeout(60); // 1-minute timeout for deploy script
    $process->run();

    if ($process->isSuccessful()) {
        return response()
            ->setContent('<pre>' . e($process->getOutput()) . '</pre>')
            ->header('Content-Type', 'text/html');
    }

    return response()
        ->setContent("<h2>Deployment Failed</h2><pre>" . e($process->getErrorOutput() ?: $process->getOutput()) . "</pre>")
        ->setStatusCode(500)
        ->header('Content-Type', 'text/html');
});

Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!admin|api).*$');
