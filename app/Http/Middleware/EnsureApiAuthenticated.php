<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\AuthService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureApiAuthenticated
{
    public function __construct(
        protected AuthService $authService
    ) {}

    /**
     * Handle an incoming request.
     * Restricts API access to authenticated users, with a secure bypass for developers.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethod('OPTIONS')) {
            return $next($request);
        }

        if ($this->isPublicEndpoint($request)) {
            return $next($request);
        }

        if ($this->isAuthorizedDeveloper($request)) {
            $this->ensureSuperAdminActor();
            return $next($request);
        }

        if ($this->isAuthenticatedUser($request)) {
            return $next($request);
        }

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

        // Auth endpoints
        if ($method === 'POST' && in_array($path, [
            'api/auth/logout',
            'api/auth/migrate-legacy',
            'api/auth/telegram/request-code',
            'api/auth/telegram/verify-code',
            'api/auth/telegram/webapp',
        ], true)) {
            return true;
        }

        if ($method === 'GET' && ($path === 'api/auth/me' || str_starts_with($path, 'api/auth/telegram/otp-status/'))) {
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
        $devKey = env('DEVELOPER_MASTER_KEY');

        if (!empty($appKey) && hash_equals($appKey, $providedKey)) {
            return true;
        }

        if (!empty($devKey) && hash_equals((string) $devKey, $providedKey)) {
            return true;
        }

        return false;
    }

    /**
     * Verify user via server-backed session token (Bearer or HttpOnly cookie) or active web guard.
     */
    protected function isAuthenticatedUser(Request $request): bool
    {
        return $this->authService->resolveUserFromRequest($request) !== null;
    }

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
