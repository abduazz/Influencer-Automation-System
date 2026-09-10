<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Integration;
use App\Services\InstagramApiService;
use Illuminate\Http\Request;

class IntegrationController extends Controller
{
    private function formatIntegration(Integration $integration): array
    {
        return [
            'id' => (string) $integration->id,
            'projectId' => (string) $integration->project_id,
            'bloggerName' => $integration->blogger_name,
            'bloggerPageLink' => $integration->blogger_page_link ?? '',
            'telegramUsername' => $integration->telegram_username ?? '',
            'startDate' => $integration->start_date ? $integration->start_date->format('Y-m-d') : '',
            'platform' => $integration->platform,
            'referralLink' => $integration->referral_link ?? '',
            'pricePerSlot' => (float) $integration->price_per_slot,
            'slotsCount' => $integration->slots_count,
            'paidSlotsCount' => $integration->paid_slots_count,
            'paidAmount' => (float) $integration->paid_amount,
            'totalAmount' => (float) $integration->total_amount,
            'endDate' => $integration->end_date ? $integration->end_date->format('Y-m-d') : '',
            'status' => $integration->status,
            'kanbanStage' => $integration->kanban_stage,
            'createdBy' => $integration->created_by ?? '',
            'bloggerCabinetToken' => $integration->blogger_cabinet_token,
            'slotsConfig' => $integration->slots_config ?? [],
            'comments' => $integration->comments ?? [],
            'subscribersCount' => $integration->subscribers_count ? (int) $integration->subscribers_count : null,
            'subscribersUpdatedAt' => $integration->subscribers_updated_at ? $integration->subscribers_updated_at->toISOString() : null,
            'subscribersHistory' => $integration->subscribers_history ?? [],
        ];
    }

    public function index()
    {
        return response()->json(
            Integration::orderBy('start_date', 'desc')
                ->orderBy('id', 'desc')
                ->get()
                ->map(fn($integration) => $this->formatIntegration($integration))
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'projectId' => 'required|exists:projects,id',
            'bloggerName' => 'required|string|max:255',
            'bloggerPageLink' => 'nullable|string',
            'telegramUsername' => 'nullable|string',
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
            'subscribersCount' => 'nullable|integer|min:0',
            'subscribersHistory' => 'nullable|array',
        ]);

        $email = $request->header('X-User-Email') ?: $request->input('createdBy');
        $createdByName = null;
        if ($email) {
            $user = \App\Models\User::where('email', strtolower(trim($email)))->first();
            $createdByName = $user ? $user->name : $email;
        } elseif ($request->filled('createdBy')) {
            $createdByName = $request->input('createdBy');
        }

        $subscribersCount = $request->input('subscribersCount');
        $subscribersHistory = $request->input('subscribersHistory');

        // If subscribersCount is provided but history is empty, generate initial realistic history
        if ($subscribersCount && empty($subscribersHistory)) {
            $subscribersHistory = InstagramApiService::generateInitialHistory((int) $subscribersCount);
        }

        $integration = Integration::create([
            'project_id' => $request->projectId,
            'blogger_name' => $request->bloggerName,
            'blogger_page_link' => $request->bloggerPageLink,
            'telegram_username' => $request->input('telegramUsername'),
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
            'subscribers_count' => $subscribersCount,
            'subscribers_updated_at' => $subscribersCount ? now() : null,
            'subscribers_history' => $subscribersHistory,
        ]);

        $integration->refresh();

        return response()->json($this->formatIntegration($integration), 201);
    }

    public function update(Request $request, Integration $integration)
    {
        $request->validate([
            'projectId' => 'sometimes|required|exists:projects,id',
            'bloggerName' => 'sometimes|required|string|max:255',
            'bloggerPageLink' => 'nullable|string',
            'telegramUsername' => 'nullable|string',
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
            'subscribersCount' => 'nullable|integer|min:0',
            'subscribersHistory' => 'nullable|array',
        ]);

        $updateData = [];
        if ($request->has('projectId')) $updateData['project_id'] = $request->projectId;
        if ($request->has('bloggerName')) $updateData['blogger_name'] = $request->bloggerName;
        if ($request->has('bloggerPageLink')) $updateData['blogger_page_link'] = $request->bloggerPageLink;
        if ($request->has('telegramUsername')) $updateData['telegram_username'] = $request->input('telegramUsername');
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

        if ($request->has('subscribersCount')) {
            $updateData['subscribers_count'] = $request->subscribersCount;
            $updateData['subscribers_updated_at'] = now();
        }

        if ($request->has('subscribersHistory')) {
            $updateData['subscribers_history'] = $request->subscribersHistory;
        }

        $integration->update($updateData);

        return response()->json($this->formatIntegration($integration));
    }

    public function destroy(Integration $integration)
    {
        $integration->delete();
        return response()->noContent();
    }

    /**
     * Refresh / fetch subscriber count via InstagramApiService.
     * Updates this integration and syncs to any other integration with the same blogger name.
     */
    public function refreshSubscribers(Integration $integration, InstagramApiService $apiService)
    {
        $platform = $integration->platform ?? 'Instagram';

        // Pick best identifier based on platform
        if (strtolower($platform) === 'telegram') {
            $targetHandle = $integration->telegram_username 
                ?: $integration->blogger_page_link 
                ?: $integration->blogger_name;
        } else {
            $targetHandle = $integration->blogger_page_link 
                ?: $integration->blogger_name 
                ?: $integration->telegram_username;
        }

        $result = $apiService->fetchSubscriberCount(
            $platform,
            $targetHandle ?? '',
            $integration->subscribers_count
        );

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'message' => $result['error'] ?? 'Не удалось получить данные подписчиков',
                'integration' => $this->formatIntegration($integration)
            ], 422);
        }

        $newCount = (int) $result['count'];
        $history = $integration->subscribers_history ?? [];

        if (empty($history)) {
            // Generate initial realistic ramp if it's the first time
            $history = InstagramApiService::generateInitialHistory($newCount, $result['source']);
        } else {
            // Check if today's entry already exists
            $today = now()->format('Y-m-d');
            $updatedToday = false;

            foreach ($history as &$entry) {
                if (isset($entry['date']) && $entry['date'] === $today) {
                    $entry['count'] = $newCount;
                    $entry['source'] = $result['source'];
                    $updatedToday = true;
                    break;
                }
            }
            unset($entry);

            if (!$updatedToday) {
                $history[] = [
                    'date' => $today,
                    'count' => $newCount,
                    'source' => $result['source'],
                ];
            }
        }

        // Sort history by date ascending
        usort($history, fn($a, $b) => strcmp($a['date'] ?? '', $b['date'] ?? ''));

        $updatePayload = [
            'subscribers_count' => $newCount,
            'subscribers_updated_at' => now(),
            'subscribers_history' => $history,
        ];

        $integration->update($updatePayload);

        // Sync with any other deals with the same clean blogger name
        $cleanName = strtolower(trim(ltrim($integration->blogger_name, '@#')));
        if ($cleanName) {
            $otherDeals = Integration::where('id', '!=', $integration->id)->get();
            foreach ($otherDeals as $otherDeal) {
                if (strtolower(trim(ltrim($otherDeal->blogger_name, '@#'))) === $cleanName) {
                    $otherDeal->update($updatePayload);
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Количество подписчиков успешно обновлено!',
            'integration' => $this->formatIntegration($integration->fresh()),
        ]);
    }

    /**
     * Add a custom history checkpoint manually.
     */
    public function addSubscriberHistory(Request $request, Integration $integration)
    {
        $request->validate([
            'date' => 'required|date',
            'count' => 'required|integer|min:0',
            'note' => 'nullable|string|max:255',
        ]);

        $date = $request->input('date');
        $count = (int) $request->input('count');
        $note = $request->input('note');

        $history = $integration->subscribers_history ?? [];
        $replaced = false;

        foreach ($history as &$item) {
            if (isset($item['date']) && $item['date'] === $date) {
                $item['count'] = $count;
                $item['source'] = 'manual';
                if ($note) $item['note'] = $note;
                $replaced = true;
                break;
            }
        }
        unset($item);

        if (!$replaced) {
            $history[] = [
                'date' => $date,
                'count' => $count,
                'source' => 'manual',
                'note' => $note,
            ];
        }

        // Sort history by date
        usort($history, fn($a, $b) => strcmp($a['date'] ?? '', $b['date'] ?? ''));

        // If this entry is latest date or today, also update current subscribers_count
        $latestDate = end($history)['date'] ?? null;
        $latestCount = end($history)['count'] ?? $count;

        $updateData = [
            'subscribers_history' => $history,
            'subscribers_count' => $latestCount,
            'subscribers_updated_at' => now(),
        ];

        $integration->update($updateData);

        // Sync to same blogger
        $cleanName = strtolower(trim(ltrim($integration->blogger_name, '@#')));
        if ($cleanName) {
            $otherDeals = Integration::where('id', '!=', $integration->id)->get();
            foreach ($otherDeals as $otherDeal) {
                if (strtolower(trim(ltrim($otherDeal->blogger_name, '@#'))) === $cleanName) {
                    $otherDeal->update($updateData);
                }
            }
        }

        return response()->json([
            'success' => true,
            'integration' => $this->formatIntegration($integration->fresh()),
        ]);
    }
}
