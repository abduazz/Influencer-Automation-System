<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'login' => 'required|string',
            'password' => 'required|string',
        ]);

        $cleanLogin = strtolower(trim($request->login));
        $resolvedEmail = str_contains($cleanLogin, '@') ? $cleanLogin : $cleanLogin . '@tezi.uz';

        // Search for user by exact email, or matching handle / prefix
        $user = User::where('email', $cleanLogin)
            ->orWhere('email', $resolvedEmail)
            ->first();

        if (!$user) {
            // Fallback match by email prefix or name (e.g. chief1)
            $user = User::all()->first(function ($u) use ($cleanLogin) {
                $userEmail = strtolower($u->email);
                $emailPrefix = explode('@', $userEmail)[0];
                $userName = strtolower($u->name);
                return $userEmail === $cleanLogin || $emailPrefix === $cleanLogin || $userName === $cleanLogin;
            });
        }

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'Неверный логин/email или пароль.',
            ], 401);
        }

        return response()->json([
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'allowedMetrics' => $user->allowed_metrics ?? ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
            'allowedPages' => $user->allowed_pages ?? ['projects', 'bloggers', 'reports', 'reports_feed', 'other_expenses'],
            'allowedProjects' => $user->allowed_projects ?? [],
            'createdAt' => $user->created_at->format('Y-m-d'),
        ]);
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
                'allowedPages' => $user->allowed_pages ?? ['projects', 'bloggers', 'reports', 'reports_feed', 'other_expenses'],
                'allowedProjects' => $user->allowed_projects ?? [],
                'createdAt' => $user->created_at->format('Y-m-d'),
            ];
        }));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'role' => 'required|in:super_admin,pr_manager,product_manager,executive',
            'password' => 'nullable|string|min:4',
            'allowedMetrics' => 'nullable|array',
            'allowedPages' => 'nullable|array',
            'allowedProjects' => 'nullable|array',
        ]);

        $plainPassword = $request->input('password') ?: 'password';

        $user = User::create([
            'name' => $request->name,
            'email' => strtolower($request->email),
            'role' => $request->role,
            'password' => Hash::make($plainPassword),
            'allowed_metrics' => $request->allowedMetrics ?? ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
            'allowed_pages' => $request->allowedPages ?? ['projects', 'bloggers', 'reports', 'reports_feed', 'other_expenses'],
            'allowed_projects' => $request->allowedProjects ?? [],
        ]);

        return response()->json([
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'allowedMetrics' => $user->allowed_metrics,
            'allowedPages' => $user->allowed_pages,
            'allowedProjects' => $user->allowed_projects,
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
        ]);

        $user->update([
            'name' => $request->name,
            'role' => $request->input('role', $user->role),
            'allowed_metrics' => $request->has('allowedMetrics') ? $request->allowedMetrics : $user->allowed_metrics,
            'allowed_pages' => $request->has('allowedPages') ? $request->allowedPages : $user->allowed_pages,
            'allowed_projects' => $request->has('allowedProjects') ? $request->allowedProjects : $user->allowed_projects,
        ]);

        return response()->json([
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'allowedMetrics' => $user->allowed_metrics,
            'allowedPages' => $user->allowed_pages,
            'allowedProjects' => $user->allowed_projects,
            'createdAt' => $user->created_at->format('Y-m-d'),
        ]);
    }

    public function updatePassword(Request $request, User $user)
    {
        $request->validate([
            'password' => 'required|string|min:4',
        ]);

        $user->update([
            'password' => Hash::make($request->password),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Пароль успешно обновлен!',
        ]);
    }

    public function destroy(User $user)
    {
        $user->delete();
        return response()->noContent();
    }
}
