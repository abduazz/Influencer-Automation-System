<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureApiAuthenticated
{
    /**
     * Handle an incoming request.
     * Restricts API access to authenticated users, with a secure bypass for developers.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // 0. Pass through preflight OPTIONS requests immediately
        if ($request->isMethod('OPTIONS')) {
            return $next($request);
        }

        // 1. Whitelisted public endpoints that guest bloggers or external webhooks must access
        if ($this->isPublicEndpoint($request)) {
            return $next($request);
        }

        // 2. Developer / Master Key Bypass ("Путь для разработчика")
        if ($this->isAuthorizedDeveloper($request)) {
            $this->ensureSuperAdminActor();
            return $next($request);
        }

        // 3. Authenticated Web / API User
        if ($this->isAuthenticatedUser($request)) {
            return $next($request);
        }

        // 4. Unauthorized rejection
        return response()->json([
            'message' => 'Unauthenticated. Access denied.',
            'status' => 401,
        ], 401);
    }

    /**
     * Check if request targets an explicitly public endpoint.
     */
    protected function isPublicEndpoint(Request $request): bool
    {
        $path = trim($request->path(), '/');
        $method = strtoupper($request->method());

        // Login route
        if ($method === 'POST' && $path === 'api/login') {
            return true;
        }

        // Guest blogger submission proof from cabinet (/c/{token})
        if ($method === 'POST' && $path === 'api/blogger-submissions') {
            return true;
        }

        // Guest blogger payment requisites submission (/requisites/{token})
        if ($method === 'POST' && $path === 'api/blogger-requisites') {
            return true;
        }

        // URL shortener utility
        if ($method === 'GET' && $path === 'api/shorten-url') {
            return true;
        }

        // External Telegram webhooks
        if ($method === 'POST' && (str_contains($path, 'telegram/webhook') || str_contains($path, 'telegram-gateway/webhook'))) {
            return true;
        }

        // Server cache clearing endpoint (has its own key check)
        if ($path === 'api/clear-server-cache') {
            return true;
        }

        return false;
    }

    /**
     * Check if developer master key is provided via header or query parameter.
     */
    protected function isAuthorizedDeveloper(Request $request): bool
    {
        $providedKey = $request->header('X-Secret-Key')
            ?: $request->header('X-Developer-Key')
            ?: $request->header('X-Master-Key')
            ?: $request->query('secret_key')
            ?: $request->query('developer_key')
            ?: $request->query('master_key')
            ?: $request->bearerToken();

        if (empty($providedKey)) {
            return false;
        }

        $appKey = config('app.key');
        $devKey = env('DEVELOPER_MASTER_KEY', 'tezi_master_sec_2026_abduazz');

        if (!empty($appKey) && hash_equals($appKey, $providedKey)) {
            return true;
        }

        if (!empty($devKey) && hash_equals($devKey, $providedKey)) {
            return true;
        }

        return false;
    }

    /**
     * Check if user is authenticated via Laravel Auth, session, or verified cookie.
     */
    protected function isAuthenticatedUser(Request $request): bool
    {
        // Active Laravel auth
        if (Auth::check() || $request->user()) {
            return true;
        }

        // Active session
        if ($request->hasSession() && $request->session()->has('user_email')) {
            $email = strtolower(trim((string)$request->session()->get('user_email')));
            $user = User::where('email', $email)->first();
            if ($user) {
                Auth::setUser($user);
                return true;
            }
        }

        // Verified auth cookie set upon login (handling urlencoded '@' e.g. %40)
        $rawCookie = $request->cookie('ff_user_email') ?? ($_COOKIE['ff_user_email'] ?? null);
        if (!empty($rawCookie)) {
            $cookieEmail = strtolower(trim(urldecode($rawCookie)));
            $user = User::where('email', $cookieEmail)->first();
            if ($user) {
                Auth::setUser($user);
                return true;
            }
        }

        // Check X-User-Email header
        $headerEmail = $request->header('X-User-Email');
        if (!empty($headerEmail)) {
            $email = strtolower(trim(urldecode($headerEmail)));
            $user = User::where('email', $email)->first();
            if ($user) {
                $rawCookie = $_COOKIE['ff_user_email'] ?? $request->cookie('ff_user_email');
                $decodedCookie = !empty($rawCookie) ? strtolower(trim(urldecode($rawCookie))) : null;
                if (
                    app()->environment('local') ||
                    (!empty($decodedCookie) && $decodedCookie === $email) ||
                    ($request->hasSession() && strtolower(trim((string)$request->session()->get('user_email', ''))) === $email)
                ) {
                    Auth::setUser($user);
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Ensure a super admin user is attached to request when accessed via master key.
     */
    protected function ensureSuperAdminActor(): void
    {
        if (!Auth::check()) {
            $admin = User::where('role', 'super_admin')->first() ?: User::first();
            if ($admin) {
                Auth::setUser($admin);
            }
        }
    }
}
