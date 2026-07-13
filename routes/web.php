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

Route::get('/check-env', function () {
    $token = config('services.telegram.bot_token');
    $masked_token = $token ? (substr($token, 0, 10) . '...' . substr($token, -5)) : 'NOT SET';
    
    return response()->json([
        'TELEGRAM_BOT_TOKEN_MASKED' => $masked_token,
        'TELEGRAM_REPORTS_CHAT_ID' => config('services.telegram.reports_chat_id', 'NOT SET'),
        'TELEGRAM_SUBMISSIONS_CHAT_ID' => config('services.telegram.submissions_chat_id', 'NOT SET'),
        'TELEGRAM_CHAT_ID' => config('services.telegram.chat_id', 'NOT SET'),
    ]);
});

Route::get('/setup-telegram', function () {
    $path = base_path('.env');
    if (!file_exists($path)) {
        return "env file not found.";
    }
    
    $content = file_get_contents($path);
    $added = false;
    
    if (!str_contains($content, 'TELEGRAM_BOT_TOKEN=')) {
        $content .= "\nTELEGRAM_BOT_TOKEN=8618987059:AAF0YBxGMpXMsGE98N2NZS1oWrSmaCUUhvI";
        $added = true;
    }
    if (!str_contains($content, 'TELEGRAM_REPORTS_CHAT_ID=')) {
        $content .= "\nTELEGRAM_REPORTS_CHAT_ID=-4904683057";
        $added = true;
    }
    if (!str_contains($content, 'TELEGRAM_SUBMISSIONS_CHAT_ID=')) {
        $content .= "\nTELEGRAM_SUBMISSIONS_CHAT_ID=-4140182239";
        $added = true;
    }
    
    if ($added) {
        file_put_contents($path, $content);
        return "Telegram configurations appended successfully. Please run /deploy-bash to refresh configuration cache.";
    }
    
    return "Telegram configurations already set or nothing added.";
});

Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!admin|api).*$');
