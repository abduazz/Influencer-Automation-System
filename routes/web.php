<?php

use Illuminate\Support\Facades\Route;
use Symfony\Component\Process\Process;

Route::get('/deploy-bash', function () {
    // Run the deploy.sh script from the project root directory
    $process = Process::fromShellCommandline('bash deploy.sh', base_path());
    $process->setTimeout(60); // 1-minute timeout for deploy script
    $process->run();

    if ($process->isSuccessful()) {
        return response('<pre>' . e($process->getOutput()) . '</pre>')
            ->header('Content-Type', 'text/html');
    }

    return response("<h2>Deployment Failed</h2><pre>" . e($process->getErrorOutput() ?: $process->getOutput()) . "</pre>", 500)
        ->header('Content-Type', 'text/html');
});

Route::get('/logs', function () {
    $path = storage_path('logs/laravel.log');
    if (!file_exists($path)) {
        return "Log file not found.";
    }
    $lines = file($path);
    $errors = [];
    foreach ($lines as $line) {
        if (str_contains($line, '.ERROR:') || str_contains($line, 'exception') || str_contains($line, 'Exception')) {
            $errors[] = $line;
        }
    }
    $last_errors = array_slice($errors, -30);
    return response('<pre>' . e(implode("", $last_errors)) . '</pre>')
        ->header('Content-Type', 'text/html');
});

Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!admin|api).*$');
