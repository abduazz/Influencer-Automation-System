<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BloggerSubmission;
use App\Models\Integration;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

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
        $rawId = $request->input('integrationId');

        Log::info('BloggerSubmission store called', [
            'integrationId_raw' => $rawId,
            'lang' => $request->input('lang'),
            'data_keys' => array_keys((array) $request->input('data', [])),
        ]);

        // Validate basic shape (not DB existence yet — we resolve it below)
        $request->validate([
            'integrationId' => 'required|string',
            'status' => 'nullable|in:pending,approved,rejected',
            'data' => 'required|array',
            'lang' => 'nullable|string|in:ru,en,uz',
        ]);

        // Resolve integration: accept numeric ID OR blogger_cabinet_token
        $integration = Integration::find($rawId)
            ?? Integration::where('blogger_cabinet_token', $rawId)->first();

        if (!$integration) {
            Log::error('BloggerSubmission: integration not found for id/token: ' . $rawId);
            return response()->json([
                'message' => 'Integration not found. Please use the correct blogger link.'
            ], 422);
        }

        Log::info('BloggerSubmission resolved integration: id=' . $integration->id . ' blogger=' . $integration->blogger_name);

        $sub = BloggerSubmission::updateOrCreate(
            ['integration_id' => $integration->id],
            [
                'status' => 'approved',
                'submitted_at' => now(),
                'data' => $request->data,
            ]
        );

        Log::info('BloggerSubmission saved, sub ID: ' . $sub->id);

        // Trigger Telegram submission notification after response to speed up submission
        $lang = $request->input('lang', 'ru');
        $data = $request->data;
        dispatch(function () use ($integration, $data, $lang) {
            try {
                Log::info('Sending Telegram submission notification for integration: ' . $integration->id . ' blogger: ' . $integration->blogger_name);
                $result = \App\Services\TelegramService::sendSubmissionNotification($integration, $data, $lang);
                Log::info('Telegram sendSubmissionNotification result: ' . ($result ? 'true' : 'false'));
            } catch (\Throwable $e) {
                Log::error("Failed to send submission webhook: " . $e->getMessage());
            }
        })->afterResponse();

        return response()->json([
            'id' => (string) $sub->id,
            'integrationId' => (string) $sub->integration_id,
            'submittedAt' => $sub->submitted_at->toISOString(),
            'status' => $sub->status,
            'data' => $sub->data ?? [],
        ], 201);
    }

    public function destroy($id)
    {
        $sub = BloggerSubmission::findOrFail($id);
        $sub->delete();
        return response()->json(null, 204);
    }
}
