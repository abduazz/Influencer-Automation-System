<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\Request;

use App\Services\SubdomainService;

class ProjectController extends Controller
{
    public function index(?Request $request = null)
    {
        $request = $request ?? request();
        $subdomain = SubdomainService::resolve($request);

        $query = Project::query();
        if ($subdomain !== null && $subdomain !== 'timeline') {
            if ($subdomain === '1') {
                $query->where(function ($q) {
                    $q->where('subdomain', '1')->orWhereNull('subdomain')->orWhere('subdomain', '');
                });
            } else {
                $query->where('subdomain', $subdomain);
            }
        }

        return response()->json($query->get()->map(function ($project) {
            return [
                'id' => (string) $project->id,
                'name' => $project->name,
                'description' => $project->description ?? '',
                'telegramThreadId' => $project->telegram_thread_id ?? '',
                'monthlyLimit' => $project->monthly_limit !== null ? (int) $project->monthly_limit : null,
                'subdomain' => $project->subdomain ?? '1',
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
            'subdomain' => 'nullable|string|max:100',
        ]);

        $currentSubdomain = SubdomainService::resolve($request);
        $targetSubdomain = $request->subdomain ? trim($request->subdomain) : (($currentSubdomain && $currentSubdomain !== 'timeline') ? $currentSubdomain : '1');

        $project = Project::create([
            'name' => $request->name,
            'description' => $request->description,
            'telegram_thread_id' => $request->telegramThreadId,
            'monthly_limit' => $request->monthlyLimit,
            'subdomain' => $targetSubdomain,
        ]);

        \App\Services\ActivityLogger::project('CREATED', "Создан проект '{$project->name}' (ID: {$project->id}, субдомен: {$project->subdomain})", [
            'project_id' => $project->id,
            'name' => $project->name,
            'subdomain' => $project->subdomain,
            'monthly_limit' => $project->monthly_limit,
        ]);

        return response()->json([
            'id' => (string) $project->id,
            'name' => $project->name,
            'description' => $project->description ?? '',
            'telegramThreadId' => $project->telegram_thread_id ?? '',
            'monthlyLimit' => $project->monthly_limit !== null ? (int) $project->monthly_limit : null,
            'subdomain' => $project->subdomain ?? '1',
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
            'subdomain' => 'nullable|string|max:100',
        ]);

        $dataToUpdate = [
            'name' => $request->name,
            'description' => $request->description,
            'telegram_thread_id' => $request->telegramThreadId,
            'monthly_limit' => $request->monthlyLimit,
        ];

        if ($request->has('subdomain')) {
            $dataToUpdate['subdomain'] = $request->subdomain ? trim($request->subdomain) : '1';
        }

        $project->update($dataToUpdate);

        \App\Services\ActivityLogger::project('UPDATED', "Обновлен проект '{$project->name}' (ID: {$project->id}, субдомен: {$project->subdomain})", [
            'project_id' => $project->id,
            'name' => $project->name,
            'subdomain' => $project->subdomain,
            'monthly_limit' => $project->monthly_limit,
        ]);

        return response()->json([
            'id' => (string) $project->id,
            'name' => $project->name,
            'description' => $project->description ?? '',
            'telegramThreadId' => $project->telegram_thread_id ?? '',
            'monthlyLimit' => $project->monthly_limit !== null ? (int) $project->monthly_limit : null,
            'subdomain' => $project->subdomain ?? '1',
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

        $projectName = $project->name;
        $projectId = $project->id;
        $projectSub = $project->subdomain;

        $project->delete();

        \App\Services\ActivityLogger::project('DELETED', "Удален проект '{$projectName}' (ID: {$projectId}, субдомен: {$projectSub})", [
            'project_id' => $projectId,
            'name' => $projectName,
            'subdomain' => $projectSub,
        ]);

        return response()->noContent();
    }
}
