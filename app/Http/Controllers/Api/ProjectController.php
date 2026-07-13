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
                'createdAt' => $project->created_at->format('Y-m-d'),
            ];
        }));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        $project = Project::create([
            'name' => $request->name,
            'description' => $request->description,
        ]);

        return response()->json([
            'id' => (string) $project->id,
            'name' => $project->name,
            'description' => $project->description ?? '',
            'createdAt' => $project->created_at->format('Y-m-d'),
        ], 201);
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
