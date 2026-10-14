<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Subdomain;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SubdomainController extends Controller
{
    /**
     * List all subdomains with associated project statistics.
     */
    public function index(): JsonResponse
    {
        $allProjects = Project::all();

        $subdomains = Subdomain::orderBy('id', 'asc')->get()->map(function (Subdomain $sub) use ($allProjects) {
            $slug = (string) $sub->slug;

            $matchedProjects = $allProjects->filter(function ($project) use ($slug) {
                $pSub = (string) ($project->subdomain ?? '1');
                if ($slug === '1') {
                    return $pSub === '1' || $pSub === '';
                }
                return $pSub === $slug;
            })->values();

            return [
                'id' => (string) $sub->id,
                'slug' => $sub->slug,
                'name' => $sub->name,
                'description' => $sub->description ?? '',
                'projectsCount' => $matchedProjects->count(),
                'projects' => $matchedProjects->map(function ($p) {
                    return [
                        'id' => (string) $p->id,
                        'name' => $p->name,
                        'subdomain' => $p->subdomain ?? '1',
                        'monthlyLimit' => $p->monthly_limit,
                    ];
                }),
                'createdAt' => $sub->created_at ? $sub->created_at->format('Y-m-d') : '',
            ];
        });

        return response()->json($subdomains);
    }

    /**
     * Create a new subdomain and optionally assign existing projects to it.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'slug' => [
                'required',
                'string',
                'max:50',
                'regex:/^[a-zA-Z0-9_-]+$/',
                'unique:subdomains,slug',
            ],
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'projectIds' => 'nullable|array',
            'projectIds.*' => 'integer|exists:projects,id',
        ], [
            'slug.regex' => 'Имя субдомена может содержать только латинские буквы, цифры, дефис и подчеркивание (например, "2" или "marketing").',
            'slug.unique' => 'Субдомен с таким именем уже существует.',
        ]);

        $cleanSlug = strtolower(trim($request->slug));

        $subdomain = Subdomain::create([
            'slug' => $cleanSlug,
            'name' => trim($request->name),
            'description' => $request->description ? trim($request->description) : null,
        ]);

        if (!empty($request->projectIds)) {
            Project::whereIn('id', $request->projectIds)->update([
                'subdomain' => $cleanSlug,
            ]);
        }

        $allProjects = Project::where('subdomain', $cleanSlug)->get();

        return response()->json([
            'id' => (string) $subdomain->id,
            'slug' => $subdomain->slug,
            'name' => $subdomain->name,
            'description' => $subdomain->description ?? '',
            'projectsCount' => $allProjects->count(),
            'projects' => $allProjects->map(fn($p) => [
                'id' => (string) $p->id,
                'name' => $p->name,
                'subdomain' => $p->subdomain ?? '1',
            ]),
            'createdAt' => $subdomain->created_at->format('Y-m-d'),
        ], 201);
    }

    /**
     * Update subdomain name, description, or assigned projects.
     */
    public function update(Request $request, Subdomain $subdomain): JsonResponse
    {
        $request->validate([
            'slug' => [
                'sometimes',
                'required',
                'string',
                'max:50',
                'regex:/^[a-zA-Z0-9_-]+$/',
                Rule::unique('subdomains', 'slug')->ignore($subdomain->id),
            ],
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'projectIds' => 'nullable|array',
            'projectIds.*' => 'integer|exists:projects,id',
        ]);

        $oldSlug = $subdomain->slug;
        $newSlug = $request->has('slug') ? strtolower(trim($request->slug)) : $oldSlug;

        // Do not allow renaming slug '1'
        if ($oldSlug === '1' && $newSlug !== '1') {
            return response()->json([
                'message' => 'Нельзя менять системный субдомен "1".'
            ], 422);
        }

        $subdomain->update([
            'slug' => $newSlug,
            'name' => trim($request->name),
            'description' => $request->description ? trim($request->description) : null,
        ]);

        // If slug changed, update all existing projects assigned to this slug
        if ($oldSlug !== $newSlug) {
            Project::where('subdomain', $oldSlug)->update(['subdomain' => $newSlug]);
        }

        // If projectIds provided, assign them explicitly
        if ($request->has('projectIds')) {
            Project::whereIn('id', $request->projectIds)->update(['subdomain' => $newSlug]);
        }

        $allProjects = Project::where('subdomain', $newSlug)->get();

        return response()->json([
            'id' => (string) $subdomain->id,
            'slug' => $subdomain->slug,
            'name' => $subdomain->name,
            'description' => $subdomain->description ?? '',
            'projectsCount' => $allProjects->count(),
            'projects' => $allProjects->map(fn($p) => [
                'id' => (string) $p->id,
                'name' => $p->name,
                'subdomain' => $p->subdomain ?? '1',
            ]),
            'createdAt' => $subdomain->created_at->format('Y-m-d'),
        ]);
    }

    /**
     * Move a single project to another subdomain.
     */
    public function moveProject(Request $request): JsonResponse
    {
        $request->validate([
            'projectId' => 'required|integer|exists:projects,id',
            'targetSubdomain' => 'required|string|exists:subdomains,slug',
        ]);

        $project = Project::findOrFail($request->projectId);
        $project->update([
            'subdomain' => strtolower(trim($request->targetSubdomain)),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Проект «{$project->name}» успешно перемещен в субдомен {$project->subdomain}.",
            'project' => [
                'id' => (string) $project->id,
                'name' => $project->name,
                'subdomain' => $project->subdomain,
            ],
        ]);
    }

    /**
     * Delete a subdomain (moves all assigned projects safely back to '1').
     */
    public function destroy(Subdomain $subdomain): JsonResponse
    {
        if ($subdomain->slug === '1') {
            return response()->json([
                'message' => 'Основной субдомен "1" не может быть удален.',
            ], 422);
        }

        // Reassign all projects in this subdomain safely back to '1'
        Project::where('subdomain', $subdomain->slug)->update([
            'subdomain' => '1',
        ]);

        $subdomain->delete();

        return response()->json([
            'success' => true,
            'message' => 'Субдомен удален. Все его проекты перенесены в основное пространство (1).',
        ]);
    }
}
