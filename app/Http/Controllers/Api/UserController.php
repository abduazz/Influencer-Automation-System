<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required|string',
            'password' => 'required|string',
        ]);

        $rawLogin = trim($request->login);
        $cleanLogin = strtolower($rawLogin);
        $normalizedLogin = ltrim($cleanLogin, '@'); // Handle @username or clean login

        $resolvedEmail = str_contains($normalizedLogin, '@') 
            ? $normalizedLogin 
            : $normalizedLogin . '@tezi.uz';

        // 1. Search for user by exact or normalized email, or matching handle / prefix
        $user = User::whereRaw('LOWER(email) = ?', [$normalizedLogin])
            ->orWhereRaw('LOWER(email) = ?', [$cleanLogin])
            ->orWhereRaw('LOWER(email) = ?', [$resolvedEmail])
            ->first();

        if (!$user) {
            // 2. Fallback match by email prefix or name (e.g. chief1)
            $user = User::all()->first(function ($u) use ($normalizedLogin, $cleanLogin) {
                $userEmail = strtolower($u->email);
                $emailPrefix = explode('@', $userEmail)[0];
                $userName = strtolower(trim($u->name));
                return $userEmail === $normalizedLogin 
                    || $userEmail === $cleanLogin 
                    || $emailPrefix === $normalizedLogin
                    || $userName === $normalizedLogin 
                    || $userName === $cleanLogin;
            });
        }

        $inputPassword = $request->password;
        $trimmedPassword = trim($inputPassword);

        $passwordMatches = $user && (
            Hash::check($inputPassword, $user->password) ||
            Hash::check($trimmedPassword, $user->password)
        );

        if (!$user || !$passwordMatches) {
            ActivityLogger::auth('LOGIN_FAILED', "Неудачная попытка входа с логином '{$request->login}'", [
                'login' => $request->login,
            ], 'warning');

            return response()->json([
                'message' => 'Неверный логин/email или пароль.',
            ], 401);
        }

        Auth::login($user, true);
        if ($request->hasSession()) {
            $request->session()->put('user_id', $user->id);
            $request->session()->put('user_role', $user->role->value);
            $request->session()->put('user_email', $user->email);
            $request->session()->regenerate();
        }

        ActivityLogger::auth('LOGIN_SUCCESS', "Успешный вход пользователя: {$user->email} ({$user->name}, роль: {$user->role->value})", [
            'user_id' => $user->id,
            'email' => $user->email,
            'role' => $user->role->value,
        ]);

        return response()->json([
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'allowedMetrics' => $user->allowed_metrics ?? ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
            'allowedPages' => $user->allowed_pages ?? ['projects', 'kanban', 'requisites_directory', 'bloggers', 'reports', 'bulk_purchases', 'reports_feed', 'other_expenses'],
            'allowedProjects' => $user->allowed_projects ?? [],
            'allowedSubdomains' => $user->allowed_subdomains ?? [],
            'createdAt' => $user->created_at->format('Y-m-d'),
        ])->withCookie(cookie('ff_user_role', $user->role->value, 43200, '/', null, false, false))
          ->withCookie(cookie('ff_user_email', $user->email, 43200, '/', null, false, false));
    }

    public function index()
    {
        return response()->json(User::all()->map(function ($user) {
            return [
                'id' => (string) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
                'allowedMetrics' => $user->allowed_metrics ?? ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
                'allowedPages' => $user->allowed_pages ?? ['projects', 'kanban', 'requisites_directory', 'bloggers', 'reports', 'bulk_purchases', 'reports_feed', 'other_expenses'],
                'allowedProjects' => $user->allowed_projects ?? [],
                'allowedSubdomains' => $user->allowed_subdomains ?? [],
                'createdAt' => $user->created_at->format('Y-m-d'),
            ];
        }));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|max:255',
            'role' => 'required|in:super_admin,pr_manager,product_manager,executive',
            'password' => 'nullable|string|min:4',
            'allowedMetrics' => 'nullable|array',
            'allowedPages' => 'nullable|array',
            'allowedProjects' => 'nullable|array',
            'allowedSubdomains' => 'nullable|array',
            'overwrite' => 'nullable|boolean',
        ]);

        $rawEmail = strtolower(trim($request->email));
        $normalizedEmail = ltrim($rawEmail, '@');
        $resolvedEmail = str_contains($normalizedEmail, '@') ? $normalizedEmail : $normalizedEmail . '@tezi.uz';

        // Check if user already exists
        $existingUser = User::where('email', $resolvedEmail)->first();

        // If user already exists and overwrite is allowed
        if ($existingUser) {
            if (!$request->boolean('overwrite')) {
                return response()->json([
                    'message' => 'Сотрудник с таким email уже существует в системе.',
                    'errors' => [
                        'email' => ['Сотрудник с таким email уже существует в системе.'],
                    ],
                    'user_exists' => true,
                    'existing_user' => [
                        'id' => (string) $existingUser->id,
                        'name' => $existingUser->name,
                        'email' => $existingUser->email,
                    ],
                ], 422);
            }

            // Overwrite existing user with new details & password!
            $plainPassword = $request->input('password') ?: 'password';
            $existingUser->update([
                'name' => $request->name,
                'role' => $request->role,
                'password' => Hash::make(trim($plainPassword)),
                'allowed_metrics' => $request->allowedMetrics ?? ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
                'allowed_pages' => $request->allowedPages ?? ['projects', 'kanban', 'requisites_directory', 'bloggers', 'reports', 'bulk_purchases', 'reports_feed', 'other_expenses'],
                'allowed_projects' => $request->allowedProjects ?? [],
                'allowed_subdomains' => $request->allowedSubdomains ?? [],
            ]);

            ActivityLogger::user('RECREATED', "Пересоздан аккаунт сотрудника: {$existingUser->name} ({$existingUser->email}, роль: {$existingUser->role->value})", [
                'user_id' => $existingUser->id,
                'email' => $existingUser->email,
                'role' => $existingUser->role->value,
            ]);

            return response()->json([
                'id' => (string) $existingUser->id,
                'name' => $existingUser->name,
                'email' => $existingUser->email,
                'role' => $existingUser->role->value,
                'allowedMetrics' => $existingUser->allowed_metrics,
                'allowedPages' => $existingUser->allowed_pages,
                'allowedProjects' => $existingUser->allowed_projects,
                'allowedSubdomains' => $existingUser->allowed_subdomains,
                'createdAt' => $existingUser->created_at->format('Y-m-d'),
                'recreated' => true,
            ], 200);
        }

        $plainPassword = $request->input('password') ?: 'password';

        $user = User::create([
            'name' => $request->name,
            'email' => $resolvedEmail,
            'role' => $request->role,
            'password' => Hash::make(trim($plainPassword)),
            'allowed_metrics' => $request->allowedMetrics ?? ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
            'allowed_pages' => $request->allowedPages ?? ['projects', 'kanban', 'requisites_directory', 'bloggers', 'reports', 'bulk_purchases', 'reports_feed', 'other_expenses'],
            'allowed_projects' => $request->allowedProjects ?? [],
            'allowed_subdomains' => $request->allowedSubdomains ?? [],
        ]);

        ActivityLogger::user('CREATED', "Создан новый сотрудник: {$user->name} ({$user->email}, роль: {$user->role->value})", [
            'user_id' => $user->id,
            'email' => $user->email,
            'role' => $user->role->value,
            'allowedPages' => $user->allowed_pages,
            'allowedSubdomains' => $user->allowed_subdomains,
        ]);

        return response()->json([
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'allowedMetrics' => $user->allowed_metrics,
            'allowedPages' => $user->allowed_pages,
            'allowedProjects' => $user->allowed_projects,
            'allowedSubdomains' => $user->allowed_subdomains,
            'createdAt' => $user->created_at->format('Y-m-d'),
        ], 201);
    }

    public function update(Request $request, User $user)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'role' => 'sometimes|required|in:super_admin,pr_manager,product_manager,executive',
            'allowedMetrics' => 'nullable|array',
            'allowedPages' => 'nullable|array',
            'allowedProjects' => 'nullable|array',
            'allowedSubdomains' => 'nullable|array',
        ]);

        $user->update([
            'name' => $request->name,
            'role' => $request->input('role', $user->role),
            'allowed_metrics' => $request->has('allowedMetrics') ? $request->allowedMetrics : $user->allowed_metrics,
            'allowed_pages' => $request->has('allowedPages') ? $request->allowedPages : $user->allowed_pages,
            'allowed_projects' => $request->has('allowedProjects') ? $request->allowedProjects : $user->allowed_projects,
            'allowed_subdomains' => $request->has('allowedSubdomains') ? $request->allowedSubdomains : $user->allowed_subdomains,
        ]);

        ActivityLogger::user('UPDATED', "Обновлены права сотрудника: {$user->name} ({$user->email}, роль: {$user->role->value})", [
            'user_id' => $user->id,
            'email' => $user->email,
            'role' => $user->role->value,
            'allowedPages' => $user->allowed_pages,
            'allowedSubdomains' => $user->allowed_subdomains,
        ]);

        return response()->json([
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'allowedMetrics' => $user->allowed_metrics,
            'allowedPages' => $user->allowed_pages,
            'allowedProjects' => $user->allowed_projects,
            'allowedSubdomains' => $user->allowed_subdomains,
            'createdAt' => $user->created_at->format('Y-m-d'),
        ]);
    }

    public function updatePassword(Request $request, User $user)
    {
        $request->validate([
            'password' => 'required|string|min:4',
        ]);

        $user->update([
            'password' => Hash::make(trim($request->password)),
        ]);

        ActivityLogger::user('PASSWORD_CHANGED', "Изменен пароль сотрудника {$user->name} ({$user->email})", [
            'user_id' => $user->id,
            'email' => $user->email,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Пароль успешно обновлен!',
        ]);
    }

    public function destroy(User $user)
    {
        $userInfo = "{$user->name} ({$user->email}, ID: {$user->id})";
        $user->delete();

        ActivityLogger::user('DELETED', "Удален сотрудник {$userInfo}", [
            'deleted_user_id' => $user->id,
            'email' => $user->email,
        ]);

        return response()->noContent();
    }
}
