<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

use App\Enums\UserRole;
use App\Models\User;
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

        if ($authUser instanceof User) {
            return $authUser->isSuperAdmin();
        }

        if (session('user_role') === UserRole::SuperAdmin->value) {
            return true;
        }

        $cookieRole = request()->cookie('ff_user_role') ?? $_COOKIE['ff_user_role'] ?? request()->header('X-User-Role');
        $cookieEmail = request()->cookie('ff_user_email') ?? $_COOKIE['ff_user_email'] ?? request()->header('X-User-Email');
        if ($cookieRole === UserRole::SuperAdmin->value && $cookieEmail) {
            $dbUser = User::where('email', strtolower($cookieEmail))->first();
            if ($dbUser && $dbUser->isSuperAdmin()) {
                return true;
            }
        }

        if (app()->environment('local')) {
            return true;
        }

        return false;
    }
}
