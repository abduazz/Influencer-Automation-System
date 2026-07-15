<?php

use App\Http\Controllers\Api\BloggerSubmissionController;
use App\Http\Controllers\Api\IntegrationController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Artisan;

Route::get('/allowed-users', [UserController::class, 'index']);
Route::post('/allowed-users', [UserController::class, 'store']);
Route::delete('/allowed-users/{user}', [UserController::class, 'destroy']);

Route::get('/projects', [ProjectController::class, 'index']);
Route::post('/projects', [ProjectController::class, 'store']);
Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);

Route::get('/integrations', [IntegrationController::class, 'index']);
Route::post('/integrations', [IntegrationController::class, 'store']);
Route::put('/integrations/{integration}', [IntegrationController::class, 'update']);
Route::delete('/integrations/{integration}', [IntegrationController::class, 'destroy']);

Route::get('/reports', [ReportController::class, 'index']);
Route::post('/reports', [ReportController::class, 'store']);
Route::delete('/reports/{report}', [ReportController::class, 'destroy']);

Route::get('/blogger-submissions', [BloggerSubmissionController::class, 'index']);
Route::post('/blogger-submissions', [BloggerSubmissionController::class, 'store']);
Route::delete('/blogger-submissions/{id}', [BloggerSubmissionController::class, 'destroy']);


Route::get('/logs', [\App\Http\Controllers\Api\LogController::class, 'index']);
Route::delete('/logs', [\App\Http\Controllers\Api\LogController::class, 'destroy']);

Route::get('/shorten-url', function (\Illuminate\Http\Request $request) {
    $url = $request->query('url');
    if (!$url) {
        return response()->json(['error' => 'URL is required'], 400);
    }
    
    try {
        $response = \Illuminate\Support\Facades\Http::timeout(5)->get('https://clck.ru/--', [
            'url' => $url
        ]);
        if ($response->successful()) {
            return response()->json(['short_url' => trim($response->body())]);
        }
    } catch (\Exception $e) {
    }
    
    try {
        $response = \Illuminate\Support\Facades\Http::timeout(5)->get('http://tinyurl.com/api-create.php', [
            'url' => $url
        ]);
        if ($response->successful()) {
            return response()->json(['short_url' => trim($response->body())]);
        }
    } catch (\Exception $e) {
    }

    return response()->json(['short_url' => $url]);
});

Route::get('/clear-server-cache', function () {
    try {
        \Illuminate\Support\Facades\Artisan::call('optimize:clear');
        \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
        return response()->json([
            'success' => true,
            'message' => 'Cache cleared and migrations run successfully!'
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'success' => false,
            'message' => $e->getMessage()
        ], 500);
    }
});
