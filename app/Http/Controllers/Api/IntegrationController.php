<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Integration;
use Illuminate\Http\Request;

class IntegrationController extends Controller
{
    public function index()
    {
        return response()->json(Integration::orderBy('start_date', 'desc')->orderBy('id', 'desc')->get()->map(function ($integration) {
            return [
                'id' => (string) $integration->id,
                'projectId' => (string) $integration->project_id,
                'bloggerName' => $integration->blogger_name,
                'bloggerPageLink' => $integration->blogger_page_link ?? '',
                'startDate' => $integration->start_date->format('Y-m-d'),
                'platform' => $integration->platform,
                'referralLink' => $integration->referral_link ?? '',
                'pricePerSlot' => (float) $integration->price_per_slot,
                'slotsCount' => $integration->slots_count,
                'paidSlotsCount' => $integration->paid_slots_count,
                'paidAmount' => (float) $integration->paid_amount,
                'totalAmount' => (float) $integration->total_amount,
                'endDate' => $integration->end_date->format('Y-m-d'),
                'status' => $integration->status,
                'kanbanStage' => $integration->kanban_stage,
                'createdBy' => $integration->created_by ?? '',
                'bloggerCabinetToken' => $integration->blogger_cabinet_token,
                'slotsConfig' => $integration->slots_config ?? [],
                'comments' => $integration->comments ?? [],
            ];
        }));
    }

    public function store(Request $request)
    {
        $request->validate([
            'projectId' => 'required|exists:projects,id',
            'bloggerName' => 'required|string|max:255',
            'bloggerPageLink' => 'nullable|string',
            'startDate' => 'nullable|date',
            'platform' => 'required|in:Telegram,Instagram,YouTube,MAX,TikTok',
            'referralLink' => 'nullable|string',
            'pricePerSlot' => 'required|numeric|min:0',
            'slotsCount' => 'required|integer|min:1',
            'paidSlotsCount' => 'nullable|integer|min:0',
            'endDate' => 'nullable|date',
            'status' => 'nullable|in:active,completed,paused',
            'kanbanStage' => 'nullable|string',
            'createdBy' => 'nullable|string',
            'slotsConfig' => 'nullable|array',
            'comments' => 'nullable',
        ]);

        $email = $request->header('X-User-Email') ?: $request->input('createdBy');
        $createdByName = null;
        if ($email) {
            $user = \App\Models\User::where('email', strtolower(trim($email)))->first();
            $createdByName = $user ? $user->name : $email;
        } elseif ($request->filled('createdBy')) {
            $createdByName = $request->input('createdBy');
        }

        $integration = Integration::create([
            'project_id' => $request->projectId,
            'blogger_name' => $request->bloggerName,
            'blogger_page_link' => $request->bloggerPageLink,
            'start_date' => $request->startDate ?? now()->format('Y-m-d'),
            'platform' => $request->platform,
            'referral_link' => $request->referralLink,
            'price_per_slot' => $request->pricePerSlot,
            'slots_count' => $request->slotsCount,
            'paid_slots_count' => $request->paidSlotsCount ?? $request->slotsCount,
            'end_date' => $request->endDate ?? now()->addDays(30)->format('Y-m-d'),
            'status' => $request->status ?? 'active',
            'kanban_stage' => $request->input('kanbanStage'),
            'created_by' => $createdByName,
            'slots_config' => $request->slotsConfig,
            'comments' => $request->comments,
        ]);

        // Reload to get calculated values
        $integration->refresh();

        return response()->json([
            'id' => (string) $integration->id,
            'projectId' => (string) $integration->project_id,
            'bloggerName' => $integration->blogger_name,
            'bloggerPageLink' => $integration->blogger_page_link ?? '',
            'startDate' => $integration->start_date->format('Y-m-d'),
            'platform' => $integration->platform,
            'referralLink' => $integration->referral_link ?? '',
            'pricePerSlot' => (float) $integration->price_per_slot,
            'slotsCount' => $integration->slots_count,
            'paidSlotsCount' => $integration->paid_slots_count,
            'paidAmount' => (float) $integration->paid_amount,
            'totalAmount' => (float) $integration->total_amount,
            'endDate' => $integration->end_date->format('Y-m-d'),
            'status' => $integration->status,
            'kanbanStage' => $integration->kanban_stage,
            'createdBy' => $integration->created_by ?? '',
            'bloggerCabinetToken' => $integration->blogger_cabinet_token,
            'slotsConfig' => $integration->slots_config ?? [],
            'comments' => $integration->comments ?? [],
        ], 201);
    }

    public function update(Request $request, Integration $integration)
    {
        $request->validate([
            'projectId' => 'sometimes|required|exists:projects,id',
            'bloggerName' => 'sometimes|required|string|max:255',
            'bloggerPageLink' => 'nullable|string',
            'startDate' => 'nullable|date',
            'platform' => 'sometimes|required|in:Telegram,Instagram,YouTube,MAX,TikTok',
            'referralLink' => 'nullable|string',
            'pricePerSlot' => 'sometimes|required|numeric|min:0',
            'slotsCount' => 'sometimes|required|integer|min:1',
            'paidSlotsCount' => 'nullable|integer|min:0',
            'paidAmount' => 'nullable|numeric|min:0',
            'endDate' => 'nullable|date',
            'status' => 'sometimes|required|in:active,completed,paused',
            'kanbanStage' => 'nullable|string',
            'createdBy' => 'nullable|string',
            'slotsConfig' => 'nullable|array',
            'comments' => 'nullable',
        ]);

        $updateData = [];
        if ($request->has('projectId')) $updateData['project_id'] = $request->projectId;
        if ($request->has('bloggerName')) $updateData['blogger_name'] = $request->bloggerName;
        if ($request->has('bloggerPageLink')) $updateData['blogger_page_link'] = $request->bloggerPageLink;
        if ($request->filled('startDate')) $updateData['start_date'] = $request->startDate;
        if ($request->has('platform')) $updateData['platform'] = $request->platform;
        if ($request->has('referralLink')) $updateData['referral_link'] = $request->referralLink;
        if ($request->has('pricePerSlot')) $updateData['price_per_slot'] = $request->pricePerSlot;
        if ($request->has('slotsCount')) $updateData['slots_count'] = $request->slotsCount;
        if ($request->has('paidSlotsCount')) $updateData['paid_slots_count'] = $request->paidSlotsCount;
        if ($request->has('paidAmount')) $updateData['paid_amount'] = $request->paidAmount;
        if ($request->filled('endDate')) $updateData['end_date'] = $request->endDate;
        if ($request->has('status')) $updateData['status'] = $request->status;
        if ($request->has('kanbanStage')) $updateData['kanban_stage'] = $request->kanbanStage;
        if ($request->has('createdBy')) $updateData['created_by'] = $request->createdBy;
        if ($request->has('slotsConfig')) $updateData['slots_config'] = $request->slotsConfig;
        if ($request->has('comments')) $updateData['comments'] = $request->comments;

        $integration->update($updateData);

        return response()->json([
            'id' => (string) $integration->id,
            'projectId' => (string) $integration->project_id,
            'bloggerName' => $integration->blogger_name,
            'bloggerPageLink' => $integration->blogger_page_link ?? '',
            'startDate' => $integration->start_date->format('Y-m-d'),
            'platform' => $integration->platform,
            'referralLink' => $integration->referral_link ?? '',
            'pricePerSlot' => (float) $integration->price_per_slot,
            'slotsCount' => $integration->slots_count,
            'paidSlotsCount' => $integration->paid_slots_count,
            'paidAmount' => (float) $integration->paid_amount,
            'totalAmount' => (float) $integration->total_amount,
            'endDate' => $integration->end_date->format('Y-m-d'),
            'status' => $integration->status,
            'kanbanStage' => $integration->kanban_stage,
            'createdBy' => $integration->created_by ?? '',
            'bloggerCabinetToken' => $integration->blogger_cabinet_token,
            'slotsConfig' => $integration->slots_config ?? [],
            'comments' => $integration->comments ?? [],
        ]);
    }

    public function destroy(Integration $integration)
    {
        $integration->delete();
        return response()->noContent();
    }
}
