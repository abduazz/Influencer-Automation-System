<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BulkPurchase;
use App\Models\Integration;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BulkPurchaseController extends Controller
{
    public function index()
    {
        return response()->json(BulkPurchase::latest('purchase_date')->get()->map(function ($bp) {
            $slots = $bp->slots_config ?? [];
            $allocatedCount = 0;
            foreach ($slots as $s) {
                if (!empty($s['projectId'])) {
                    $allocatedCount++;
                }
            }
            $remainingCount = max(0, $bp->total_slots - $allocatedCount);

            return [
                'id' => (string) $bp->id,
                'bloggerName' => $bp->blogger_name,
                'platform' => $bp->platform,
                'totalSlots' => $bp->total_slots,
                'allocatedSlots' => $allocatedCount,
                'remainingSlots' => $remainingCount,
                'pricePerSlot' => (float) $bp->price_per_slot,
                'totalAmount' => (float) $bp->total_amount,
                'paidAmount' => (float) $bp->paid_amount,
                'purchaseDate' => $bp->purchase_date->format('Y-m-d'),
                'referralLink' => $bp->referral_link ?? '',
                'receipt' => $bp->receipt,
                'comments' => $bp->comments ?? '',
                'slotsConfig' => $slots,
                'createdBy' => $bp->created_by,
            ];
        }));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'bloggerName' => 'required|string|max:255',
            'platform' => 'nullable|string|in:Telegram,Instagram,YouTube,MAX',
            'totalSlots' => 'required|integer|min:1',
            'pricePerSlot' => 'required|numeric|min:0',
            'paidAmount' => 'nullable|numeric|min:0',
            'purchaseDate' => 'required|date',
            'referralLink' => 'nullable|string',
            'receipt' => 'nullable|string',
            'comments' => 'nullable|string',
        ]);

        $email = $request->header('X-User-Email');
        $createdByName = null;
        if ($email) {
            $user = User::where('email', strtolower(trim($email)))->first();
            $createdByName = $user ? $user->name : $email;
        }

        $totalSlots = (int) $validated['totalSlots'];
        $pricePerSlot = (float) $validated['pricePerSlot'];
        $paidAmount = isset($validated['paidAmount']) && $validated['paidAmount'] !== '' ? (float) $validated['paidAmount'] : ($totalSlots * $pricePerSlot);
        $plat = $validated['platform'] ?? 'Telegram';

        // Build default slots_config (unallocated/reserve)
        $slotsConfig = [];
        for ($i = 1; $i <= $totalSlots; $i++) {
            $slotsConfig[] = [
                'slot' => $i,
                'platform' => $plat,
                'format' => $plat === 'Instagram' ? 'Stories' : ($plat === 'Telegram' ? 'Post' : 'Release'),
                'projectId' => null,
                'allocatedAt' => null,
            ];
        }

        $bp = BulkPurchase::create([
            'blogger_name' => $validated['bloggerName'],
            'platform' => $plat,
            'total_slots' => $totalSlots,
            'price_per_slot' => $pricePerSlot,
            'paid_amount' => $paidAmount,
            'total_amount' => $totalSlots * $pricePerSlot,
            'purchase_date' => $validated['purchaseDate'],
            'referral_link' => $validated['referralLink'] ?? null,
            'receipt' => $validated['receipt'] ?? null,
            'comments' => $validated['comments'] ?? null,
            'slots_config' => $slotsConfig,
            'created_by' => $createdByName,
        ]);

        // Automatically log financial report for bulk purchase
        Report::create([
            'payment_type' => 'full',
            'date' => $validated['purchaseDate'],
            'project_id' => null,
            'destination' => $validated['referralLink'] ?? ("Пакетная закупка ({$totalSlots} слотов)"),
            'channel_blogger' => $validated['bloggerName'],
            'platform' => $plat,
            'slots_count' => $totalSlots,
            'paid_slots_count' => $totalSlots,
            'price_per_slot' => $pricePerSlot,
            'paid_amount' => $paidAmount,
            'total_amount' => $totalSlots * $pricePerSlot,
            'comments' => "Оптовая закупка: " . ($validated['comments'] ?? ''),
            'receipt' => $validated['receipt'] ?? null,
            'slots_config' => $slotsConfig,
            'created_by' => $createdByName,
        ]);

        return response()->json([
            'id' => (string) $bp->id,
            'bloggerName' => $bp->blogger_name,
            'platform' => $bp->platform,
            'totalSlots' => $bp->total_slots,
            'allocatedSlots' => 0,
            'remainingSlots' => $bp->total_slots,
            'pricePerSlot' => (float) $bp->price_per_slot,
            'totalAmount' => (float) $bp->total_amount,
            'paidAmount' => (float) $bp->paid_amount,
            'purchaseDate' => $bp->purchase_date->format('Y-m-d'),
            'referralLink' => $bp->referral_link ?? '',
            'receipt' => $bp->receipt,
            'comments' => $bp->comments ?? '',
            'slotsConfig' => $slotsConfig,
            'createdBy' => $bp->created_by,
        ], 201);
    }

    public function allocate(Request $request, BulkPurchase $bulkPurchase)
    {
        $validated = $request->validate([
            'projectId' => 'required|exists:projects,id',
            'slotsCount' => 'required|integer|min:1',
        ]);

        $projectId = (string) $validated['projectId'];
        $slotsToAllocate = (int) $validated['slotsCount'];

        $slotsConfig = $bulkPurchase->slots_config ?? [];
        $unallocatedIndices = [];
        foreach ($slotsConfig as $idx => $s) {
            if (empty($s['projectId'])) {
                $unallocatedIndices[] = $idx;
            }
        }

        if (count($unallocatedIndices) < $slotsToAllocate) {
            return response()->json([
                'message' => 'Недостаточно свободных слотов в пакете',
                'available' => count($unallocatedIndices),
            ], 422);
        }

        $nowStr = now()->format('Y-m-d');
        $allocatedSlotsConfig = [];
        for ($k = 0; $k < $slotsToAllocate; $k++) {
            $targetIdx = $unallocatedIndices[$k];
            $slotsConfig[$targetIdx]['projectId'] = $projectId;
            $slotsConfig[$targetIdx]['allocatedAt'] = $nowStr;
            $allocatedSlotsConfig[] = $slotsConfig[$targetIdx];
        }

        $bulkPurchase->update([
            'slots_config' => $slotsConfig,
        ]);

        // Auto-create or merge Integration record for target project
        $cleanBloggerName = trim(str_replace(['@', '#'], '', $bulkPurchase->blogger_name));
        $existingIntegration = Integration::where('project_id', $projectId)
            ->where('platform', $bulkPurchase->platform)
            ->whereRaw('LOWER(blogger_name) = ?', [strtolower($cleanBloggerName)])
            ->first();

        if ($existingIntegration) {
            $newSlotsCount = $existingIntegration->slots_count + $slotsToAllocate;
            $newPaidSlotsCount = $existingIntegration->paid_slots_count + $slotsToAllocate;
            $mergedSlotsConfig = array_merge($existingIntegration->slots_config ?? [], $allocatedSlotsConfig);

            $existingIntegration->update([
                'price_per_slot' => $bulkPurchase->price_per_slot,
                'slots_count' => $newSlotsCount,
                'paid_slots_count' => $newPaidSlotsCount,
                'slots_config' => $mergedSlotsConfig,
            ]);
        } else {
            $slugName = Str::slug($cleanBloggerName, '_');
            $token = 'tok_' . time() . '_' . Str::random(6) . '_' . $slugName;
            $startDate = now();
            $endDate = $startDate->copy()->addDays(14);

            Integration::create([
                'project_id' => $projectId,
                'blogger_name' => $cleanBloggerName,
                'start_date' => $startDate,
                'platform' => $bulkPurchase->platform,
                'referral_link' => $bulkPurchase->referral_link ?? '',
                'price_per_slot' => $bulkPurchase->price_per_slot,
                'slots_count' => $slotsToAllocate,
                'paid_slots_count' => $slotsToAllocate,
                'end_date' => $endDate,
                'status' => 'active',
                'blogger_cabinet_token' => $token,
                'slots_config' => $allocatedSlotsConfig,
            ]);
        }

        $allocatedCount = 0;
        foreach ($slotsConfig as $s) {
            if (!empty($s['projectId'])) {
                $allocatedCount++;
            }
        }
        $remainingCount = max(0, $bulkPurchase->total_slots - $allocatedCount);

        return response()->json([
            'id' => (string) $bulkPurchase->id,
            'bloggerName' => $bulkPurchase->blogger_name,
            'platform' => $bulkPurchase->platform,
            'totalSlots' => $bulkPurchase->total_slots,
            'allocatedSlots' => $allocatedCount,
            'remainingSlots' => $remainingCount,
            'pricePerSlot' => (float) $bulkPurchase->price_per_slot,
            'totalAmount' => (float) $bulkPurchase->total_amount,
            'paidAmount' => (float) $bulkPurchase->paid_amount,
            'purchaseDate' => $bulkPurchase->purchase_date->format('Y-m-d'),
            'referralLink' => $bulkPurchase->referral_link ?? '',
            'receipt' => $bulkPurchase->receipt,
            'comments' => $bulkPurchase->comments ?? '',
            'slotsConfig' => $slotsConfig,
            'createdBy' => $bulkPurchase->created_by,
        ]);
    }

    public function destroy(BulkPurchase $bulkPurchase)
    {
        $bulkPurchase->delete();
        return response()->json(['success' => true]);
    }
}
