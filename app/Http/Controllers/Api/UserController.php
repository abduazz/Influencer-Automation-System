<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index()
    {
        return response()->json(User::all()->map(function ($user) {
            return [
                'id' => (string) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
                'allowedMetrics' => $user->allowed_metrics ?? ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
                'createdAt' => $user->created_at->format('Y-m-d'),
            ];
        }));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'role' => 'required|in:super_admin,pr_manager,product_manager',
            'allowedMetrics' => 'nullable|array',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => strtolower($request->email),
            'role' => $request->role,
            'password' => Hash::make('password'),
            'allowed_metrics' => $request->allowedMetrics ?? ['deals', 'spend', 'total_slots', 'slots_published', 'slots_remaining', 'financial_metrics'],
        ]);

        return response()->json([
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'allowedMetrics' => $user->allowed_metrics,
            'createdAt' => $user->created_at->format('Y-m-d'),
        ], 201);
    }

    public function update(Request $request, User $user)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'role' => 'sometimes|required|in:super_admin,pr_manager,product_manager',
            'allowedMetrics' => 'nullable|array',
        ]);

        $user->update([
            'name' => $request->name,
            'role' => $request->input('role', $user->role),
            'allowed_metrics' => $request->has('allowedMetrics') ? $request->allowedMetrics : $user->allowed_metrics,
        ]);

        return response()->json([
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'allowedMetrics' => $user->allowed_metrics,
            'createdAt' => $user->created_at->format('Y-m-d'),
        ]);
    }

    public function destroy(User $user)
    {
        $user->delete();
        return response()->noContent();
    }
}
