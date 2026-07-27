<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function index()
    {
        return response()->json(Project::all()->map(function ($project) {
            return [
                'id' => (string) $project->id,
                'name' => $project->name,
                'description' => $project->description ?? '',
                'telegramThreadId' => $project->telegram_thread_id ?? '',
                'monthlyLimit' => $project->monthly_limit !== null ? (int) $project->monthly_limit : null,
                'createdAt' => $project->created_at->format('Y-m-d'),
            ];
        }));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'telegramThreadId' => 'nullable|string',
            'monthlyLimit' => 'nullable|integer|min:0',
        ]);

        $project = Project::create([
            'name' => $request->name,
            'description' => $request->description,
            'telegram_thread_id' => $request->telegramThreadId,
            'monthly_limit' => $request->monthlyLimit,
        ]);

        return response()->json([
            'id' => (string) $project->id,
            'name' => $project->name,
            'description' => $project->description ?? '',
            'telegramThreadId' => $project->telegram_thread_id ?? '',
            'monthlyLimit' => $project->monthly_limit !== null ? (int) $project->monthly_limit : null,
            'createdAt' => $project->created_at->format('Y-m-d'),
        ], 201);
    }

    public function update(Request $request, Project $project)
    {
        $user = auth()->user();

        if (!$user) {
            $email = $request->header('X-User-Email');
            if ($email) {
                $user = \App\Models\User::where('email', strtolower($email))->first();
            }
        }

        if (!$user || ($user->role !== \App\Enums\UserRole::SuperAdmin && !in_array('set_limit', $user->allowed_metrics ?? []))) {
            return response()->json([
                'error' => 'Forbidden. Only Super Admin or users with monthly limit setting permission can edit projects.'
            ], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'telegramThreadId' => 'nullable|string',
            'monthlyLimit' => 'nullable|integer|min:0',
        ]);

        $project->update([
            'name' => $request->name,
            'description' => $request->description,
            'telegram_thread_id' => $request->telegramThreadId,
            'monthly_limit' => $request->monthlyLimit,
        ]);

        return response()->json([
            'id' => (string) $project->id,
            'name' => $project->name,
            'description' => $project->description ?? '',
            'telegramThreadId' => $project->telegram_thread_id ?? '',
            'monthlyLimit' => $project->monthly_limit !== null ? (int) $project->monthly_limit : null,
            'createdAt' => $project->created_at->format('Y-m-d'),
        ]);
    }

    public function destroy(Request $request, Project $project)
    {
        $user = auth()->user();

        if (!$user) {
            $email = $request->header('X-User-Email');
            if ($email) {
                $user = \App\Models\User::where('email', strtolower($email))->first();
            }
        }

        if (!$user || $user->role !== \App\Enums\UserRole::SuperAdmin) {
            return response()->json([
                'error' => 'Forbidden. Only Super Admin can delete projects.'
            ], 403);
        }

        $project->delete();
        return response()->noContent();
    }
}
