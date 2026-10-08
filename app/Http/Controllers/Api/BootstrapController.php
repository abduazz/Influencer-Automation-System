<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class BootstrapController extends Controller
{
    public function getBootstrapData(): array
    {
        $userCtrl = app(UserController::class);
        $projCtrl = app(ProjectController::class);
        $intCtrl = app(IntegrationController::class);
        $repCtrl = app(ReportController::class);
        $subCtrl = app(BloggerSubmissionController::class);
        $bulkCtrl = app(BulkPurchaseController::class);
        $kanbanCtrl = app(KanbanColumnController::class);

        return [
            'users' => $userCtrl->index()->getData(true),
            'projects' => $projCtrl->index()->getData(true),
            'integrations' => $intCtrl->index()->getData(true),
            'reports' => $repCtrl->index()->getData(true),
            'submissions' => $subCtrl->index()->getData(true),
            'bulkPurchases' => $bulkCtrl->index()->getData(true),
            'kanbanColumns' => $kanbanCtrl->index()->getData(true),
            'bloggerRequisites' => $intCtrl->getRequisites()->getData(true),
        ];
    }

    public function index(): JsonResponse
    {
        return response()->json($this->getBootstrapData());
    }
}
