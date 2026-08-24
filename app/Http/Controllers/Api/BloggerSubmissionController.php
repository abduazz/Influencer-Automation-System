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
        $integration->load('project');

        $existingSub = BloggerSubmission::where('integration_id', $integration->id)->first();
        $oldData = $existingSub ? ($existingSub->data ?? []) : [];

        $sub = BloggerSubmission::updateOrCreate(
            ['integration_id' => $integration->id],
            [
                'status' => 'approved',
                'submitted_at' => now(),
                'data' => $request->data,
            ]
        );

        Log::info('BloggerSubmission saved, sub ID: ' . $sub->id);

        // Find newly filled slot keys
        $newData = $request->data ?? [];
        $newlyFilledKeys = [];
        foreach ($newData as $key => $value) {
            $oldValue = $oldData[$key] ?? null;
            if (!empty($value) && empty($oldValue)) {
                $newlyFilledKeys[] = $key;
            }
        }

        Log::info('BloggerSubmission diff:', [
            'oldData' => $oldData,
            'newData' => $newData,
            'newlyFilledKeys' => $newlyFilledKeys,
        ]);

        // Trigger Telegram submission notification after response to speed up submission
        $lang = $request->input('lang', 'uz');
        $data = $request->data;
        dispatch(function () use ($integration, $data, $lang, $newlyFilledKeys) {
            try {
                Log::info('Sending Telegram submission notification for integration: ' . $integration->id . ' blogger: ' . $integration->blogger_name);
                $result = \App\Services\TelegramService::sendSubmissionNotification($integration, $data, $lang, $newlyFilledKeys);
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
