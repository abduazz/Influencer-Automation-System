<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Support\Facades\Gate;
use Opcodes\LogViewer\Facades\LogViewer;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::define('viewLogViewer', fn ($user = null) => $this->isSuperAdminRequest($user));
        LogViewer::auth(fn ($request) => $this->isSuperAdminRequest($request->user()));
    }

    private function isSuperAdminRequest($user = null): bool
    {
        /** @var User|null $authUser */
        $authUser = $user ?? auth()->user() ?? request()->user();

        if (!$authUser instanceof User) {
            $authUser = app(AuthService::class)->resolveUserFromRequest(request());
        }

        if ($authUser instanceof User) {
            return $authUser->isSuperAdmin();
        }

        if (app()->environment('local')) {
            return true;
        }

        return false;
    }
}
