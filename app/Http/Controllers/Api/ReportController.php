<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\Integration;
use App\Services\TelegramService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ReportController extends Controller
{
    public function index()
    {
        return response()->json(Report::with('project')->latest('date')->get()->map(function ($report) {
            return [
                'id' => (string) $report->id,
                'date' => $report->date->format('Y-m-d'),
                'projectId' => $report->project_id ? (string) $report->project_id : null,
                'projectName' => $report->project?->name ?? '',
                'destination' => $report->destination,
                'channelBlogger' => $report->channel_blogger,
                'bloggerPageLink' => $report->blogger_page_link,
                'platform' => $report->platform,
                'slotsCount' => $report->slots_count,
                'paidSlotsCount' => $report->paid_slots_count,
                'pricePerSlot' => (float) $report->price_per_slot,
                'paidAmount' => (float) $report->paid_amount,
                'totalAmount' => (float) $report->total_amount,
                'comments' => $report->comments ?? '',
                'slotsConfig' => $report->slots_config ?? [],
                'paymentType' => $report->payment_type,
                'receipt' => $report->receipt,
                'receipts' => $report->receipts,
                'telegramMessageUrl' => $report->telegram_message_url ?? null,
                'createdBy' => $report->created_by,
            ];
        }));
    }

    public function store(Request $request)
    {
        try {
        if ($request->input('projectId') === '') {
            $request->merge(['projectId' => null]);
        }

        $validated = $request->validate([
            'paymentType' => 'nullable|string|in:prepaid,full,other,remaining',
            'date' => 'required|date',
            'projectId' => 'nullable|exists:projects,id',
            'destination' => 'required_if:paymentType,other|nullable|string|max:255',
            'channelBlogger' => 'required_unless:paymentType,other|nullable|string|max:255',
            'bloggerPageLink' => 'required_unless:paymentType,other|nullable|string',
            'platform' => 'required_unless:paymentType,other|nullable|in:Telegram,Instagram,YouTube,MAX,TikTok',
            'slotsCount' => 'required_unless:paymentType,other|nullable|integer|min:0',
            'paidSlotsCount' => 'required_unless:paymentType,other|nullable|integer|min:0',
            'pricePerSlot' => 'required_unless:paymentType,other|nullable|numeric|gt:0',
            'comments' => 'nullable|string',
            'slotsConfig' => 'nullable|array',
            'amount' => 'required_if:paymentType,other|nullable|numeric|gt:0',
            'receipt' => 'nullable|string',
            'receipts' => 'nullable|array',
            'receipts.*' => 'nullable|string',
            'lang' => 'nullable|string|in:ru,en,uz',
            'integrationId' => 'nullable|string',
            'createdBy' => 'nullable|string',
        ], [
            'pricePerSlot.gt' => 'Сумма не должна быть равна нулю.',
            'amount.gt' => 'Сумма не должна быть равна нулю.',
        ]);

        $paymentType = $request->input('paymentType', 'prepaid');

        $createdByName = $request->input('createdBy');
        if (empty($createdByName)) {
            $email = $request->header('X-User-Email');
            if ($email) {
                $user = \App\Models\User::where('email', strtolower(trim($email)))->first();
                $createdByName = $user ? $user->name : $email;
            }
        }

        $receipts = [];
        if ($request->has('receipts') && is_array($request->input('receipts'))) {
            $receipts = array_values(array_filter($request->input('receipts'), fn($r) => !empty($r) && is_string($r)));
        }
        if (empty($receipts) && $request->filled('receipt')) {
            $rawReceipt = $request->input('receipt');
            $trimmed = trim($rawReceipt);
            if (str_starts_with($trimmed, '[') && str_ends_with($trimmed, ']')) {
                $decoded = json_decode($trimmed, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $receipts = array_values(array_filter($decoded, fn($r) => !empty($r) && is_string($r)));
                } else {
                    $receipts = [$rawReceipt];
                }
            } else {
                $receipts = [$rawReceipt];
            }
        }

        $receiptToStore = null;
        if (count($receipts) === 1) {
            $receiptToStore = $receipts[0];
        } elseif (count($receipts) > 1) {
            $receiptToStore = json_encode($receipts);
        }

        $reportData = [
            'payment_type' => $paymentType,
            'date' => $request->date,
            'project_id' => $request->projectId ?: null,
            'destination' => $request->destination ?: null,
            'comments' => $request->comments,
            'receipt' => $receiptToStore,
            'created_by' => $createdByName,
        ];

        if ($paymentType === 'other') {
            $amount = $request->input('amount');
            $reportData['total_amount'] = $amount;
            $reportData['paid_amount'] = $amount;
            $reportData['price_per_slot'] = $amount;
            $reportData['slots_count'] = 1;
            $reportData['paid_slots_count'] = 1;
            $reportData['channel_blogger'] = null;
            $reportData['blogger_page_link'] = null;
            $reportData['platform'] = null;
            $reportData['slots_config'] = null;
        } else {
            $reportData['channel_blogger'] = $request->channelBlogger;
            $reportData['blogger_page_link'] = $request->bloggerPageLink;
            $reportData['platform'] = $request->platform;
            $reportData['slots_count'] = $request->slotsCount;
            $reportData['paid_slots_count'] = $request->paidSlotsCount;
            $reportData['price_per_slot'] = $request->pricePerSlot;
            $reportData['slots_config'] = $request->slotsConfig;
        }

        $report = Report::create($reportData);

        // Auto-create or merge Integration records for each allocated project
        if ($paymentType !== 'other') {
            $cleanBloggerName = trim(str_replace(['@', '#'], '', $report->channel_blogger));
            
            // Group slots by projectId
            $projectGroups = [];
            if (!empty($report->slots_config) && is_array($report->slots_config)) {
                foreach ($report->slots_config as $slot) {
                    $pId = !empty($slot['projectId']) ? (string)$slot['projectId'] : null;
                    if ($pId !== null) {
                        if (!isset($projectGroups[$pId])) {
                            $projectGroups[$pId] = [
                                'slots_count' => 0,
                                'slots_config' => [],
                            ];
                        }
                        $projectGroups[$pId]['slots_count']++;
                        $projectGroups[$pId]['slots_config'][] = $slot;
                    }
                }
            }

            // Fallback to single project_id if no per-slot project was specified
            if (empty($projectGroups) && $report->project_id !== null) {
                $projectGroups[(string)$report->project_id] = [
                    'slots_count' => $report->slots_count,
                    'slots_config' => $report->slots_config ?? [],
                ];
            }

            foreach ($projectGroups as $targetProjectId => $group) {
                $existingIntegration = null;
                if ($request->filled('integrationId')) {
                    $existingIntegration = Integration::find($request->input('integrationId'));
                }
                if (!$existingIntegration) {
                    $existingIntegration = Integration::where('project_id', $targetProjectId)
                        ->where('platform', $report->platform)
                        ->whereRaw('LOWER(blogger_name) = ?', [strtolower($cleanBloggerName)])
                        ->first();
                }

                $groupSlotsCount = $group['slots_count'];
                $groupSlotsConfig = $group['slots_config'];

                if ($paymentType === 'full') {
                    $groupPaidSlotsCount = $groupSlotsCount;
                } else if ($paymentType === 'remaining') {
                    $groupPaidSlotsCount = ($groupSlotsCount > 0) ? $groupSlotsCount : $report->paid_slots_count;
                } else {
                    $groupPaidSlotsCount = ($report->slots_count > 0)
                        ? (int) round(($groupSlotsCount / $report->slots_count) * $report->paid_slots_count)
                        : $report->paid_slots_count;
                }

                if ($existingIntegration) {
                    if ($paymentType === 'remaining') {
                        $newPaidSlotsCount = min($existingIntegration->slots_count, $existingIntegration->paid_slots_count + $groupPaidSlotsCount);
                        $existingIntegrationUpdate = [
                            'paid_slots_count' => $newPaidSlotsCount,
                        ];
                        if (!empty($report->blogger_page_link)) {
                            $existingIntegrationUpdate['blogger_page_link'] = $report->blogger_page_link;
                        }
                    } else if ($existingIntegration->kanban_stage === 'ready_for_payment') {
                        // The deal was at "ready_for_payment" stage in Kanban; this report fulfills it.
                        $existingIntegrationUpdate = [
                            'price_per_slot' => $report->price_per_slot,
                            'slots_count' => max($existingIntegration->slots_count, $groupSlotsCount),
                            'paid_slots_count' => max($existingIntegration->paid_slots_count, $groupPaidSlotsCount),
                            'slots_config' => !empty($groupSlotsConfig) ? $groupSlotsConfig : $existingIntegration->slots_config,
                            'kanban_stage' => 'paid_in_progress',
                        ];
                        if (!empty($report->blogger_page_link)) {
                            $existingIntegrationUpdate['blogger_page_link'] = $report->blogger_page_link;
                        }
                    } else {
                        $newSlotsCount = $existingIntegration->slots_count + $groupSlotsCount;
                        $newPaidSlotsCount = $existingIntegration->paid_slots_count + $groupPaidSlotsCount;
                        $mergedSlotsConfig = array_merge($existingIntegration->slots_config ?? [], $groupSlotsConfig);

                        $existingIntegrationUpdate = [
                            'price_per_slot' => $report->price_per_slot,
                            'slots_count' => $newSlotsCount,
                            'paid_slots_count' => $newPaidSlotsCount,
                            'slots_config' => $mergedSlotsConfig,
                        ];
                        if (!empty($report->blogger_page_link)) {
                            $existingIntegrationUpdate['blogger_page_link'] = $report->blogger_page_link;
                        }
                    }

                    if (empty($existingIntegration->kanban_stage) || in_array($existingIntegration->kanban_stage, ['wishlist', 'negotiation', 'requisites_pending', 'ready_for_payment'], true)) {
                        $existingIntegrationUpdate['kanban_stage'] = 'paid_in_progress';
                    }

                    if (!empty($report->destination) && empty($existingIntegration->referral_link)) {
                        $existingIntegrationUpdate['referral_link'] = $report->destination;
                    }

                    $reportDate = \Carbon\Carbon::parse($report->date);
                    $targetEndDate = $reportDate->copy()->addDays(14);
                    if (!$existingIntegration->start_date || $reportDate->lt($existingIntegration->start_date)) {
                        $existingIntegrationUpdate['start_date'] = $reportDate;
                    }
                    if (!$existingIntegration->end_date || $targetEndDate->gt($existingIntegration->end_date)) {
                        $existingIntegrationUpdate['end_date'] = $targetEndDate;
                    }

                    if (empty($existingIntegration->created_by) && !empty($createdByName)) {
                        $existingIntegrationUpdate['created_by'] = $createdByName;
                    }

                    $existingIntegration->update($existingIntegrationUpdate);
                    $existingIntegration->syncWithReports();
                } else {
                    $token = Integration::generateCabinetToken($cleanBloggerName);
                    $referralLink = $report->destination;
                    $startDate = \Carbon\Carbon::parse($report->date);
                    $endDate = $startDate->copy()->addDays(14);

                    $newIntegration = Integration::create([
                        'project_id' => $targetProjectId,
                        'blogger_name' => $cleanBloggerName,
                        'blogger_page_link' => $report->blogger_page_link,
                        'start_date' => $startDate,
                        'platform' => $report->platform,
                        'referral_link' => $referralLink,
                        'price_per_slot' => $report->price_per_slot,
                        'slots_count' => $groupSlotsCount,
                        'paid_slots_count' => $groupPaidSlotsCount,
                        'end_date' => $endDate,
                        'status' => 'active',
                        'kanban_stage' => 'paid_in_progress',
                        'blogger_cabinet_token' => $token,
                        'slots_config' => $groupSlotsConfig,
                        'created_by' => $createdByName,
                    ]);
                    $newIntegration->syncWithReports();
                }
            }
        }

        // Reload to get calculated values
        $report->refresh();
        $report->load('project');

        $cabinetToken = null;
        if ($paymentType !== 'other') {
            $cleanBloggerName = trim(str_replace(['@', '#'], '', $report->channel_blogger));
            $targetProj = $report->project_id;
            if (!$targetProj && !empty($report->slots_config)) {
                foreach ($report->slots_config as $slot) {
                    if (!empty($slot['projectId'])) {
                        $targetProj = $slot['projectId'];
                        break;
                    }
                }
            }

            if ($targetProj) {
                $integration = Integration::where('project_id', $targetProj)
                    ->where('platform', $report->platform)
                    ->whereRaw('LOWER(blogger_name) = ?', [strtolower($cleanBloggerName)])
                    ->first();
                if ($integration) {
                    $cabinetToken = $integration->blogger_cabinet_token;
                }
            }
        }

        // Trigger Telegram & Google Sheets notifications independently after response to speed up submission
        $lang = $request->input('lang', 'uz');
        $receiptsForTg = $receipts;
        
        $createdByName = $report->created_by;
 
        dispatch(function () use ($report, $receiptsForTg, $lang, $createdByName) {
            try {
                $tgSuccess = \App\Services\TelegramService::sendReportNotification($report, $receiptsForTg, $lang, $createdByName);
                if ($tgSuccess) {
                    $report->update(['telegram_sent' => true]);
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error("Failed to send Telegram report notification: " . $e->getMessage());
            }
 
            try {
                $sheetsSuccess = \App\Services\GoogleSheetsService::appendReport($report);
                if ($sheetsSuccess) {
                    $report->update(['sheets_sent' => true]);
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error("Failed to append report to Google Sheets: " . $e->getMessage());
            }
        })->afterResponse();
 
        return response()->json([
            'id' => (string) $report->id,
            'date' => $report->date->format('Y-m-d'),
            'projectId' => $report->project_id ? (string) $report->project_id : null,
            'projectName' => $report->project?->name ?? '',
            'destination' => $report->destination,
            'channelBlogger' => $report->channel_blogger,
            'platform' => $report->platform,
            'slotsCount' => $report->slots_count,
            'paidSlotsCount' => $report->paid_slots_count,
            'pricePerSlot' => (float) $report->price_per_slot,
            'paidAmount' => (float) $report->paid_amount,
            'totalAmount' => (float) $report->total_amount,
            'comments' => $report->comments ?? '',
            'slotsConfig' => $report->slots_config ?? [],
            'paymentType' => $report->payment_type,
            'receipt' => $report->receipt,
            'receipts' => $report->receipts,
            'telegramMessageUrl' => $report->telegram_message_url ?? null,
            'bloggerCabinetToken' => $cabinetToken,
            'createdBy' => $report->created_by,
        ], 201);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Report store error: ' . $e->getMessage() . ' | ' . $e->getFile() . ':' . $e->getLine());
            return response()->json([
                'message' => $e->getMessage(),
                'file' => basename($e->getFile()),
                'line' => $e->getLine(),
            ], 500);
        }
    }

    public function update(Request $request, Report $report)
    {
        try {
            $request->validate([
                'paymentType' => 'nullable|string|in:prepaid,full,other,remaining',
                'date' => 'sometimes|required|date',
                'projectId' => 'nullable|exists:projects,id',
                'destination' => 'nullable|string|max:255',
                'channelBlogger' => 'nullable|string|max:255',
                'bloggerPageLink' => 'nullable|string',
                'platform' => 'nullable|in:Telegram,Instagram,YouTube,MAX,TikTok',
                'slotsCount' => 'nullable|integer|min:0',
                'paidSlotsCount' => 'nullable|integer|min:0',
                'pricePerSlot' => 'nullable|numeric|min:0',
                'comments' => 'nullable|string',
                'slotsConfig' => 'nullable|array',
                'amount' => 'nullable|numeric|min:0',
                'receipt' => 'nullable|string',
                'receipts' => 'nullable|array',
            ]);

            $oldProject = $report->project_id;
            $oldPlatform = $report->platform;
            $oldBlogger = $report->channel_blogger;

            $updateData = [];
            if ($request->has('date')) $updateData['date'] = $request->date;
            if ($request->has('projectId')) $updateData['project_id'] = $request->projectId ?: null;
            if ($request->has('destination')) $updateData['destination'] = $request->destination ?: null;
            if ($request->has('comments')) $updateData['comments'] = $request->comments;
            if ($request->has('channelBlogger')) $updateData['channel_blogger'] = $request->channelBlogger;
            if ($request->has('bloggerPageLink')) $updateData['blogger_page_link'] = $request->bloggerPageLink;
            if ($request->has('platform')) $updateData['platform'] = $request->platform;
            if ($request->has('slotsCount')) $updateData['slots_count'] = $request->slotsCount;
            if ($request->has('paidSlotsCount')) $updateData['paid_slots_count'] = $request->paidSlotsCount;
            if ($request->has('pricePerSlot')) $updateData['price_per_slot'] = $request->pricePerSlot;
            if ($request->has('slotsConfig')) $updateData['slots_config'] = $request->slotsConfig;
            if ($request->has('paymentType')) $updateData['payment_type'] = $request->paymentType;

            if ($request->has('receipts') && is_array($request->input('receipts'))) {
                $cleanReceipts = array_values(array_filter($request->input('receipts'), fn($r) => !empty($r) && is_string($r)));
                if (count($cleanReceipts) === 1) {
                    $updateData['receipt'] = $cleanReceipts[0];
                } elseif (count($cleanReceipts) > 1) {
                    $updateData['receipt'] = json_encode($cleanReceipts);
                } else {
                    $updateData['receipt'] = null;
                }
            } elseif ($request->has('receipt')) {
                $updateData['receipt'] = $request->input('receipt');
            }

            if ($report->payment_type === 'other' || $request->input('paymentType') === 'other') {
                if ($request->has('amount')) {
                    $amt = (float)$request->amount;
                    $updateData['total_amount'] = $amt;
                    $updateData['paid_amount'] = $amt;
                    $updateData['price_per_slot'] = $amt;
                }
            } else {
                $slots = $request->input('slotsCount', $report->slots_count) ?? 1;
                $price = $request->input('pricePerSlot', $report->price_per_slot) ?? 0;
                $paidSlots = $request->input('paidSlotsCount', $report->paid_slots_count) ?? $slots;
                if ($request->has('pricePerSlot') || $request->has('slotsCount')) {
                    $updateData['total_amount'] = $slots * $price;
                }
                if ($request->has('paidSlotsCount') || $request->has('pricePerSlot')) {
                    $updateData['paid_amount'] = $paidSlots * $price;
                }
            }

            $report->update($updateData);
            $report->refresh();

            // Sync integration if applicable
            if ($report->payment_type !== 'other') {
                $targetProject = $report->project_id ?: $oldProject;
                $targetPlatform = $report->platform ?: $oldPlatform;
                $targetBlogger = $report->channel_blogger ?: $oldBlogger;
                if ($targetProject && $targetPlatform && $targetBlogger) {
                    $cleanTarget = strtolower(trim(str_replace(['@', '#'], '', $targetBlogger)));
                    $integration = Integration::where('project_id', $targetProject)
                        ->where('platform', $targetPlatform)
                        ->whereRaw('LOWER(blogger_name) = ?', [$cleanTarget])
                        ->first();
                    if ($integration) {
                        $integration->syncWithReports();
                    }
                }
            }

            // Sync Telegram message if URL exists
            $lang = $request->input('lang', 'uz');
            dispatch(function () use ($report, $lang) {
                try {
                    TelegramService::updateReportNotification($report, $lang);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning("Failed to update Telegram report notification: " . $e->getMessage());
                }
            })->afterResponse();

            return response()->json([
                'id' => (string) $report->id,
                'date' => $report->date->format('Y-m-d'),
                'projectId' => $report->project_id ? (string) $report->project_id : null,
                'projectName' => $report->project?->name ?? '',
                'destination' => $report->destination,
                'channelBlogger' => $report->channel_blogger,
                'bloggerPageLink' => $report->blogger_page_link,
                'platform' => $report->platform,
                'slotsCount' => $report->slots_count,
                'paidSlotsCount' => $report->paid_slots_count,
                'pricePerSlot' => (float) $report->price_per_slot,
                'paidAmount' => (float) $report->paid_amount,
                'totalAmount' => (float) $report->total_amount,
                'comments' => $report->comments ?? '',
                'slotsConfig' => $report->slots_config ?? [],
                'paymentType' => $report->payment_type,
                'receipt' => $report->receipt,
                'receipts' => $report->receipts,
                'telegramMessageUrl' => $report->telegram_message_url ?? null,
                'createdBy' => $report->created_by,
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Report update error: ' . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    public function destroy(Report $report)
    {
        $projectId = $report->project_id;
        $platform = $report->platform;
        $channelBlogger = $report->channel_blogger;
        $paymentType = $report->payment_type;

        // Delete telegram notification if exists
        try {
            TelegramService::deleteReportNotification($report);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Failed to delete telegram message for report #{$report->id}: " . $e->getMessage());
        }

        $report->delete();

        if ($paymentType !== 'other' && $projectId !== null && $channelBlogger !== null && $platform !== null) {
            $cleanBloggerName = trim(str_replace(['@', '#'], '', $channelBlogger));

            $integration = Integration::where('project_id', $projectId)
                ->where('platform', $platform)
                ->whereRaw('LOWER(blogger_name) = ?', [strtolower($cleanBloggerName)])
                ->first();

            if ($integration) {
                // Find remaining reports for this integration
                $remainingReports = Report::where('project_id', $projectId)
                    ->where('platform', $platform)
                    ->get()
                    ->filter(function ($r) use ($cleanBloggerName) {
                        $rClean = trim(str_replace(['@', '#'], '', $r->channel_blogger));
                        return strtolower($rClean) === strtolower($cleanBloggerName);
                    });

                if ($remainingReports->isEmpty()) {
                    $integration->delete();
                } else {
                    $integration->syncWithReports();
                }
            }
        }

        return response()->json(['success' => true], 200);
    }
}
