<?php

namespace App\Services;

use App\Models\AuthChallenge;
use App\Models\User;
use App\Models\UserSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie as SymfonyCookie;

class AuthService
{
    public const SESSION_COOKIE_NAME = 'tezi_session';
    public const SESSION_TTL_DAYS = 365;
    public const SESSION_TTL_MINUTES = 525600; // 365 * 24 * 60

    /**
     * Create a persisted server session for the authenticated user and return token + cookie.
     *
     * @return array{plainToken: string, session: UserSession, cookie: SymfonyCookie}
     */
    public function createSession(User $user, Request $request, string $authMethod = 'password'): array
    {
        $plainToken = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $plainToken);
        $now = now();

        $session = UserSession::create([
            'user_id' => $user->id,
            'token_hash' => $tokenHash,
            'auth_method' => $authMethod,
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 500, ''),
            'last_used_at' => $now,
            'expires_at' => $now->copy()->addDays(self::SESSION_TTL_DAYS),
        ]);

        $user->forceFill(['last_login_at' => $now])->save();

        Auth::setUser($user);
        $request->setUserResolver(fn () => $user);

        // Clean up expired sessions opportunistically (low overhead)
        if (random_int(1, 20) === 1) {
            UserSession::where('expires_at', '<', $now)->delete();
            AuthChallenge::where('expires_at', '<', $now->copy()->subHours(6))->delete();
        }

        return [
            'plainToken' => $plainToken,
            'session' => $session,
            'cookie' => $this->makeSessionCookie($plainToken, $request),
        ];
    }

    /**
     * Resolve the currently authenticated user from Bearer token, HttpOnly cookie, or web guard.
     */
    public function resolveUserFromRequest(Request $request): ?User
    {
        $existing = Auth::user() ?? $request->user();
        if ($existing instanceof User) {
            return $existing;
        }

        $plainToken = $this->extractTokenFromRequest($request);
        if (!empty($plainToken)) {
            $tokenHash = hash('sha256', $plainToken);
            $session = UserSession::with('user')
                ->where('token_hash', $tokenHash)
                ->where('expires_at', '>', now())
                ->first();

            if ($session && $session->user instanceof User) {
                // Sliding expiration: refresh timestamps at most once per hour
                if ($session->last_used_at === null || $session->last_used_at->lt(now()->subHour())) {
                    $session->forceFill([
                        'last_used_at' => now(),
                        'expires_at' => now()->addDays(self::SESSION_TTL_DAYS),
                    ])->save();
                }

                Auth::setUser($session->user);
                $request->setUserResolver(fn () => $session->user);

                return $session->user;
            }
        }

        // Check Filament / standard Laravel web session if active
        try {
            $webUser = Auth::guard('web')->user();
            if ($webUser instanceof User) {
                Auth::setUser($webUser);
                $request->setUserResolver(fn () => $webUser);
                return $webUser;
            }
        } catch (\Throwable $e) {
            // Stateless requests without session middleware ignore web guard lookup
        }

        // Seamless legacy transition: keep already-logged-in users signed in on deploy
        if ($this->isLegacyMigrationEnabled()) {
            $legacyUser = $this->resolveLegacyUserFromRequest($request);
            if ($legacyUser instanceof User) {
                $request->attributes->set('tezi_needs_legacy_upgrade', true);
                Auth::setUser($legacyUser);
                $request->setUserResolver(fn () => $legacyUser);
                return $legacyUser;
            }
        }

        return null;
    }

    public function isLegacyMigrationEnabled(): bool
    {
        $val = env('LEGACY_SESSION_MIGRATION', true);
        return filter_var($val, FILTER_VALIDATE_BOOLEAN);
    }

    protected function resolveLegacyUserFromRequest(Request $request): ?User
    {
        $sessionEmail = null;
        try {
            if ($request->hasSession() && $request->session()->has('user_email')) {
                $sessionEmail = strtolower(trim((string) $request->session()->get('user_email')));
            }
        } catch (\Throwable $e) {
        }

        $rawCookie = $request->cookie('ff_user_email') ?? ($_COOKIE['ff_user_email'] ?? null);
        $cookieEmail = is_string($rawCookie) && trim($rawCookie) !== ''
            ? strtolower(trim(urldecode($rawCookie)))
            : null;

        $email = $sessionEmail ?: $cookieEmail;
        if (empty($email)) {
            return null;
        }

        return User::whereRaw('LOWER(email) = ?', [$email])->first();
    }

    /**
     * Extract opaque session token from Authorization Bearer header or tezi_session cookie.
     */
    public function extractTokenFromRequest(Request $request): ?string
    {
        $bearer = $request->bearerToken();
        if (!empty($bearer) && strlen($bearer) >= 32) {
            return trim($bearer);
        }

        $cookieVal = $request->cookie(self::SESSION_COOKIE_NAME) ?? ($_COOKIE[self::SESSION_COOKIE_NAME] ?? null);
        if (is_string($cookieVal) && strlen(trim($cookieVal)) >= 32) {
            return trim($cookieVal);
        }

        return null;
    }

    /**
     * Revoke current session (or all sessions for the user) and return cookie-clearing headers.
     *
     * @return array<int, SymfonyCookie>
     */
    public function revokeSession(Request $request, bool $allDevices = false): array
    {
        $plainToken = $this->extractTokenFromRequest($request);
        $user = $this->resolveUserFromRequest($request);

        if ($allDevices && $user) {
            UserSession::where('user_id', $user->id)->delete();
        } elseif (!empty($plainToken)) {
            UserSession::where('token_hash', hash('sha256', $plainToken))->delete();
        }

        return $this->makeClearCookies($request);
    }

    /**
     * Build an HttpOnly session cookie scoped to root domain (e.g. .tezi.uz) when on subdomains.
     */
    public function makeSessionCookie(string $plainToken, Request $request): SymfonyCookie
    {
        $domain = $this->resolveCookieDomain($request);
        $secure = $this->shouldUseSecureCookie($request);

        return cookie(
            self::SESSION_COOKIE_NAME,
            $plainToken,
            self::SESSION_TTL_MINUTES,
            '/',
            $domain,
            $secure,
            true,  // httpOnly
            false, // raw
            'lax'
        );
    }

    /**
     * Clear tezi_session (both host-only and root-domain) and legacy ff_user_* cookies.
     *
     * @return array<int, SymfonyCookie>
     */
    public function makeClearCookies(Request $request): array
    {
        $domain = $this->resolveCookieDomain($request);
        $cookies = [
            Cookie::forget(self::SESSION_COOKIE_NAME, '/', null),
            Cookie::forget('ff_user_email', '/', null),
            Cookie::forget('ff_user_role', '/', null),
        ];

        if ($domain !== null) {
            $cookies[] = Cookie::forget(self::SESSION_COOKIE_NAME, '/', $domain);
            $cookies[] = Cookie::forget('ff_user_email', '/', $domain);
            $cookies[] = Cookie::forget('ff_user_role', '/', $domain);
        }

        return $cookies;
    }

    /**
     * Create a short-lived auth challenge (Deep-Link login, Telegram link, OTP, or Magic Invite).
     */
    public function createChallenge(string $type, ?User $user = null, int $ttlSeconds = 300, ?string $plainCode = null): AuthChallenge
    {
        return AuthChallenge::create([
            'token' => bin2hex(random_bytes(24)),
            'type' => $type,
            'user_id' => $user?->id,
            'code_hash' => $plainCode !== null ? hash('sha256', $plainCode) : null,
            'status' => 'pending',
            'expires_at' => now()->addSeconds($ttlSeconds),
        ]);
    }

    /**
     * Verify Telegram WebApp (Mini App) initData using HMAC-SHA256 per Telegram Bot API spec.
     *
     * @return array{id: string, username: ?string, first_name: ?string, last_name: ?string}|null
     */
    public function verifyTelegramWebAppInitData(string $initData, ?string $botToken): ?array
    {
        $initData = trim($initData);
        if ($initData === '' || empty($botToken)) {
            return null;
        }

        $pairs = explode('&', $initData);
        $data = [];
        $providedHash = null;

        foreach ($pairs as $pair) {
            if (!str_contains($pair, '=')) {
                continue;
            }
            [$rawKey, $rawVal] = explode('=', $pair, 2);
            $key = urldecode($rawKey);
            $val = urldecode($rawVal);

            if ($key === 'hash') {
                $providedHash = $val;
            } else {
                $data[$key] = $val;
            }
        }

        if (empty($providedHash) || empty($data['auth_date'])) {
            return null;
        }

        // Reject stale initData older than 24 hours
        $authDate = (int) $data['auth_date'];
        if ($authDate <= 0 || abs(time() - $authDate) > 86400) {
            return null;
        }

        ksort($data);
        $checkParts = [];
        foreach ($data as $k => $v) {
            $checkParts[] = $k . '=' . $v;
        }
        $dataCheckString = implode("\n", $checkParts);

        $secretKey = hash_hmac('sha256', $botToken, 'WebAppData', true);
        $calculatedHash = hash_hmac('sha256', $dataCheckString, $secretKey);

        if (!hash_equals($calculatedHash, strtolower($providedHash))) {
            return null;
        }

        if (empty($data['user'])) {
            return null;
        }

        $userObj = json_decode($data['user'], true);
        if (!is_array($userObj) || empty($userObj['id'])) {
            return null;
        }

        return [
            'id' => (string) $userObj['id'],
            'username' => !empty($userObj['username']) ? '@' . ltrim((string) $userObj['username'], '@') : null,
            'first_name' => $userObj['first_name'] ?? null,
            'last_name' => $userObj['last_name'] ?? null,
        ];
    }

    /**
     * Standard user JSON payload for frontend SPA.
     */
    public function formatUserPayload(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'telegramId' => $user->telegram_id,
            'telegramUsername' => $user->telegram_username,
            'hasTelegramLinked' => !empty($user->telegram_id),
            'allowedMetrics' => $user->allowed_metrics ?? ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
            'allowedPages' => $user->allowed_pages ?? ['projects', 'kanban', 'requisites_directory', 'bloggers', 'reports', 'bulk_purchases', 'reports_feed', 'other_expenses'],
            'allowedProjects' => $user->allowed_projects ?? [],
            'allowedSubdomains' => $user->allowed_subdomains ?? [],
            'createdAt' => $user->created_at ? $user->created_at->format('Y-m-d') : '',
        ];
    }

    public function resolveCookieDomain(Request $request): ?string
    {
        $configured = config('session.domain');
        if (!empty($configured)) {
            return $configured;
        }

        $host = strtolower($request->getHost());
        if ($host === '' || $host === 'localhost' || filter_var($host, FILTER_VALIDATE_IP)) {
            return null;
        }

        if ($host === 'tezi.uz' || str_ends_with($host, '.tezi.uz')) {
            return '.tezi.uz';
        }

        return null;
    }

    protected function shouldUseSecureCookie(Request $request): bool
    {
        if ($request->isSecure()) {
            return true;
        }

        $proto = strtolower((string) $request->header('X-Forwarded-Proto', ''));
        return $proto === 'https';
    }
}
