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
Route::put('/allowed-users/{user}', [UserController::class, 'update']);
Route::delete('/allowed-users/{user}', [UserController::class, 'destroy']);

Route::get('/projects', [ProjectController::class, 'index']);
Route::post('/projects', [ProjectController::class, 'store']);
Route::put('/projects/{project}', [ProjectController::class, 'update']);
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

Route::get('/bulk-purchases', [\App\Http\Controllers\Api\BulkPurchaseController::class, 'index']);
Route::post('/bulk-purchases', [\App\Http\Controllers\Api\BulkPurchaseController::class, 'store']);
Route::post('/bulk-purchases/{bulkPurchase}/allocate', [\App\Http\Controllers\Api\BulkPurchaseController::class, 'allocate']);
Route::delete('/bulk-purchases/{bulkPurchase}', [\App\Http\Controllers\Api\BulkPurchaseController::class, 'destroy']);


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

Route::get('/debug-telegram', function () {
    $chatId = config('services.telegram.chat_id');
    $subChatId = config('services.telegram.submissions_chat_id');
    $token = config('services.telegram.bot_token');
    return response()->json([
        'chat_id' => $chatId,
        'submissions_chat_id' => $subChatId ?: '(not set, using chat_id fallback)',
        'has_token' => !empty($token),
        'token_prefix' => $token ? substr($token, 0, 8) . '...' : 'MISSING',
    ]);
});

Route::get('/reset-database-prod-secure', function () {
    try {
        // Drop all tables
        \Illuminate\Support\Facades\Artisan::call('db:wipe', ['--force' => true]);
        // Run all migrations fresh
        \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
        // Seed default users (the two super admins)
        \Illuminate\Support\Facades\Artisan::call('db:seed', ['--force' => true]);
        
        return response()->json([
            'success' => true,
            'message' => 'Database wiped, migrated and seeded successfully!'
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'success' => false,
            'message' => $e->getMessage()
        ], 500);
    }
});


