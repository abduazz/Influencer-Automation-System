<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\AuthService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function __construct(
        protected AuthService $authService
    ) {}

    public function login(Request $request)
    {
        return app(AuthController::class)->login($request);
    }

    public function index()
    {
        return response()->json(
            User::all()->map(fn (User $user) => $this->authService->formatUserPayload($user))
        );
    }

    protected function requireSuperAdmin(Request $request): void
    {
        $actor = $this->authService->resolveUserFromRequest($request);
        if (!$actor || !$actor->isSuperAdmin()) {
            abort(403, 'Только Супер-администратор может управлять сотрудниками.');
        }
    }

    public function store(Request $request)
    {
        $this->requireSuperAdmin($request);

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'nullable|string|max:255',
            'telegramUsername' => 'required|string|max:100',
            'role' => 'required|in:super_admin,pr_manager,product_manager,executive',
            'password' => 'nullable|string|min:4',
            'allowedMetrics' => 'nullable|array',
            'allowedPages' => 'nullable|array',
            'allowedProjects' => 'nullable|array',
            'allowedSubdomains' => 'nullable|array',
            'overwrite' => 'nullable|boolean',
        ]);

        $cleanTgHandle = ltrim(strtolower(trim((string) $request->input('telegramUsername'))), '@');
        if ($cleanTgHandle === '') {
            return response()->json([
                'message' => 'Укажите Telegram @username сотрудника.',
                'errors' => ['telegramUsername' => ['Укажите Telegram @username сотрудника.']],
            ], 422);
        }
        $formattedTgUsername = '@' . $cleanTgHandle;

        $rawEmail = strtolower(trim((string) ($request->input('email') ?: $cleanTgHandle)));
        $normalizedEmail = ltrim($rawEmail, '@');
        $resolvedEmail = str_contains($normalizedEmail, '@') ? $normalizedEmail : $normalizedEmail . '@tezi.uz';

        $existingByTg = User::findByTelegramUsername($cleanTgHandle);
        if ($existingByTg && $existingByTg->email !== $resolvedEmail && !$request->boolean('overwrite')) {
            return response()->json([
                'message' => "Сотрудник с Telegram {$formattedTgUsername} уже существует ({$existingByTg->name}).",
                'errors' => ['telegramUsername' => ["Telegram {$formattedTgUsername} уже занят."]],
            ], 422);
        }

        $existingUser = User::where('email', $resolvedEmail)->first() ?: $existingByTg;

        $rawPass = (string) $request->input('password');
        $cleanPass = trim(preg_replace('/^\p{Z}+|\p{Z}+$/u', '', $rawPass));
        $plainPassword = $cleanPass !== '' ? $cleanPass : bin2hex(random_bytes(8));

        if ($existingUser) {
            if (!$request->boolean('overwrite')) {
                return response()->json([
                    'message' => 'Сотрудник с таким email или Telegram уже существует в системе.',
                    'errors' => [
                        'email' => ['Сотрудник уже существует в системе.'],
                    ],
                    'user_exists' => true,
                    'existing_user' => [
                        'id' => (string) $existingUser->id,
                        'name' => $existingUser->name,
                        'email' => $existingUser->email,
                    ],
                ], 422);
            }

            $tgChanged = ltrim(strtolower((string) $existingUser->telegram_username), '@') !== $cleanTgHandle;

            $existingUser->update([
                'name' => $request->name,
                'email' => $resolvedEmail,
                'telegram_username' => $formattedTgUsername,
                'telegram_id' => $tgChanged ? null : $existingUser->telegram_id,
                'role' => $request->role,
                'password' => Hash::make($plainPassword),
                'must_change_password' => false,
                'allowed_metrics' => $request->allowedMetrics ?? ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
                'allowed_pages' => $request->allowedPages ?? ['projects', 'kanban', 'requisites_directory', 'bloggers', 'reports', 'bulk_purchases', 'reports_feed', 'other_expenses'],
                'allowed_projects' => $request->allowedProjects ?? [],
                'allowed_subdomains' => $request->allowedSubdomains ?? [],
            ]);

            $existingUser->sessions()->delete();

            ActivityLogger::user('RECREATED', "Пересоздан аккаунт сотрудника: {$existingUser->name} ({$formattedTgUsername}, роль: {$existingUser->role->value})", [
                'user_id' => $existingUser->id,
                'email' => $existingUser->email,
                'telegram_username' => $formattedTgUsername,
                'role' => $existingUser->role->value,
            ]);

            return response()->json(array_merge(
                $this->authService->formatUserPayload($existingUser),
                ['recreated' => true]
            ), 200);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $resolvedEmail,
            'telegram_username' => $formattedTgUsername,
            'role' => $request->role,
            'password' => Hash::make($plainPassword),
            'must_change_password' => false,
            'allowed_metrics' => $request->allowedMetrics ?? ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
            'allowed_pages' => $request->allowedPages ?? ['projects', 'kanban', 'requisites_directory', 'bloggers', 'reports', 'bulk_purchases', 'reports_feed', 'other_expenses'],
            'allowed_projects' => $request->allowedProjects ?? [],
            'allowed_subdomains' => $request->allowedSubdomains ?? [],
        ]);

        ActivityLogger::user('CREATED', "Создан новый сотрудник: {$user->name} ({$formattedTgUsername}, роль: {$user->role->value})", [
            'user_id' => $user->id,
            'email' => $user->email,
            'telegram_username' => $formattedTgUsername,
            'role' => $user->role->value,
            'allowedPages' => $user->allowed_pages,
            'allowedSubdomains' => $user->allowed_subdomains,
        ]);

        return response()->json($this->authService->formatUserPayload($user), 201);
    }

    public function update(Request $request, User $user)
    {
        $this->requireSuperAdmin($request);

        $request->validate([
            'name' => 'required|string|max:255',
            'telegramUsername' => 'nullable|string|max:100',
            'role' => 'sometimes|required|in:super_admin,pr_manager,product_manager,executive',
            'allowedMetrics' => 'nullable|array',
            'allowedPages' => 'nullable|array',
            'allowedProjects' => 'nullable|array',
            'allowedSubdomains' => 'nullable|array',
        ]);

        $updates = [
            'name' => $request->name,
            'role' => $request->input('role', $user->role),
            'allowed_metrics' => $request->has('allowedMetrics') ? $request->allowedMetrics : $user->allowed_metrics,
            'allowed_pages' => $request->has('allowedPages') ? $request->allowedPages : $user->allowed_pages,
            'allowed_projects' => $request->has('allowedProjects') ? $request->allowedProjects : $user->allowed_projects,
            'allowed_subdomains' => $request->has('allowedSubdomains') ? $request->allowedSubdomains : $user->allowed_subdomains,
        ];

        if ($request->has('telegramUsername')) {
            $cleanTgHandle = ltrim(strtolower(trim((string) $request->input('telegramUsername'))), '@');
            if ($cleanTgHandle !== '') {
                $formattedTg = '@' . $cleanTgHandle;
                $duplicate = User::where('id', '!=', $user->id)
                    ->whereNotNull('telegram_username')
                    ->whereRaw("LOWER(REPLACE(telegram_username, '@', '')) = ?", [$cleanTgHandle])
                    ->first();
                if ($duplicate) {
                    return response()->json([
                        'message' => "Telegram {$formattedTg} уже назначен другому сотруднику ({$duplicate->name}).",
                    ], 422);
                }

                $oldHandle = ltrim(strtolower((string) $user->telegram_username), '@');
                $updates['telegram_username'] = $formattedTg;
                if ($oldHandle !== $cleanTgHandle) {
                    $updates['telegram_id'] = null;
                    $user->sessions()->delete();
                }
            }
        }

        $user->update($updates);

        ActivityLogger::user('UPDATED', "Обновлены права сотрудника: {$user->name} ({$user->telegram_username}, роль: {$user->role->value})", [
            'user_id' => $user->id,
            'email' => $user->email,
            'telegram_username' => $user->telegram_username,
            'role' => $user->role->value,
            'allowedPages' => $user->allowed_pages,
            'allowedSubdomains' => $user->allowed_subdomains,
        ]);

        return response()->json($this->authService->formatUserPayload($user));
    }

    public function updatePassword(Request $request, User $user)
    {
        $this->requireSuperAdmin($request);

        $request->validate([
            'password' => 'required|string|min:4',
        ]);

        $cleanPass = trim(preg_replace('/^\p{Z}+|\p{Z}+$/u', '', (string) $request->password));
        $mustChange = strlen($cleanPass) < 8 || strtolower($cleanPass) === 'password';

        $user->update([
            'password' => Hash::make($cleanPass),
            'must_change_password' => $mustChange,
        ]);

        // Revoke all active sessions when admin resets user's password
        $user->sessions()->delete();

        ActivityLogger::user('PASSWORD_CHANGED', "Изменен пароль сотрудника {$user->name} ({$user->email})", [
            'user_id' => $user->id,
            'email' => $user->email,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Пароль успешно обновлен! Активные сессии сотрудника завершены.',
            'assignedPassword' => $cleanPass,
        ]);
    }

    public function resetTelegram(Request $request, User $user)
    {
        $this->requireSuperAdmin($request);

        $user->forceFill(['telegram_id' => null])->save();

        \App\Models\AuthChallenge::where('user_id', $user->id)
            ->where('type', 'telegram_otp')
            ->where('status', 'pending')
            ->update(['status' => 'expired']);

        // Keep current admin's own active session if resetting self, otherwise revoke user's sessions
        $currentToken = $this->authService->extractTokenFromRequest($request);
        $currentHash = $currentToken ? hash('sha256', $currentToken) : null;
        $user->sessions()
            ->when($currentHash, fn ($q) => $q->where('token_hash', '!=', $currentHash))
            ->delete();

        ActivityLogger::user('TELEGRAM_UNLINKED', "Сброшена привязка Telegram ID для сотрудника {$user->name} ({$user->telegram_username})", [
            'user_id' => $user->id,
            'telegram_username' => $user->telegram_username,
        ]);

        return response()->json($this->authService->formatUserPayload($user));
    }

    public function destroy(Request $request, User $user)
    {
        $this->requireSuperAdmin($request);

        $actor = $this->authService->resolveUserFromRequest($request);
        if ($actor && $actor->id === $user->id) {
            return response()->json(['message' => 'Нельзя удалить собственный аккаунт.'], 422);
        }

        $userInfo = "{$user->name} ({$user->email}, ID: {$user->id})";
        $user->sessions()->delete();
        $user->delete();

        ActivityLogger::user('DELETED', "Удален сотрудник {$userInfo}", [
            'deleted_user_id' => $user->id,
            'email' => $user->email,
        ]);

        return response()->noContent();
    }
}
