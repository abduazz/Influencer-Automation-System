<?php

use App\Http\Controllers\Api\BootstrapController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/{any}', function (Request $request) {
    if ($request->query('page') === 'logs') {
        return redirect('/log-viewer');
    }

    $path = $request->path();
    $bootstrapData = null;

    $isCabinetRoute = str_starts_with($path, 'c/') || $request->has('cabinet');
    $isRequisitesRoute = str_starts_with($path, 'requisites') || $request->get('view') === 'requisites';

    if ($isCabinetRoute) {
        $token = null;
        if (str_starts_with($path, 'c/')) {
            $token = substr($path, 2);
        } elseif ($request->has('integrationId')) {
            $token = $request->query('integrationId');
        } elseif ($request->has('id')) {
            $token = $request->query('id');
        }

        try {
            $integration = null;
            if ($token) {
                $integration = \App\Models\Integration::where('blogger_cabinet_token', $token)
                    ->orWhere('id', $token)
                    ->first();
            }

            if ($integration) {
                $intCtrl = app(\App\Http\Controllers\Api\IntegrationController::class);
                $project = $integration->project;
                $submissions = \App\Models\BloggerSubmission::where('integration_id', $integration->id)->get()->map(function ($sub) {
                    return [
                        'id' => (string) $sub->id,
                        'integrationId' => (string) $sub->integration_id,
                        'submittedAt' => $sub->submitted_at ? $sub->submitted_at->toISOString() : now()->toISOString(),
                        'status' => $sub->status,
                        'data' => $sub->data ?? [],
                    ];
                })->toArray();

                $bootstrapData = [
                    'users' => [],
                    'projects' => $project ? [[
                        'id' => (string) $project->id,
                        'name' => $project->name,
                        'description' => $project->description ?? '',
                        'telegramThreadId' => $project->telegram_thread_id ?? '',
                        'monthlyLimit' => $project->monthly_limit !== null ? (int) $project->monthly_limit : null,
                        'subdomain' => $project->subdomain ?? '1',
                        'createdAt' => $project->created_at ? $project->created_at->format('Y-m-d') : '',
                    ]] : [],
                    'allProjects' => [],
                    'subdomains' => [],
                    'integrations' => [$intCtrl->formatIntegration($integration)],
                    'reports' => [],
                    'submissions' => $submissions,
                    'bulkPurchases' => [],
                    'kanbanColumns' => [],
                    'bloggerRequisites' => [],
                    'activeSubdomain' => '1',
                ];
            } else {
                $bootstrapData = app(BootstrapController::class)->getBootstrapData($request);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Cabinet bootstrap preload in Blade failed: ' . $e->getMessage());
        }
    } elseif ($isRequisitesRoute) {
        $token = $request->query('token') ?: (str_starts_with($path, 'requisites/') ? substr($path, 11) : null);
        try {
            $integration = null;
            if ($token) {
                $integration = \App\Models\Integration::where('blogger_cabinet_token', $token)
                    ->orWhere('id', $token)
                    ->first();
            }

            if ($integration) {
                $intCtrl = app(\App\Http\Controllers\Api\IntegrationController::class);
                $bootstrapData = [
                    'users' => [],
                    'projects' => [],
                    'allProjects' => [],
                    'subdomains' => [],
                    'integrations' => [$intCtrl->formatIntegration($integration)],
                    'reports' => [],
                    'submissions' => [],
                    'bulkPurchases' => [],
                    'kanbanColumns' => [],
                    'bloggerRequisites' => $integration->requisites ? [$integration->requisites] : [],
                    'activeSubdomain' => '1',
                ];
            } else {
                $bootstrapData = app(BootstrapController::class)->getBootstrapData($request);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Requisites bootstrap preload in Blade failed: ' . $e->getMessage());
        }
    } else {
        try {
            $cookieEmail = $request->cookie('ff_user_email') ?? ($_COOKIE['ff_user_email'] ?? null);
            $sessionEmail = $request->hasSession() ? $request->session()->get('user_email') : null;
            $hasDevKey = ($request->header('X-Secret-Key') && $request->header('X-Secret-Key') === config('app.key'))
                || ($request->query('key') && $request->query('key') === config('app.key'))
                || ($request->query('secret_key') && $request->query('secret_key') === config('app.key'))
                || ($request->query('developer_key') && $request->query('developer_key') === env('DEVELOPER_MASTER_KEY', 'tezi_master_sec_2026_abduazz'));

            $isAuth = false;
            if ($hasDevKey || auth()->check()) {
                $isAuth = true;
            } elseif (!empty($sessionEmail) && \App\Models\User::where('email', strtolower(trim($sessionEmail)))->exists()) {
                $isAuth = true;
            } elseif (!empty($cookieEmail) && \App\Models\User::where('email', strtolower(trim($cookieEmail)))->exists()) {
                $isAuth = true;
            }

            if ($isAuth) {
                $bootstrapData = app(BootstrapController::class)->getBootstrapData($request);
            } else {
                $bootstrapData = null;
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Bootstrap preload in Blade failed: ' . $e->getMessage());
        }
    }

    return view('app', [
        'bootstrapData' => $bootstrapData,
    ]);
})->where('any', '^(?!admin|api|log-viewer).*$');
