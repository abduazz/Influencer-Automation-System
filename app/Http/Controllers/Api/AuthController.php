<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuthChallenge;
use App\Models\User;
use App\Models\UserSession;
use App\Services\ActivityLogger;
use App\Services\AuthService;
use App\Services\TelegramService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    public function __construct(
        protected AuthService $authService
    ) {}

    /**
     * Return current authenticated user (always 200 so unauthenticated page loads stay clean).
     */
    public function me(Request $request): JsonResponse
    {
        $user = $this->authService->resolveUserFromRequest($request);

        if ($user && $request->attributes->get('tezi_needs_legacy_upgrade')) {
            return $this->issueSessionResponse($user, $request, 'legacy_migrated', [
                'authenticated' => true,
            ]);
        }

        return response()->json([
            'authenticated' => $user !== null,
            'user' => $user ? $this->authService->formatUserPayload($user) : null,
        ]);
    }

    /**
     * Silently upgrade an existing client-cached legacy session (from before deploy) to a 365-day server session.
     */
    public function migrateLegacy(Request $request): JsonResponse
    {
        if (!$this->authService->isLegacyMigrationEnabled()) {
            return response()->json(['message' => 'Legacy migration disabled.'], 403);
        }

        $request->validate([
            'email' => 'required|string|max:255',
        ]);

        $email = strtolower(trim(urldecode((string) $request->input('email'))));
        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        return $this->issueSessionResponse($user, $request, 'legacy_migrated');
    }

    /**
     * Step 1: Verify login exists in DB and send a 4-digit one-time code privately.
     * If employee has not started the bot yet (telegram_id is null), returns activation url once.
     */
    public function telegramRequestCode(Request $request): JsonResponse
    {
        $request->validate([
            'username' => 'required|string|max:120',
        ]);

        $rawUsername = trim((string) $request->input('username'));
        $cleanHandle = ltrim(mb_strtolower($rawUsername), '@');

        if ($cleanHandle === '') {
            return response()->json([
                'message' => 'Введите ваш логин.',
            ], 422);
        }

        $ipThrottleKey = 'tg-otp-ip:' . $request->ip() . ':' . $cleanHandle;
        if (RateLimiter::tooManyAttempts($ipThrottleKey, 5)) {
            $seconds = RateLimiter::availableIn($ipThrottleKey);
            return response()->json([
                'message' => "Слишком много попыток. Повторите через {$seconds} сек.",
            ], 429);
        }

        $user = User::findByTelegramUsername($cleanHandle);
        if (!$user) {
            RateLimiter::hit($ipThrottleKey, 300);
            ActivityLogger::auth('LOGIN_FAILED', "Попытка входа с несуществующим логином '@{$cleanHandle}'", [
                'telegram_username' => '@' . $cleanHandle,
            ], 'warning', $request);

            return response()->json([
                'message' => 'Доступ запрещён. Логин не найден в системе.',
            ], 404);
        }

        $userThrottleKey = 'tg-otp-user:' . $user->id;
        if (RateLimiter::tooManyAttempts($userThrottleKey, 1)) {
            $seconds = RateLimiter::availableIn($userThrottleKey);
            return response()->json([
                'message' => "Код уже отправлен. Повторный запрос через {$seconds} сек.",
            ], 429);
        }

        RateLimiter::hit($ipThrottleKey, 900);
        RateLimiter::hit($userThrottleKey, 25);

        AuthChallenge::where('user_id', $user->id)
            ->where('type', 'telegram_otp')
            ->where('status', 'pending')
            ->update(['status' => 'expired']);

        $code = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        $challenge = $this->authService->createChallenge('telegram_otp', $user, 300, $code);

        // Case A: Employee already activated bot -> send 4-digit code immediately
        if (!empty($user->telegram_id)) {
            $messageText = "🔐 <b>Ваш одноразовый код для входа в Tezi.uz:</b>\n\n"
                . "👉 <code>{$code}</code>\n\n"
                . "Сотрудник: <b>" . htmlspecialchars($user->name, ENT_QUOTES, 'UTF-8') . "</b>\n"
                . "Код действителен 5 минут. Никому его не передавайте.";

            $sent = TelegramService::sendMessage($user->telegram_id, $messageText);

            if ($sent) {
                return response()->json([
                    'challengeToken' => $challenge->token,
                    'needsBotStart' => false,
                    'expiresIn' => 300,
                ]);
            }
        }

        // Case B: First-time activation required once so bot can DM this user
        $botUsername = TelegramService::getBotUsername() ?: 'AI_Buxgalter_private_bot';
        cache()->put("tg_otp_plain:{$challenge->token}", $code, now()->addMinutes(6));

        return response()->json([
            'challengeToken' => $challenge->token,
            'needsBotStart' => true,
            'botUrl' => "https://t.me/{$botUsername}?start=otp_{$challenge->token}",
            'expiresIn' => 300,
        ]);
    }

    /**
     * Poll during Case B (first-time /start otp_<token>) so UI knows when the code was delivered.
     */
    public function telegramOtpStatus(Request $request, string $token): JsonResponse
    {
        $challenge = AuthChallenge::where('token', $token)
            ->where('type', 'telegram_otp')
            ->first();

        if (!$challenge || $challenge->isExpired() || $challenge->status === 'expired') {
            return response()->json(['status' => 'expired']);
        }

        if (empty($challenge->telegram_id) && app()->environment('local')) {
            app(TelegramChatController::class)->syncLocalPrivateAuthUpdates();
            $challenge->refresh();
        }

        return response()->json([
            'status' => !empty($challenge->telegram_id) ? 'code_sent' : 'waiting_start',
        ]);
    }

    /**
     * Step 2: Verify the 4-digit OTP code and create a long-lived (365 days) session.
     */
    public function telegramVerifyCode(Request $request): JsonResponse
    {
        $request->validate([
            'challengeToken' => 'required|string|max:128',
            'code' => 'required|string|max:12',
        ]);

        $challenge = AuthChallenge::with('user')
            ->where('token', (string) $request->input('challengeToken'))
            ->where('type', 'telegram_otp')
            ->first();

        if (!$challenge || $challenge->isExpired() || $challenge->status !== 'pending') {
            return response()->json([
                'message' => 'Срок действия кода истёк. Запросите новый код.',
            ], 422);
        }

        if ($challenge->attempts >= 5) {
            $challenge->update(['status' => 'expired']);
            return response()->json([
                'message' => 'Превышено число попыток (5). Запросите новый код.',
            ], 429);
        }

        $cleanCode = preg_replace('/\D+/', '', (string) $request->input('code'));
        if ($cleanCode === '' || empty($challenge->code_hash) || !hash_equals($challenge->code_hash, hash('sha256', $cleanCode))) {
            $challenge->increment('attempts');
            $left = max(0, 5 - $challenge->attempts);
            return response()->json([
                'message' => $left > 0
                    ? "Неверный код. Осталось попыток: {$left}."
                    : 'Превышено число попыток. Запросите новый код.',
            ], 422);
        }

        if (!$challenge->user instanceof User) {
            return response()->json(['message' => 'Пользователь не найден.'], 404);
        }

        $updated = AuthChallenge::where('id', $challenge->id)
            ->where('status', 'pending')
            ->update(['status' => 'consumed']);

        if ($updated === 0) {
            return response()->json(['message' => 'Код уже использован.'], 422);
        }

        cache()->forget("tg_otp_plain:{$challenge->token}");

        return $this->issueSessionResponse($challenge->user, $request, 'telegram_otp');
    }

    /**
     * Authenticate inside Telegram Mini App using cryptographically verified initData.
     */
    public function telegramWebApp(Request $request): JsonResponse
    {
        $request->validate([
            'initData' => 'required|string',
        ]);

        $botToken = config('services.telegram.bot_token');
        $tgUser = $this->authService->verifyTelegramWebAppInitData(
            (string) $request->input('initData'),
            $botToken
        );

        if (!$tgUser) {
            return response()->json([
                'message' => 'Не удалось проверить подпись сеанса.',
            ], 401);
        }

        $user = User::where('telegram_id', $tgUser['id'])->first();
        if (!$user && !empty($tgUser['username'])) {
            $user = User::findByTelegramUsername($tgUser['username']);
        }

        if (!$user) {
            return response()->json([
                'needsInvite' => true,
                'message' => 'Доступ запрещён.',
            ], 403);
        }

        $updates = [];
        if ($user->telegram_id !== $tgUser['id']) {
            $updates['telegram_id'] = $tgUser['id'];
        }
        if (!empty($tgUser['username']) && $user->telegram_username !== $tgUser['username']) {
            $updates['telegram_username'] = $tgUser['username'];
        }
        if (!empty($updates)) {
            $user->forceFill($updates)->save();
        }

        return $this->issueSessionResponse($user, $request, 'telegram_webapp');
    }

    /**
     * Log out current session (or all devices) and clear cookies.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $this->authService->resolveUserFromRequest($request);
        $allDevices = $request->boolean('allDevices', false);
        $clearCookies = $this->authService->revokeSession($request, $allDevices);

        if ($user) {
            ActivityLogger::auth('LOGOUT', "Выход пользователя: {$user->email}", [
                'user_id' => $user->id,
                'all_devices' => $allDevices,
            ], 'info', $request);
        }

        $response = response()->json(['success' => true]);
        foreach ($clearCookies as $cookie) {
            $response->withCookie($cookie);
        }

        return $response;
    }

    /**
     * List active sessions for the authenticated user.
     */
    public function listSessions(Request $request): JsonResponse
    {
        $user = $this->authService->resolveUserFromRequest($request);
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $currentToken = $this->authService->extractTokenFromRequest($request);
        $currentHash = $currentToken ? hash('sha256', $currentToken) : null;

        $sessions = $user->sessions()
            ->where('expires_at', '>', now())
            ->orderByDesc('last_used_at')
            ->get()
            ->map(fn (UserSession $s) => [
                'id' => (string) $s->id,
                'authMethod' => $s->auth_method,
                'ipAddress' => $s->ip_address,
                'userAgent' => $s->user_agent,
                'isCurrent' => $currentHash !== null && hash_equals($currentHash, $s->token_hash),
                'lastUsedAt' => $s->last_used_at?->toISOString(),
                'createdAt' => $s->created_at?->toISOString(),
                'expiresAt' => $s->expires_at?->toISOString(),
            ]);

        return response()->json($sessions);
    }

    /**
     * Revoke a specific session (or all other sessions when id === 'others').
     */
    public function revokeSessionById(Request $request, string $sessionId): JsonResponse
    {
        $user = $this->authService->resolveUserFromRequest($request);
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($sessionId === 'others') {
            $currentToken = $this->authService->extractTokenFromRequest($request);
            $currentHash = $currentToken ? hash('sha256', $currentToken) : null;

            UserSession::where('user_id', $user->id)
                ->when($currentHash, fn ($q) => $q->where('token_hash', '!=', $currentHash))
                ->delete();

            return response()->json(['success' => true]);
        }

        UserSession::where('user_id', $user->id)
            ->where('id', (int) $sessionId)
            ->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Shared response builder that creates a 365-day session, sets HttpOnly cookie, and returns user + token.
     */
    protected function issueSessionResponse(
        User $user,
        Request $request,
        string $authMethod,
        array $extra = []
    ): JsonResponse {
        $sessionData = $this->authService->createSession($user, $request, $authMethod);

        ActivityLogger::auth(
            'LOGIN_SUCCESS',
            "Успешный вход ({$authMethod}): {$user->email} ({$user->name}, {$user->telegram_username})",
            [
                'user_id' => $user->id,
                'email' => $user->email,
                'telegram_username' => $user->telegram_username,
                'role' => $user->role->value,
                'auth_method' => $authMethod,
            ],
            'info',
            $request
        );

        $payload = array_merge([
            'user' => $this->authService->formatUserPayload($user),
            'token' => $sessionData['plainToken'],
        ], $extra);

        $response = response()->json($payload)->withCookie($sessionData['cookie']);

        foreach ($this->authService->makeClearCookies($request) as $clearCookie) {
            if ($clearCookie->getName() !== AuthService::SESSION_COOKIE_NAME) {
                $response->withCookie($clearCookie);
            }
        }

        return $response;
    }
}
