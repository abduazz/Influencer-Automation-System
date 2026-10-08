<?php

use App\Http\Controllers\Api\BootstrapController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/{any}', function (Request $request) {
    $path = $request->path();
    $bootstrapData = null;

    // Only preload for main platform views (bypass for guest blogger cabinet & external requisites)
    $isCabinetRoute = str_starts_with($path, 'c/') || $request->has('cabinet');
    $isRequisitesRoute = str_starts_with($path, 'requisites') || $request->get('view') === 'requisites';

    if (!$isCabinetRoute && !$isRequisitesRoute) {
        try {
            $bootstrapData = app(BootstrapController::class)->getBootstrapData();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Bootstrap preload in Blade failed: ' . $e->getMessage());
        }
    }

    return view('app', [
        'bootstrapData' => $bootstrapData,
    ]);
})->where('any', '^(?!admin|api).*$');
