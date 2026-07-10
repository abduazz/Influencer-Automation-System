<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Integration;
use Illuminate\Http\Request;

class IntegrationController extends Controller
{
    public function index()
    {
        return response()->json(Integration::all()->map(function ($integration) {
            return [
                'id' => (string) $integration->id,
                'projectId' => (string) $integration->project_id,
                'bloggerName' => $integration->blogger_name,
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
                'bloggerCabinetToken' => $integration->blogger_cabinet_token,
                'slotsConfig' => $integration->slots_config ?? [],
            ];
        }));
    }

    public function store(Request $request)
    {
        $request->validate([
            'projectId' => 'required|exists:projects,id',
            'bloggerName' => 'required|string|max:255',
            'startDate' => 'required|date',
            'platform' => 'required|in:Telegram,Instagram,YouTube,MAX',
            'referralLink' => 'nullable|string',
            'pricePerSlot' => 'required|numeric|min:0',
            'slotsCount' => 'required|integer|min:1',
            'paidSlotsCount' => 'nullable|integer|min:0',
            'endDate' => 'required|date',
            'status' => 'nullable|in:active,completed,paused',
            'slotsConfig' => 'nullable|array',
        ]);

        $integration = Integration::create([
            'project_id' => $request->projectId,
            'blogger_name' => $request->bloggerName,
            'start_date' => $request->startDate,
            'platform' => $request->platform,
            'referral_link' => $request->referralLink,
            'price_per_slot' => $request->pricePerSlot,
            'slots_count' => $request->slotsCount,
            'paid_slots_count' => $request->paidSlotsCount ?? $request->slotsCount,
            'end_date' => $request->endDate,
            'status' => $request->status ?? 'active',
            'slots_config' => $request->slotsConfig,
        ]);

        // Reload to get calculated values
        $integration->refresh();

        return response()->json([
            'id' => (string) $integration->id,
            'projectId' => (string) $integration->project_id,
            'bloggerName' => $integration->blogger_name,
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
            'bloggerCabinetToken' => $integration->blogger_cabinet_token,
            'slotsConfig' => $integration->slots_config ?? [],
        ], 201);
    }

    public function update(Request $request, Integration $integration)
    {
        $request->validate([
            'bloggerName' => 'sometimes|required|string|max:255',
            'startDate' => 'sometimes|required|date',
            'platform' => 'sometimes|required|in:Telegram,Instagram,YouTube,MAX',
            'referralLink' => 'nullable|string',
            'pricePerSlot' => 'sometimes|required|numeric|min:0',
            'slotsCount' => 'sometimes|required|integer|min:1',
            'paidSlotsCount' => 'nullable|integer|min:0',
            'endDate' => 'sometimes|required|date',
            'status' => 'sometimes|required|in:active,completed,paused',
            'slotsConfig' => 'nullable|array',
        ]);

        $updateData = [];
        if ($request->has('bloggerName')) $updateData['blogger_name'] = $request->bloggerName;
        if ($request->has('startDate')) $updateData['start_date'] = $request->startDate;
        if ($request->has('platform')) $updateData['platform'] = $request->platform;
        if ($request->has('referralLink')) $updateData['referral_link'] = $request->referralLink;
        if ($request->has('pricePerSlot')) $updateData['price_per_slot'] = $request->pricePerSlot;
        if ($request->has('slotsCount')) $updateData['slots_count'] = $request->slotsCount;
        if ($request->has('paidSlotsCount')) $updateData['paid_slots_count'] = $request->paidSlotsCount;
        if ($request->has('endDate')) $updateData['end_date'] = $request->endDate;
        if ($request->has('status')) $updateData['status'] = $request->status;
        if ($request->has('slotsConfig')) $updateData['slots_config'] = $request->slotsConfig;

        $integration->update($updateData);

        return response()->json([
            'id' => (string) $integration->id,
            'projectId' => (string) $integration->project_id,
            'bloggerName' => $integration->blogger_name,
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
            'bloggerCabinetToken' => $integration->blogger_cabinet_token,
            'slotsConfig' => $integration->slots_config ?? [],
        ]);
    }

    public function destroy(Integration $integration)
    {
        $integration->delete();
        return response()->noContent();
    }
}
