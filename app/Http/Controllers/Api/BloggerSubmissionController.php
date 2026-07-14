<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BloggerSubmission;
use Illuminate\Http\Request;

class BloggerSubmissionController extends Controller
{
    public function index()
    {
        return response()->json(BloggerSubmission::all()->map(function ($sub) {
            return [
                'id' => (string) $sub->id,
                'integrationId' => (string) $sub->integration_id,
                'submittedAt' => $sub->submitted_at->toISOString(),
                'status' => $sub->status,
                'data' => $sub->data ?? [],
            ];
        }));
    }

    public function store(Request $request)
    {
        $request->validate([
            'integrationId' => 'required|exists:integrations,id',
            'status' => 'nullable|in:pending,approved,rejected',
            'data' => 'required|array',
            'lang' => 'nullable|string|in:ru,en,uz',
        ]);

        $sub = BloggerSubmission::updateOrCreate(
            ['integration_id' => $request->integrationId],
            [
                'status' => 'approved',
                'submitted_at' => now(),
                'data' => $request->data,
            ]
        );

        $integration = \App\Models\Integration::findOrFail($request->integrationId);

        // Trigger Telegram submission notification
        try {
            $lang = $request->input('lang', 'ru');
            \App\Services\TelegramService::sendSubmissionNotification($integration, $request->data, $lang);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Failed to send submission webhook: " . $e->getMessage());
        }

        return response()->json([
            'id' => (string) $sub->id,
            'integrationId' => (string) $sub->integration_id,
            'submittedAt' => $sub->submitted_at->toISOString(),
            'status' => $sub->status,
            'data' => $sub->data ?? [],
        ], 201);
    }
}
