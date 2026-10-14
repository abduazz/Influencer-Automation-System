<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SubdomainService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BootstrapController extends Controller
{
    public function getBootstrapData(?Request $request = null): array
    {
        $request = $request ?? request();
        $userCtrl = app(UserController::class);
        $projCtrl = app(ProjectController::class);
        $intCtrl = app(IntegrationController::class);
        $repCtrl = app(ReportController::class);
        $subCtrl = app(BloggerSubmissionController::class);
        $bulkCtrl = app(BulkPurchaseController::class);
        $kanbanCtrl = app(KanbanColumnController::class);

        $subdomainCtrl = app(SubdomainController::class);

        return [
            'users' => $userCtrl->index()->getData(true),
            'projects' => $projCtrl->index($request)->getData(true),
            'allProjects' => \App\Models\Project::all()->map(fn($p) => [
                'id' => (string) $p->id,
                'name' => $p->name,
                'description' => $p->description ?? '',
                'telegramThreadId' => $p->telegram_thread_id ?? '',
                'monthlyLimit' => $p->monthly_limit !== null ? (int) $p->monthly_limit : null,
                'subdomain' => $p->subdomain ?? '1',
                'createdAt' => $p->created_at->format('Y-m-d'),
            ])->toArray(),
            'subdomains' => $subdomainCtrl->index()->getData(true),
            'integrations' => $intCtrl->index($request)->getData(true),
            'reports' => $repCtrl->index($request)->getData(true),
            'submissions' => $subCtrl->index($request)->getData(true),
            'bulkPurchases' => $bulkCtrl->index($request)->getData(true),
            'kanbanColumns' => $kanbanCtrl->index()->getData(true),
            'bloggerRequisites' => $intCtrl->getRequisites()->getData(true),
            'activeSubdomain' => SubdomainService::resolve($request),
        ];
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->getBootstrapData($request));
    }
}
