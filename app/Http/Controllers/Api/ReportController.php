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
            'paymentType' => 'nullable|string|in:prepaid,full,other',
            'date' => 'required|date',
            'projectId' => 'required_unless:paymentType,other|nullable|exists:projects,id',
            'destination' => 'required|string|max:255',
            'channelBlogger' => 'required_unless:paymentType,other|nullable|string|max:255',
            'platform' => 'required_unless:paymentType,other|nullable|in:Telegram,Instagram,YouTube,MAX',
            'slotsCount' => 'required_unless:paymentType,other|nullable|integer|min:1',
            'paidSlotsCount' => 'required_unless:paymentType,other|nullable|integer|min:0',
            'pricePerSlot' => 'required_unless:paymentType,other|nullable|numeric|min:0',
            'comments' => 'nullable|string',
            'slotsConfig' => 'nullable|array',
            'amount' => 'required_if:paymentType,other|nullable|numeric|min:0',
            'receipt' => 'nullable|string',
            'lang' => 'nullable|string|in:ru,en,uz',
        ]);

        $paymentType = $request->input('paymentType', 'prepaid');

        $reportData = [
            'payment_type' => $paymentType,
            'date' => $request->date,
            'project_id' => $request->projectId ?: null,
            'destination' => $request->destination,
            'comments' => $request->comments,
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

        // Auto-create or merge Integration record ONLY if paymentType is not other and project_id is not null
        if ($paymentType !== 'other' && $report->project_id !== null) {
            $cleanBloggerName = trim(str_replace(['@', '#'], '', $report->channel_blogger));
            
            // Search for existing integration by project_id, platform, and blogger_name (case insensitive)
            $existingIntegration = Integration::where('project_id', $report->project_id)
                ->where('platform', $report->platform)
                ->whereRaw('LOWER(blogger_name) = ?', [strtolower($cleanBloggerName)])
                ->first();

            if ($existingIntegration) {
                // Merge data into existing integration
                $newSlotsCount = $existingIntegration->slots_count + $report->slots_count;
                $newPaidSlotsCount = $existingIntegration->paid_slots_count + $report->paid_slots_count;
                $mergedSlotsConfig = array_merge($existingIntegration->slots_config ?? [], $report->slots_config ?? []);

                $existingIntegration->update([
                    'price_per_slot' => $report->price_per_slot, // update to latest price
                    'slots_count' => $newSlotsCount,
                    'paid_slots_count' => $newPaidSlotsCount,
                    'slots_config' => $mergedSlotsConfig,
                ]);
            } else {
                // Create new integration
                $slugName = Str::slug($cleanBloggerName, '_');
                $token = 'tok_' . time() . '_' . $slugName;
                $referralLink = $report->destination;
                
                $startDate = \Carbon\Carbon::parse($report->date);
                $endDate = $startDate->copy()->addDays(14);

                Integration::create([
                    'project_id' => $report->project_id,
                    'blogger_name' => $cleanBloggerName,
                    'start_date' => $startDate,
                    'platform' => $report->platform,
                    'referral_link' => $referralLink,
                    'price_per_slot' => $report->price_per_slot,
                    'slots_count' => $report->slots_count,
                    'paid_slots_count' => $report->paid_slots_count,
                    'end_date' => $endDate,
                    'status' => 'active',
                    'blogger_cabinet_token' => $token,
                    'slots_config' => $report->slots_config,
                ]);
            }
        }

        // Reload to get calculated values
        $report->refresh();
        $report->load('project');

        $cabinetToken = null;
        if ($paymentType !== 'other' && $report->project_id !== null) {
            $cleanBloggerName = trim(str_replace(['@', '#'], '', $report->channel_blogger));
            $integration = Integration::where('project_id', $report->project_id)
                ->where('platform', $report->platform)
                ->whereRaw('LOWER(blogger_name) = ?', [strtolower($cleanBloggerName)])
                ->first();
            if ($integration) {
                $cabinetToken = $integration->blogger_cabinet_token;
            }
        }

        // Trigger Telegram & Google Sheets notifications independently after response to speed up submission
        $lang = $request->input('lang', 'ru');
        $receipt = $request->receipt;
        
        $email = $request->header('X-User-Email');
        $createdByName = null;
        if ($email) {
            $user = \App\Models\User::where('email', strtolower(trim($email)))->first();
            $createdByName = $user ? $user->name : $email;
        }

        dispatch(function () use ($report, $receipt, $lang, $createdByName) {
            try {
                \App\Services\TelegramService::sendReportNotification($report, $receipt, $lang, $createdByName);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error("Failed to send Telegram report notification: " . $e->getMessage());
            }

            try {
                \App\Services\GoogleSheetsService::appendReport($report);
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
        $report->delete();
        return response()->json(['success' => true], 200);
    }
}
