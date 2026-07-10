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
                'projectId' => (string) $report->project_id,
                'projectName' => $report->project->name ?? '',
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
            ];
        }));
    }

    public function store(Request $request)
    {
        $request->validate([
            'date' => 'required|date',
            'projectId' => 'required|exists:projects,id',
            'destination' => 'required|string|max:255',
            'channelBlogger' => 'required|string|max:255',
            'platform' => 'required|in:Telegram,Instagram,YouTube',
            'slotsCount' => 'required|integer|min:1',
            'paidSlotsCount' => 'required|integer|min:0',
            'pricePerSlot' => 'required|numeric|min:0',
            'comments' => 'nullable|string',
            'slotsConfig' => 'nullable|array',
        ]);

        $report = Report::create([
            'date' => $request->date,
            'project_id' => $request->projectId,
            'destination' => $request->destination,
            'channel_blogger' => $request->channelBlogger,
            'platform' => $request->platform,
            'slots_count' => $request->slotsCount,
            'paid_slots_count' => $request->paidSlotsCount,
            'price_per_slot' => $request->pricePerSlot,
            'comments' => $request->comments,
            'slots_config' => $request->slotsConfig,
        ]);

        // Auto-create Integration record
        $cleanBloggerName = trim(str_replace(['@', '#'], '', $report->channel_blogger));
        $slugName = Str::slug($cleanBloggerName, '_');
        $token = 'tok_' . time() . '_' . $slugName;
        $referralLink = "https://fluenceflow.net/p/{$report->project_id}?utm_source={$slugName}";
        
        $startDate = $report->date;
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

        // Reload to get calculated values
        $report->refresh();

        return response()->json([
            'id' => (string) $report->id,
            'date' => $report->date->format('Y-m-d'),
            'projectId' => (string) $report->project_id,
            'projectName' => $report->project->name ?? '',
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
        ], 201);
    }
}
