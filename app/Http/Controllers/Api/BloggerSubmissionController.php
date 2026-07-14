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
        \Illuminate\Support\Facades\Log::info('BloggerSubmission store called', [
            'integrationId' => $request->input('integrationId'),
            'lang' => $request->input('lang'),
            'data_keys' => array_keys((array)$request->input('data', [])),
        ]);

        $validated = $request->validate([
            'integrationId' => 'required|exists:integrations,id',
            'status' => 'nullable|in:pending,approved,rejected',
            'data' => 'required|array',
            'lang' => 'nullable|string|in:ru,en,uz',
        ]);

        \Illuminate\Support\Facades\Log::info('BloggerSubmission validation passed, saving to DB');

        $sub = BloggerSubmission::updateOrCreate(
            ['integration_id' => $request->integrationId],
            [
                'status' => 'approved',
                'submitted_at' => now(),
                'data' => $request->data,
            ]
        );

        \Illuminate\Support\Facades\Log::info('BloggerSubmission saved, sub ID: ' . $sub->id);

        $integration = \App\Models\Integration::findOrFail($request->integrationId);

        // Trigger Telegram submission notification
        try {
            $lang = $request->input('lang', 'ru');
            \Illuminate\Support\Facades\Log::info('Sending Telegram submission notification for integration: ' . $integration->id . ' blogger: ' . $integration->blogger_name);
            $result = \App\Services\TelegramService::sendSubmissionNotification($integration, $request->data, $lang);
            \Illuminate\Support\Facades\Log::info('Telegram sendSubmissionNotification result: ' . ($result ? 'true' : 'false'));
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
