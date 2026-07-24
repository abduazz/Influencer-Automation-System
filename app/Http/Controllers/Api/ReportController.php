<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Report;
use App\Models\Integration;
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
            'destination' => 'required|string|max:255',
            'channelBlogger' => 'required_unless:paymentType,other|nullable|string|max:255',
            'platform' => 'required_unless:paymentType,other|nullable|in:Telegram,Instagram,YouTube,MAX',
            'slotsCount' => 'required_unless:paymentType,other|nullable|integer|min:0',
            'paidSlotsCount' => 'required_unless:paymentType,other|nullable|integer|min:0',
            'pricePerSlot' => 'required_unless:paymentType,other|nullable|numeric|min:0',
            'comments' => 'nullable|string',
            'slotsConfig' => 'nullable|array',
            'amount' => 'required_if:paymentType,other|nullable|numeric|min:0',
            'receipt' => 'nullable|string',
            'lang' => 'nullable|string|in:ru,en,uz',
        ]);

        $paymentType = $request->input('paymentType', 'prepaid');

        $email = $request->header('X-User-Email');
        $createdByName = null;
        if ($email) {
            $user = \App\Models\User::where('email', strtolower(trim($email)))->first();
            $createdByName = $user ? $user->name : $email;
        }

        $reportData = [
            'payment_type' => $paymentType,
            'date' => $request->date,
            'project_id' => $request->projectId ?: null,
            'destination' => $request->destination,
            'comments' => $request->comments,
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
            $reportData['platform'] = null;
            $reportData['slots_config'] = null;
        } else {
            $reportData['channel_blogger'] = $request->channelBlogger;
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
                $existingIntegration = Integration::where('project_id', $targetProjectId)
                    ->where('platform', $report->platform)
                    ->whereRaw('LOWER(blogger_name) = ?', [strtolower($cleanBloggerName)])
                    ->first();

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
                        $existingIntegration->update([
                            'paid_slots_count' => $newPaidSlotsCount,
                        ]);
                    } else {
                        $newSlotsCount = $existingIntegration->slots_count + $groupSlotsCount;
                        $newPaidSlotsCount = $existingIntegration->paid_slots_count + $groupPaidSlotsCount;
                        $mergedSlotsConfig = array_merge($existingIntegration->slots_config ?? [], $groupSlotsConfig);

                        $existingIntegration->update([
                            'price_per_slot' => $report->price_per_slot,
                            'slots_count' => $newSlotsCount,
                            'paid_slots_count' => $newPaidSlotsCount,
                            'slots_config' => $mergedSlotsConfig,
                        ]);
                    }
                } else {
                    $slugName = Str::slug($cleanBloggerName, '_');
                    $token = 'tok_' . time() . '_' . Str::random(6) . '_' . $slugName;
                    $referralLink = $report->destination;
                    $startDate = \Carbon\Carbon::parse($report->date);
                    $endDate = $startDate->copy()->addDays(14);

                    Integration::create([
                        'project_id' => $targetProjectId,
                        'blogger_name' => $cleanBloggerName,
                        'start_date' => $startDate,
                        'platform' => $report->platform,
                        'referral_link' => $referralLink,
                        'price_per_slot' => $report->price_per_slot,
                        'slots_count' => $groupSlotsCount,
                        'paid_slots_count' => $groupPaidSlotsCount,
                        'end_date' => $endDate,
                        'status' => 'active',
                        'blogger_cabinet_token' => $token,
                        'slots_config' => $groupSlotsConfig,
                    ]);
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
        $receipt = $request->receipt;
        
        $createdByName = $report->created_by;
 
        dispatch(function () use ($report, $receipt, $lang, $createdByName) {
            try {
                $tgSuccess = \App\Services\TelegramService::sendReportNotification($report, $receipt, $lang, $createdByName);
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
            'receipt' => null,
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

    public function destroy(Report $report)
    {
        $projectId = $report->project_id;
        $platform = $report->platform;
        $channelBlogger = $report->channel_blogger;
        $paymentType = $report->payment_type;

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
                    $first = true;
                    $pricePerSlot = 0;
                    $slotsCount = 0;
                    $paidSlotsCount = 0;
                    $slotsConfig = [];
                    $referralLink = null;
                    $startDate = null;

                    foreach ($remainingReports as $rep) {
                        if ($first) {
                            $startDate = \Carbon\Carbon::parse($rep->date);
                            $referralLink = $rep->destination;
                            $pricePerSlot = $rep->price_per_slot;
                            if ($rep->payment_type === 'remaining') {
                                $slotsCount = $rep->paid_slots_count;
                                $paidSlotsCount = $rep->paid_slots_count;
                            } else {
                                $slotsCount = $rep->slots_count;
                                $paidSlotsCount = $rep->paid_slots_count;
                            }
                            $slotsConfig = $rep->slots_config ?? [];
                            $first = false;
                        } else {
                            if ($rep->payment_type === 'remaining') {
                                $paidSlotsCount += $rep->paid_slots_count;
                            } else {
                                $slotsCount += $rep->slots_count;
                                $paidSlotsCount += $rep->paid_slots_count;
                                $slotsConfig = array_merge($slotsConfig, $rep->slots_config ?? []);
                                $pricePerSlot = $rep->price_per_slot;
                            }
                        }
                    }

                    if ($slotsCount > 0) {
                        $paidSlotsCount = min($slotsCount, $paidSlotsCount);
                    }

                    $integration->update([
                        'price_per_slot' => $pricePerSlot,
                        'slots_count' => $slotsCount,
                        'paid_slots_count' => $paidSlotsCount,
                        'slots_config' => $slotsConfig,
                        'referral_link' => $referralLink,
                        'start_date' => $startDate,
                        'end_date' => $startDate ? $startDate->copy()->addDays(14) : null,
                    ]);
                }
            }
        }

        return response()->json(['success' => true], 200);
    }
}
