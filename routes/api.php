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

Route::get('/blogger-submissions', [BloggerSubmissionController::class, 'index']);
Route::post('/blogger-submissions', [BloggerSubmissionController::class, 'store']);

Route::get('/logs', [\App\Http\Controllers\Api\LogController::class, 'index']);
Route::delete('/logs', [\App\Http\Controllers\Api\LogController::class, 'destroy']);
